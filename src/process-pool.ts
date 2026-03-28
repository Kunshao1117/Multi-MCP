/**
 * Multi-MCP Gateway — 程序池管理員
 * 懶啟動、閒置回收、崩潰恢復、啟動健康自檢
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { GatewayConfig, McpServerConfig, ProcessState, AuthStatus, ServerHealthInfo } from './types.js';
import { checkEnvVarsConfigured } from './auth-guides.js';
import { createLogger } from './logger.js';

const logger = createLogger('process-pool');

/** 受管理的程序條目 */
interface ManagedEntry {
  serverName: string;
  config: McpServerConfig;
  state: ProcessState;
  client: Client | null;
  transport: StdioClientTransport | null;
  retryCount: number;
  lastActivity: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  startPromise: Promise<Client> | null;
  authStatus: AuthStatus;
  lastError?: string;
}

export class ProcessPool {
  private readonly pool = new Map<string, ManagedEntry>();
  private readonly idleTimeoutMs: number;
  private readonly startupTimeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly config: GatewayConfig) {
    this.idleTimeoutMs = config.gateway.idle_timeout_ms;
    this.startupTimeoutMs = config.gateway.startup_timeout_ms;
    this.maxRetries = config.gateway.max_retries;

    // 初始化所有伺服器為 dormant 狀態，並預檢環境變數
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      const envCheck = checkEnvVarsConfigured(name, serverConfig.env);

      this.pool.set(name, {
        serverName: name,
        config: serverConfig,
        state: 'dormant',
        client: null,
        transport: null,
        retryCount: 0,
        lastActivity: Date.now(),
        idleTimer: null,
        startPromise: null,
        authStatus: envCheck.configured ? 'unknown' : 'not_configured',
        lastError: envCheck.configured ? undefined : `缺少環境變數: ${envCheck.missing.join(', ')}`,
      });
    }

    logger.info('程序池初始化完成', { serverCount: this.pool.size });
  }

  /** 取得 MCP Client（懶啟動） */
  async getClient(serverName: string): Promise<Client> {
    const entry = this.pool.get(serverName);
    if (!entry) throw new Error(`未知的 MCP 伺服器: ${serverName}`);

    this.resetIdleTimer(entry);

    // 已就緒：直接回傳
    if (entry.state === 'ready' && entry.client) {
      entry.lastActivity = Date.now();
      return entry.client;
    }

    // 正在啟動中：等待既有的 Promise（併發鎖）
    if (entry.state === 'starting' && entry.startPromise) {
      return entry.startPromise;
    }

    // dormant 或 failed：啟動
    return this.startServer(entry);
  }

  /** 啟動下游 MCP 子程序 */
  private startServer(entry: ManagedEntry): Promise<Client> {
    const { serverName, config: serverConfig } = entry;

    const promise = (async (): Promise<Client> => {
      entry.state = 'starting';
      logger.info(`啟動: ${serverName}`);

      try {
        // 建立傳輸層，完整繼承當前環境（確保認證資訊可用）
        const transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args,
          env: { ...process.env, ...(serverConfig.env ?? {}) } as Record<string, string>,
        });

        const client = new Client(
          { name: `multi-mcp-gateway/${serverName}`, version: '0.1.0' },
          { capabilities: {} },
        );

        // 超時保護
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`${serverName} 啟動超時 (${this.startupTimeoutMs}ms)`)),
            this.startupTimeoutMs,
          );
        });

        await Promise.race([client.connect(transport), timeout]);

        // 監聽傳輸層錯誤（用於崩潰偵測）
        transport.onerror = (err) => {
          logger.error(`${serverName}: 傳輸錯誤`, { error: String(err) });
          this.handleCrash(entry);
        };

        // 更新狀態
        entry.client = client;
        entry.transport = transport;
        entry.state = 'ready';
        entry.authStatus = 'valid';
        entry.retryCount = 0;
        entry.lastActivity = Date.now();
        entry.startPromise = null;
        entry.lastError = undefined;

        logger.info(`${serverName}: 啟動成功 ✅`);
        this.resetIdleTimer(entry);
        return client;
      } catch (err) {
        const errorMsg = (err as Error).message;
        entry.state = 'failed';
        entry.startPromise = null;
        entry.lastError = errorMsg;

        // 判斷是否為認證問題
        if (this.isAuthError(errorMsg)) {
          entry.authStatus = 'expired';
        } else {
          entry.authStatus = 'error';
        }

        logger.error(`${serverName}: 啟動失敗`, { error: errorMsg, retry: entry.retryCount });

        // 重試邏輯（指數退避）
        if (entry.retryCount < this.maxRetries) {
          entry.retryCount++;
          const backoff = Math.min(1000 * Math.pow(2, entry.retryCount), 10000);
          logger.info(`${serverName}: ${backoff}ms 後重試 (第 ${entry.retryCount} 次)`);
          await new Promise((r) => setTimeout(r, backoff));
          return this.startServer(entry);
        }

        entry.state = 'dormant';
        entry.retryCount = 0;
        throw new Error(`${serverName} 啟動失敗: ${errorMsg}`);
      }
    })();

    entry.startPromise = promise;
    return promise;
  }

  /** 處理子程序崩潰 */
  private handleCrash(entry: ManagedEntry): void {
    logger.warn(`${entry.serverName}: 程序崩潰，重置為休眠`);
    this.cleanupEntry(entry);
    entry.state = 'dormant';
    entry.authStatus = 'unknown';
  }

  /** 重置閒置回收計時器 */
  private resetIdleTimer(entry: ManagedEntry): void {
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    if (this.idleTimeoutMs > 0) {
      entry.idleTimer = setTimeout(() => {
        if (entry.state === 'ready') {
          logger.info(`${entry.serverName}: 閒置回收`);
          this.stopServer(entry.serverName).catch(() => {});
        }
      }, this.idleTimeoutMs);
    }
  }

  /** 停止指定伺服器 */
  async stopServer(serverName: string): Promise<void> {
    const entry = this.pool.get(serverName);
    if (!entry) return;
    this.cleanupEntry(entry);
    entry.state = 'dormant';
    entry.authStatus = 'unknown';
    logger.info(`${serverName}: 已停止`);
  }

  /** 清理程序資源 */
  private cleanupEntry(entry: ManagedEntry): void {
    if (entry.idleTimer) { clearTimeout(entry.idleTimer); entry.idleTimer = null; }
    if (entry.client) { try { entry.client.close().catch(() => {}); } catch { /**/ } entry.client = null; }
    if (entry.transport) { try { entry.transport.close().catch(() => {}); } catch { /**/ } entry.transport = null; }
    entry.startPromise = null;
  }

  /** 重新載入伺服器（更新認證後使用） */
  async reloadServer(serverName: string): Promise<void> {
    await this.stopServer(serverName);
    const entry = this.pool.get(serverName);
    if (entry) {
      const envCheck = checkEnvVarsConfigured(serverName, entry.config.env);
      entry.authStatus = envCheck.configured ? 'unknown' : 'not_configured';
      entry.lastError = envCheck.configured ? undefined : `缺少: ${envCheck.missing.join(', ')}`;
    }
    logger.info(`${serverName}: 已重載，下次呼叫使用新環境`);
  }

  /** 檢查伺服器是否已在池中 */
  hasServer(serverName: string): boolean {
    return this.pool.has(serverName);
  }

  /** 動態新增或更新伺服器到池中（掃描後呼叫） */
  addServer(serverName: string, serverConfig: McpServerConfig): void {
    const existing = this.pool.get(serverName);
    if (existing) {
      // 已存在：更新設定並重置狀態（下次呼叫時使用新設定啟動）
      this.cleanupEntry(existing);
      existing.config = serverConfig;
      existing.state = 'dormant';
      const envCheck = checkEnvVarsConfigured(serverName, serverConfig.env);
      existing.authStatus = envCheck.configured ? 'unknown' : 'not_configured';
      existing.lastError = envCheck.configured ? undefined : `缺少環境變數: ${envCheck.missing.join(', ')}`;
      logger.info(`${serverName}: 設定已更新`);
      return;
    }
    const envCheck = checkEnvVarsConfigured(serverName, serverConfig.env);
    this.pool.set(serverName, {
      serverName,
      config: serverConfig,
      state: 'dormant',
      client: null,
      transport: null,
      retryCount: 0,
      lastActivity: Date.now(),
      idleTimer: null,
      startPromise: null,
      authStatus: envCheck.configured ? 'unknown' : 'not_configured',
      lastError: envCheck.configured ? undefined : `缺少環境變數: ${envCheck.missing.join(', ')}`,
    });
    logger.info(`${serverName}: 動態新增到程序池`);
  }

  /**
   * 啟動健康自檢 — 對每個伺服器做輕量連線測試
   * 主動偵測認證問題，在第一次工具呼叫前就告知使用者
   */
  async healthCheck(): Promise<ServerHealthInfo[]> {
    logger.info('執行認證健康自檢');
    const results: ServerHealthInfo[] = [];

    for (const [name, entry] of this.pool) {
      // 先檢查環境變數
      const envCheck = checkEnvVarsConfigured(name, entry.config.env);
      if (!envCheck.configured) {
        entry.authStatus = 'not_configured';
        entry.lastError = `缺少環境變數: ${envCheck.missing.join(', ')}`;
        results.push({
          serverName: name, state: entry.state,
          authStatus: 'not_configured', lastChecked: Date.now(),
          lastError: entry.lastError,
        });
        continue;
      }

      // 嘗試短暫連線測試
      try {
        await this.getClient(name);
        entry.authStatus = 'valid';
        results.push({
          serverName: name, state: entry.state,
          authStatus: 'valid', lastChecked: Date.now(),
        });
        // 非 preload 伺服器測試完畢後釋放
        if (!entry.config.preload) {
          await this.stopServer(name);
        }
      } catch (err) {
        const errorMsg = (err as Error).message;
        const authStatus: AuthStatus = this.isAuthError(errorMsg) ? 'expired' : 'error';
        entry.authStatus = authStatus;
        entry.lastError = errorMsg;
        results.push({
          serverName: name, state: entry.state,
          authStatus, lastChecked: Date.now(), lastError: errorMsg,
        });
      }
    }

    const valid = results.filter((r) => r.authStatus === 'valid').length;
    const problems = results.filter((r) => r.authStatus !== 'valid');
    logger.info(`健康自檢完成: ${valid}/${results.length} 正常`, {
      problems: problems.map((p) => `${p.serverName}: ${p.authStatus}`),
    });

    return results;
  }

  /** 取得所有伺服器健康狀態 */
  getHealthInfo(): ServerHealthInfo[] {
    return Array.from(this.pool.values()).map((entry) => ({
      serverName: entry.serverName,
      state: entry.state,
      authStatus: entry.authStatus,
      lastChecked: entry.lastActivity,
      lastError: entry.lastError,
    }));
  }

  /** 判斷錯誤訊息是否與認證相關 */
  private isAuthError(message: string): boolean {
    const keywords = ['unauthorized', 'forbidden', '401', '403', 'auth', 'token', 'credential', 'permission'];
    return keywords.some((kw) => message.toLowerCase().includes(kw));
  }

  /** 預載指定伺服器 */
  async preloadServers(): Promise<void> {
    const names = Object.entries(this.config.mcpServers)
      .filter(([, c]) => c.preload).map(([n]) => n);
    if (names.length === 0) return;
    logger.info('預載伺服器', { servers: names });
    await Promise.allSettled(names.map((n) => this.getClient(n)));
  }

  /** 關閉所有伺服器 */
  async shutdownAll(): Promise<void> {
    logger.info('關閉所有下游 MCP');
    await Promise.allSettled(Array.from(this.pool.keys()).map((n) => this.stopServer(n)));
  }
}
