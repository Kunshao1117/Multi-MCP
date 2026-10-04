import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { GatewayConfig, ToolRegistry, RegistryToolEntry, SearchToolsResult, CategorySummary } from './types.js';
import { NAMESPACE_SEPARATOR } from './types.js';
import { createLogger } from './logger.js';
import { getServerEnv, getConfigContext, reloadConfig } from './config-loader.js';
import { commitFileChanges, withDataLock } from './management/storage.js';
import { manageTransportClose, type ManagedTransportClose } from './managed-transport.js';

const logger = createLogger('registry');
const DEFAULT_REGISTRY_PATH = 'registry.json';

function actualToolCount(entry: { tool_count: number; tools: Record<string, RegistryToolEntry> }): number {
  return Object.keys(entry.tools).length;
}

interface RegistrySnapshot { raw: string | undefined; registry: ToolRegistry }

/** Read bytes once so the optimistic revision and last-known-good tools describe the same file. */
function readRegistrySnapshot(registryPath: string): RegistrySnapshot {
  let raw: string;
  try { raw = readFileSync(registryPath, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { raw: undefined, registry: { version: '1.0.0', generated_at: new Date().toISOString(), servers: {}, all_tools: {} } };
  }
  const registry = JSON.parse(raw) as ToolRegistry;
  if (!registry || typeof registry !== 'object' || !registry.servers || !registry.all_tools
    || typeof registry.servers !== 'object' || typeof registry.all_tools !== 'object'
    || Array.isArray(registry.servers) || Array.isArray(registry.all_tools)) throw new Error('工具快取格式無效；原始檔案已保留');
  return { raw, registry };
}

export function loadRegistry(registryPath?: string): ToolRegistry {
  const resolvedPath = resolve(registryPath ?? DEFAULT_REGISTRY_PATH);
  logger.info('載入集成表', { path: resolvedPath });
  const snapshot = readRegistrySnapshot(resolvedPath);
  if (snapshot.raw === undefined) logger.warn('集成表不存在，請先執行 npm run scan');
  else logger.info('集成表載入成功', { toolCount: Object.keys(snapshot.registry.all_tools).length, servers: Object.keys(snapshot.registry.servers) });
  return snapshot.registry;
}

function configRevision(config: GatewayConfig): string {
  return JSON.stringify([config, Object.keys(config.mcpServers).map((name) => getServerEnv(config, name))]);
}

/** Public scanners may place registry outside the configuration directory. Acquire all
 * existing management roots in a fixed order, fail fast, and never await under these locks. */
function withRegistryLocks<T>(config: GatewayConfig, registryPath: string, action: () => T): T {
  const context = getConfigContext(config);
  const candidates = [dirname(resolve(registryPath)), ...(context ? [dirname(context.configPath)] : [])];
  const key = (root: string) => process.platform === 'win32' ? root.toLowerCase() : root;
  const unique = new Map(candidates.map((root) => [key(root), root]));
  const roots = [...unique.keys()].sort().map((name) => unique.get(name)!);
  const enter = (index: number): T => index === roots.length ? action() : withDataLock(roots[index], () => enter(index + 1));
  return enter(0);
}

function assertConfigUnchanged(config: GatewayConfig, expected: string): void {
  if (configRevision(reloadConfig(config)) !== expected) throw new Error('MCP 設定或認證已變更；未發布過期掃描結果，請重新掃描');
}

/** The caller holds the existing management lock for this synchronous publication only. */
function publishRegistry(registry: ToolRegistry, resolvedPath: string): ToolRegistry {
  const published = { ...registry, revision: randomUUID() };
  commitFileChanges(dirname(resolvedPath), [{ path: resolvedPath, data: JSON.stringify(published, null, 2) }]);
  return published;
}

/** Reconcile removals against the latest disk cache, never an older process's in-memory snapshot. */
export function pruneRegistry(config: GatewayConfig, registryPath: string): ToolRegistry {
  const resolvedPath = resolve(registryPath);
  const expectedConfig = configRevision(config);
  return withRegistryLocks(config, resolvedPath, () => {
    assertConfigUnchanged(config, expectedConfig);
    const current = readRegistrySnapshot(resolvedPath).registry;
    const servers = Object.fromEntries(Object.entries(current.servers)
      .filter(([name]) => Object.prototype.hasOwnProperty.call(config.mcpServers, name)));
    const all_tools = Object.fromEntries(Object.entries(current.all_tools)
      .filter(([, name]) => Object.prototype.hasOwnProperty.call(servers, name)));
    if (JSON.stringify(servers) === JSON.stringify(current.servers) && JSON.stringify(all_tools) === JSON.stringify(current.all_tools)) return current;
    return publishRegistry({ ...current, servers, all_tools }, resolvedPath);
  });
}

export function namespaceTool(serverName: string, toolName: string): string {
  return `${serverName}${NAMESPACE_SEPARATOR}${toolName}`;
}

/** Scans targeting the same file are serialized; identical in-flight snapshots coalesce. */
export interface ScanOptions { signal?: AbortSignal }
const quarantinedScans = new Set<string>();
const scans = new Map<string, { snapshot: string; signal?: AbortSignal; promise: Promise<ToolRegistry> }>();

export function scanAndGenerateRegistry(config: GatewayConfig, registryPath?: string, options: ScanOptions = {}): Promise<ToolRegistry> {
  const resolvedPath = resolve(registryPath ?? DEFAULT_REGISTRY_PATH);
  const snapshot = configRevision(config);
  const previous = scans.get(resolvedPath);
  if (previous?.snapshot === snapshot && previous.signal === options.signal) return previous.promise;
  const promise = (previous?.promise.catch(() => undefined) ?? Promise.resolve())
    .then(() => scanSnapshot(config, resolvedPath, options));
  scans.set(resolvedPath, { snapshot, signal: options.signal, promise });
  void promise.finally(() => {
    if (scans.get(resolvedPath)?.promise === promise) scans.delete(resolvedPath);
  }).catch(() => undefined);
  return promise;
}

async function scanSnapshot(config: GatewayConfig, resolvedPath: string, options: ScanOptions): Promise<ToolRegistry> {
  if (options.signal?.aborted) throw new Error('MCP scan cancelled');
  const expectedConfig = configRevision(config);
  const previousSnapshot = withRegistryLocks(config, resolvedPath, () => {
    assertConfigUnchanged(config, expectedConfig);
    return readRegistrySnapshot(resolvedPath);
  });
  const previous = previousSnapshot.registry;
  const registry: ToolRegistry = {
    version: '1.0.0', generated_at: new Date().toISOString(), servers: {}, all_tools: {},
  };
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    const cleanupKey = JSON.stringify([resolvedPath, serverName]);
    if (quarantinedScans.has(cleanupKey)) throw new Error('先前 MCP 子程序清理未確認；請確認子程序已退出並重新啟動 Gateway 後再掃描');
    let managed: ManagedTransportClose | undefined;
    let transport: StdioClientTransport | undefined;
    let client: Client | undefined;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    let rejectCancelled: (() => void) | undefined;
    try {
      if (options.signal?.aborted) throw new Error('MCP scan cancelled');
      transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: getServerEnv(config, serverName),
        stderr: 'pipe',
      });
      // Do not pipe untrusted downstream stderr, which may include credentials, to Gateway logs.
      transport.stderr?.on('data', () => undefined);
      client = new Client({ name: 'multi-mcp-scanner', version: '0.1.0' }, { capabilities: {} });
      managed = manageTransportClose(client, transport);
      client.onclose = () => { managed!.onClientClose(); quarantinedScans.delete(cleanupKey); };
      const scan = async () => {
        await client!.connect(transport!, { signal: controller.signal });
        const serverTools: Record<string, RegistryToolEntry> = {};
        const cursors = new Set<string>();
        let cursor: string | undefined;
        let byteCount = 0;
        for (let page = 0; page < 200; page++) {
          const result = await client!.listTools(cursor ? { cursor } : undefined, { signal: controller.signal });
          byteCount += Buffer.byteLength(JSON.stringify(result));
          if (byteCount > 5_000_000) throw new Error('tools/list exceeded the response byte limit');
          for (const tool of result.tools ?? []) {
            const ns = namespaceTool(serverName, tool.name);
            serverTools[ns] = {
              original_name: tool.name, server_name: serverName,
              description: tool.description ?? '', inputSchema: tool.inputSchema as Record<string, unknown>,
            };
            if (Object.keys(serverTools).length > 10_000) throw new Error('tools/list exceeded the tool limit');
          }
          if (!result.nextCursor) return serverTools;
          if (cursors.has(result.nextCursor)) throw new Error('tools/list returned a repeated cursor');
          cursors.add(result.nextCursor);
          cursor = result.nextCursor;
        }
        throw new Error('tools/list exceeded the page limit');
      };
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('MCP scan timed out'));
        }, config.gateway.startup_timeout_ms);
      });
      const cancelled = new Promise<never>((_, reject) => {
        rejectCancelled = () => reject(new Error('MCP scan cancelled'));
        controller.signal.addEventListener('abort', rejectCancelled, { once: true });
      });
      const serverTools = await Promise.race([scan(), deadline, cancelled]);
      registry.servers[serverName] = { tool_count: Object.keys(serverTools).length, tools: serverTools };
    } catch {
      if (options.signal?.aborted) throw new Error('MCP scan cancelled');
      // Preserve last-known-good discovery for an enabled server; never retain removed servers.
      const old = previous.servers[serverName];
      registry.servers[serverName] = {
        tool_count: old ? Object.keys(old.tools).length : 0, tools: old?.tools ?? {},
        stale: true, scan_error: 'Scan failed; cached tools may be outdated. Check the downstream service and retry.',
      };
      logger.warn('下游掃描失敗，保留可用快取', { server: serverName });
    } finally {
      if (timeout) clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
      if (rejectCancelled) controller.signal.removeEventListener('abort', rejectCancelled);
      controller.abort();
      try {
        if (managed) await managed.close();
        else await transport?.close();
      } catch {
        quarantinedScans.add(cleanupKey);
        throw new Error('MCP 掃描清理失敗，子程序關閉未確認；未發布此次工具快取');
      }
    }
    for (const name of Object.keys(registry.servers[serverName].tools)) registry.all_tools[name] = serverName;
  }
  if (options.signal?.aborted) throw new Error('MCP scan cancelled');
  return withRegistryLocks(config, resolvedPath, () => {
    if (options.signal?.aborted) throw new Error('MCP scan cancelled');
    const latest = readRegistrySnapshot(resolvedPath);
    if (latest.raw !== previousSnapshot.raw) throw new Error('工具快取已由其他操作更新；未發布過期掃描結果，請重新掃描');
    assertConfigUnchanged(config, expectedConfig);
    return publishRegistry(registry, resolvedPath);
  });
}

export function searchTools(
  registry: ToolRegistry,
  query: string,
  options?: { server?: string; limit?: number },
): SearchToolsResult[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];
  const limit = options?.limit ?? 10;
  const scored: Array<{ entry: SearchToolsResult; score: number }> = [];

  for (const [nsName, serverName] of Object.entries(registry.all_tools)) {
    if (options?.server && serverName !== options.server) continue;
    const serverEntry = registry.servers[serverName];
    if (!serverEntry) continue;
    const toolEntry = serverEntry.tools[nsName];
    if (!toolEntry) continue;

    let score = 0;
    const nameLower = toolEntry.original_name.toLowerCase();
    const descLower = toolEntry.description.toLowerCase();
    const nsLower = nsName.toLowerCase();

    for (const kw of keywords) {
      if (nameLower.includes(kw)) score += 3;
      if (nsLower.includes(kw)) score += 2;
      if (descLower.includes(kw)) score += 1;
      if (serverName.toLowerCase().includes(kw)) score += 2;
    }

    if (score > 0) {
      scored.push({
        entry: {
          name: nsName,
          server: serverName,
          description: toolEntry.description,
          inputSchema: toolEntry.inputSchema,
        },
        score,
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

export function generateCategorySummary(
  registry: ToolRegistry,
  categories: Record<string, string[]>,
): CategorySummary[] {
  const summaries: CategorySummary[] = [];
  const categorized = new Set<string>();

  for (const [category, servers] of Object.entries(categories)) {
    let toolCount = 0;
    const highlights: string[] = [];
    const validServers: string[] = [];

    for (const s of servers) {
      const serverEntry = registry.servers[s];
      if (!serverEntry) continue;
      validServers.push(s);
      toolCount += actualToolCount(serverEntry);
      categorized.add(s);
      // 取前 3 個工具作為代表性亮點
      const toolNames = Object.values(serverEntry.tools)
        .slice(0, 3)
        .map((t) => t.original_name);
      highlights.push(...toolNames);
    }

    if (validServers.length > 0) {
      summaries.push({
        category,
        servers: validServers,
        toolCount,
        highlights: highlights.slice(0, 5),
      });
    }
  }

  // 未分類的伺服器
  const uncategorized: string[] = [];
  let uncatToolCount = 0;
  const uncatHighlights: string[] = [];

  for (const [name, entry] of Object.entries(registry.servers)) {
    if (!categorized.has(name)) {
      uncategorized.push(name);
      uncatToolCount += actualToolCount(entry);
      const toolNames = Object.values(entry.tools)
        .slice(0, 2)
        .map((t) => t.original_name);
      uncatHighlights.push(...toolNames);
    }
  }

  if (uncategorized.length > 0) {
    summaries.push({
      category: '未分類',
      servers: uncategorized,
      toolCount: uncatToolCount,
      highlights: uncatHighlights.slice(0, 5),
    });
  }

  return summaries;
}

export function formatCategorySummaryText(summaries: CategorySummary[]): string {
  const icons: Record<string, string> = {
    '資料庫管理': '📦', '雲端基礎設施': '☁️', 'UI設計': '🎨',
    '未分類': '📂',
  };
  return summaries
    .map((s) => {
      const icon = icons[s.category] ?? '🔧';
      return `${icon} ${s.category}（${s.servers.join(', ')}）— ${s.toolCount} 個工具\n   ${s.highlights.join(', ')}...`;
    })
    .join('\n');
}
