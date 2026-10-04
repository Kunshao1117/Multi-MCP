/** Lazy, generation-scoped downstream lifecycle. Tool requests are never retried. */
import { isAbsolute, normalize } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { GatewayConfig, McpServerConfig, ProcessState, AuthStatus, ServerHealthInfo } from './types.js';
import { checkEnvVarsConfigured, classifyAuthError } from './auth-guides.js';
import { getConfigContext, getServerEnv, reloadConfig } from './config-loader.js';
import { createLogger } from './logger.js';
import { createDownstreamEnv } from './subprocess-env.js';
import { manageTransportClose, type ManagedTransportClose } from './managed-transport.js';

const logger = createLogger('process-pool');
async function settleAll(operations: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(operations);
  const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed.length) throw new AggregateError(failed.map((result) => result.reason), 'MCP 資源清理失敗');
}
export interface DownstreamCallOptions { signal?: AbortSignal; workspace?: string }
interface Resources {
  client: Client;
  transport: StdioClientTransport;
  closing?: Promise<void>;
  managed: ManagedTransportClose;
}
interface ManagedEntry {
  serverName: string;
  workspace?: string;
  config: McpServerConfig;
  environment: Record<string, string>;
  state: ProcessState;
  resources: Resources | null;
  generation: number;
  lifecycle: AbortController | null;
  activeCalls: number;
  waiters: number;
  lastActivity: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  startPromise: Promise<Client> | null;
  stopPromise: Promise<void> | null;
  authStatus: AuthStatus;
  lastError?: string;
}

function abortError(signal?: AbortSignal): Error {
  return signal?.reason instanceof Error ? signal.reason : new Error('MCP operation cancelled');
}

/** Unlike Promise.race, always removes its listener when the original promise settles. */
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise<T>((resolve, reject) => {
    const cancel = () => { signal.removeEventListener('abort', cancel); reject(abortError(signal)); };
    signal.addEventListener('abort', cancel, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(abortError(signal)); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

/** Compatible with supported Node 18 releases that predate AbortSignal.any. */
function combineSignals(signals: AbortSignal[]): { signal: AbortSignal; release: () => void } {
  const controller = new AbortController();
  const listeners = signals.map((signal) => {
    const abort = () => controller.abort(signal.reason);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    return () => signal.removeEventListener('abort', abort);
  });
  return { signal: controller.signal, release: () => listeners.forEach((remove) => remove()) };
}

export class ProcessPool {
  private readonly pool = new Map<string, ManagedEntry>();
  private readonly environments = new Map<string, Record<string, string>>();
  private readonly pendingStops = new Set<Promise<void>>();
  private sourceConfig: GatewayConfig;
  private readonly initialEnvironment: NodeJS.ProcessEnv;
  private shuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private reconcilePromise: Promise<void> = Promise.resolve();

  constructor(private config: GatewayConfig) {
    this.sourceConfig = config;
    this.initialEnvironment = { ...process.env };
    for (const name of Object.keys(config.mcpServers)) {
      this.environments.set(name, getServerEnv(config, name));
      this.entryFor(name);
    }
  }

  private key(name: string, workspace?: string): string { return JSON.stringify([name, workspace ?? null]); }

  private entryFor(serverName: string, workspace?: string): ManagedEntry {
    if (!Object.hasOwn(this.config.mcpServers, serverName)) throw new Error(`未知的 MCP 伺服器: ${serverName}`);
    if (workspace !== undefined) {
      const fullyQualified = process.platform !== 'win32'
        ? isAbsolute(workspace)
        : /^[A-Za-z]:[\\/]/.test(workspace) || /^\\\\[^\\/]+[\\/][^\\/]+/.test(workspace);
      if (!workspace.trim() || !fullyQualified) throw new Error('workspace 必須是原生平台絕對路徑');
      workspace = normalize(workspace);
    }
    const key = this.key(serverName, workspace);
    let entry = this.pool.get(key);
    if (!entry) {
      const config = this.config.mcpServers[serverName];
      const environment = this.environments.get(serverName) ?? getServerEnv(this.config, serverName);
      const check = checkEnvVarsConfigured(serverName, config.env, environment);
      entry = {
        serverName, workspace, config, environment, state: 'dormant', resources: null,
        generation: 0, lifecycle: null, activeCalls: 0, waiters: 0, lastActivity: Date.now(),
        idleTimer: null, startPromise: null, stopPromise: null,
        authStatus: check.configured ? 'unknown' : 'not_configured',
        lastError: check.configured ? undefined : `缺少環境變數: ${check.missing.join(', ')}`,
      };
      this.pool.set(key, entry);
    }
    return entry;
  }

  async getClient(serverName: string, options: DownstreamCallOptions = {}): Promise<Client> {
    if (this.shuttingDown) throw new Error('Gateway 正在關閉');
    if (options.signal?.aborted) throw abortError(options.signal);
    const entry = this.entryFor(serverName, options.workspace);
    entry.waiters++;
    try {
      if (entry.stopPromise) await withAbort(entry.stopPromise, options.signal);
      if (this.shuttingDown || this.pool.get(this.key(entry.serverName, entry.workspace)) !== entry) throw new Error('MCP 設定已變更或關閉');
      if (entry.state === 'failed' && entry.resources) throw new Error('前次 MCP 資源清理失敗，無法安全重新啟動');
      if (entry.state === 'ready' && entry.resources) {
        this.resetIdleTimer(entry);
        return entry.resources.client;
      }
      // The single flight spans connection attempts, resource cleanup AND backoff.
      if (!entry.startPromise) this.startServer(entry);
      return await withAbort(entry.startPromise!, options.signal);
    } finally {
      entry.waiters--;
      if (options.signal?.aborted) this.cancelOrphanStartup(entry);
    }
  }

  private cancelOrphanStartup(entry: ManagedEntry): void {
    if (entry.waiters === 0 && entry.activeCalls === 0 && entry.state === 'starting') {
      void this.stopEntry(entry).catch((error) => logger.error('取消啟動清理失敗', { error: String(error) }));
    }
  }

  private startServer(entry: ManagedEntry): void {
    const generation = ++entry.generation;
    const controller = new AbortController();
    entry.lifecycle = controller;
    entry.state = 'starting';
    const current = () => !this.shuttingDown && !controller.signal.aborted && entry.generation === generation
      && this.pool.get(this.key(entry.serverName, entry.workspace)) === entry;
    const promise = Promise.resolve().then(async () => {
      for (let attempt = 0; ; attempt++) {
        let resource: Resources | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          if (!current()) throw abortError(controller.signal);
          const transport = new StdioClientTransport({
            command: entry.config.command, args: entry.config.args, env: entry.environment, stderr: 'pipe',
            ...(entry.workspace ? { cwd: entry.workspace } : {}),
          });
          // Do not expose downstream stderr (which may contain credentials) to the host.
          transport.stderr?.on('data', () => {});
          const client = new Client({ name: `multi-mcp-gateway/${entry.serverName}`, version: '1.2.0' }, { capabilities: {} });
          const managed = manageTransportClose(client, transport);
          resource = { client, transport, managed };
          entry.resources = resource;
          // The SDK owns transport callbacks. Client callbacks preserve its protocol cleanup.
          client.onclose = () => {
            managed.onClientClose();
            if (!current() || entry.resources !== resource || resource?.closing) return;
            controller.abort(new Error(`${entry.serverName}: 下游連線已關閉`));
            void this.stopEntry(entry).catch((error) => logger.error('下游清理失敗', { error: String(error) }));
          };
          client.onerror = (error) => {
            if (current() && entry.resources === resource) entry.lastError = error.message;
          };
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${entry.serverName} 啟動超時 (${this.config.gateway.startup_timeout_ms}ms)`)), this.config.gateway.startup_timeout_ms);
          });
          await withAbort(Promise.race([client.connect(transport), timeout]), controller.signal);
          if (!current()) throw abortError(controller.signal);
          entry.state = 'ready';
          // initialize proves connectivity, never token validity or business API scopes.
          const check = checkEnvVarsConfigured(entry.serverName, entry.config.env, entry.environment);
          entry.authStatus = check.configured ? 'unknown' : 'not_configured';
          entry.lastError = check.configured ? undefined : `缺少環境變數: ${check.missing.join(', ')}`;
          this.resetIdleTimer(entry);
          return client;
        } catch (error) {
          if (timer) clearTimeout(timer);
          if (resource) {
            try { await this.closeResources(resource); }
            catch (cleanupError) {
              entry.state = 'failed';
              entry.lastError = 'MCP 資源清理失敗';
              throw cleanupError;
            }
            if (entry.resources === resource) entry.resources = null;
          }
          if (!current()) throw abortError(controller.signal);
          entry.lastError = (error as Error).message;
          entry.authStatus = classifyAuthError(error) ?? 'error';
          if (attempt >= this.config.gateway.max_retries || classifyAuthError(error)) {
            entry.state = 'dormant';
            throw new Error(`${entry.serverName} 啟動失敗: ${entry.lastError}`);
          }
          // Only initialize is retried; a tool request is always dispatched at most once.
          await delay(Math.min(1000 * 2 ** (attempt + 1), 10000), controller.signal);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
    });
    entry.startPromise = promise;
    void promise.finally(() => {
      if (entry.startPromise === promise) entry.startPromise = null;
    }).catch(() => {});
  }

  async callTool(
    serverName: string,
    params: Parameters<Client['callTool']>[0],
    options: DownstreamCallOptions = {},
  ): Promise<Awaited<ReturnType<Client['callTool']>>> {
    if (this.shuttingDown) throw new Error('Gateway 正在關閉');
    if (options.signal?.aborted) throw abortError(options.signal);
    const entry = this.entryFor(serverName, options.workspace);
    entry.activeCalls++;
    this.clearIdleTimer(entry);
    let releaseSignal: (() => void) | undefined;
    try {
      const client = await this.getClient(serverName, options);
      const combined = combineSignals([entry.lifecycle!.signal, ...(options.signal ? [options.signal] : [])]);
      releaseSignal = combined.release;
      const signal = combined.signal;
      if (signal.aborted) throw abortError(signal);
      return await withAbort(client.callTool(params, undefined, { signal }), signal);
    } catch (error) {
      const status = classifyAuthError(error);
      if (status) { entry.authStatus = status; entry.lastError = (error as Error).message; }
      throw error;
    } finally {
      releaseSignal?.();
      entry.activeCalls--;
      if (options.signal?.aborted) this.cancelOrphanStartup(entry);
      this.resetIdleTimer(entry);
    }
  }

  private clearIdleTimer(entry: ManagedEntry): void {
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    entry.idleTimer = null;
  }

  private resetIdleTimer(entry: ManagedEntry): void {
    this.clearIdleTimer(entry);
    entry.lastActivity = Date.now();
    if (this.shuttingDown || entry.activeCalls || entry.state !== 'ready' || this.config.gateway.idle_timeout_ms <= 0) return;
    const generation = entry.generation;
    entry.idleTimer = setTimeout(() => {
      if (entry.generation === generation && !entry.activeCalls && entry.state === 'ready') {
        void this.stopEntry(entry).catch((error) => logger.error('閒置回收失敗', { error: String(error) }));
      }
    }, this.config.gateway.idle_timeout_ms);
  }

  private closeResources(resource: Resources): Promise<void> {
    resource.closing ??= resource.managed.close();
    return resource.closing;
  }

  private stopEntry(entry: ManagedEntry): Promise<void> {
    if (entry.stopPromise) return entry.stopPromise;
    ++entry.generation;
    this.clearIdleTimer(entry);
    entry.lifecycle?.abort(new Error(`${entry.serverName}: 已停止`));
    const resource = entry.resources;
    const starting = entry.startPromise;
    entry.resources = null;
    entry.state = 'dormant';
    entry.authStatus = 'unknown';
    const stopping = Promise.resolve().then(async () => {
      const results = await Promise.allSettled([resource ? this.closeResources(resource) : Promise.resolve(), starting]);
      // Startup rejection is expected on cancellation; resource close errors must be visible.
      if (results[0].status === 'rejected') {
        entry.resources = resource;
        entry.state = 'failed';
        entry.lastError = 'MCP 資源清理失敗';
        throw results[0].reason;
      }
    });
    entry.stopPromise = stopping;
    this.pendingStops.add(stopping);
    void stopping.finally(() => {
      this.pendingStops.delete(stopping);
      if (entry.stopPromise === stopping) entry.stopPromise = null;
    }).catch(() => {});
    return stopping;
  }

  async stopServer(serverName: string): Promise<void> {
    await settleAll([...this.pool.values()].filter((entry) => entry.serverName === serverName).map((entry) => this.stopEntry(entry)));
  }

  async reloadServer(serverName: string): Promise<void> {
    if (!this.hasServer(serverName)) throw new Error(`未知的 MCP 伺服器: ${serverName}`);
    const fresh = reloadConfig(this.sourceConfig);
    await this.reconcile(fresh);
    if (!this.hasServer(serverName)) return;
    await this.stopServer(serverName);
    for (const entry of this.pool.values()) {
      if (entry.serverName !== serverName) continue;
      const check = checkEnvVarsConfigured(serverName, entry.config.env, entry.environment);
      entry.authStatus = check.configured ? 'unknown' : 'not_configured';
      entry.lastError = check.configured ? undefined : `缺少環境變數: ${check.missing.join(', ')}`;
    }
  }

  getConfig(): GatewayConfig { return this.config; }

  hasServer(serverName: string): boolean { return !this.shuttingDown && Object.hasOwn(this.config.mcpServers, serverName); }

  /** Legacy synchronous admission; any changed entry is barred until its close completes. */
  addServer(serverName: string, serverConfig: McpServerConfig): void {
    if (this.shuttingDown) throw new Error('Gateway 正在關閉');
    const next = { ...this.config, mcpServers: { ...this.config.mcpServers, [serverName]: serverConfig } };
    const environment = createDownstreamEnv(serverConfig.env ?? {}, getConfigContext(this.sourceConfig)?.environment ?? this.initialEnvironment);
    this.config = next;
    this.environments.set(serverName, environment);
    for (const entry of this.pool.values()) {
      if (entry.serverName !== serverName) continue;
      if (JSON.stringify(entry.config) !== JSON.stringify(serverConfig) || JSON.stringify(entry.environment) !== JSON.stringify(environment)) {
        void this.stopEntry(entry).catch((error) => logger.error('更新清理失敗', { error: String(error) }));
        entry.config = serverConfig;
        entry.environment = environment;
      }
    }
    this.entryFor(serverName);
  }

  /** Replace the whole enabled membership, draining changed/deleted generations first. */
  reconcile(config: GatewayConfig): Promise<void> {
    const operation = this.reconcilePromise.then(async () => {
      if (this.shuttingDown) throw new Error('Gateway 正在關閉');
      const environments = new Map(Object.keys(config.mcpServers).map((name) => [name, getServerEnv(config, name)]));
      const stopping: Promise<void>[] = [];
      this.config = config;
      this.sourceConfig = config;
      for (const [key, entry] of this.pool) {
        const next = config.mcpServers[entry.serverName];
        const environment = environments.get(entry.serverName);
        if (!next || !environment) {
          this.pool.delete(key);
          stopping.push(this.stopEntry(entry));
        } else if (JSON.stringify(next) !== JSON.stringify(entry.config) || JSON.stringify(environment) !== JSON.stringify(entry.environment)) {
          stopping.push(this.stopEntry(entry));
          entry.config = next;
          entry.environment = environment;
        }
      }
      this.environments.clear();
      for (const [name, environment] of environments) this.environments.set(name, environment);
      await settleAll(stopping);
      for (const name of Object.keys(config.mcpServers)) this.entryFor(name);
    });
    this.reconcilePromise = operation.catch(() => {});
    return operation;
  }

  async healthCheck(): Promise<ServerHealthInfo[]> {
    const results: ServerHealthInfo[] = [];
    for (const name of Object.keys(this.config.mcpServers)) {
      const entry = this.entryFor(name);
      const check = checkEnvVarsConfigured(name, entry.config.env, entry.environment);
      if (!check.configured) {
        entry.authStatus = 'not_configured';
        entry.lastError = `缺少環境變數: ${check.missing.join(', ')}`;
      } else {
        const wasReady = entry.state === 'ready';
        try {
          await this.getClient(name);
          if (!wasReady && !entry.config.preload && !entry.activeCalls && !entry.waiters) await this.stopEntry(entry);
        } catch (error) {
          entry.authStatus = classifyAuthError(error) ?? 'error';
          entry.lastError = (error as Error).message;
        }
      }
      results.push(this.health(entry));
    }
    return results;
  }

  private health(entry: ManagedEntry): ServerHealthInfo {
    return { serverName: entry.serverName, ...(entry.workspace ? { workspace: entry.workspace } : {}),
      state: entry.state, authStatus: entry.authStatus, lastChecked: entry.lastActivity, lastError: entry.lastError };
  }
  getHealthInfo(): ServerHealthInfo[] { return [...this.pool.values()].map((entry) => this.health(entry)); }
  async preloadServers(): Promise<void> {
    await Promise.allSettled(Object.entries(this.config.mcpServers).filter(([, sc]) => sc.preload).map(([name]) => this.getClient(name)));
  }
  shutdownAll(): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    this.shuttingDown = true;
    this.shutdownPromise = settleAll([...this.pool.values()].map((entry) => this.stopEntry(entry)).concat([...this.pendingStops]));
    return this.shutdownPromise;
  }
}
