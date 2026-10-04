/** Gateway stdio server with one idempotent shutdown path, including host EOF. */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { GatewayConfig, ToolRegistry } from './types.js';
import { ProcessPool } from './process-pool.js';
import { ToolRouter } from './tool-router.js';
import { buildGatewayTools } from './gateway-tools.js';
import { createLogger } from './logger.js';
import { getCoreVersion } from './version.js';

const logger = createLogger('gateway-server');
export interface GatewayContext { configPath?: string; registryPath?: string }

export class GatewayServer {
  private readonly server: Server;
  private readonly processPool: ProcessPool;
  private readonly toolRouter: ToolRouter;
  private shutdownPromise: Promise<void> | null = null;
  private started = false;
  private listenersInstalled = false;
  private readonly onShutdown = () => {
    void this.shutdown().catch((error) => {
      logger.error('Gateway 關閉失敗', { error: String(error) });
      process.exitCode = 1;
    });
  };

  constructor(private readonly config: GatewayConfig, registry: ToolRegistry, context: GatewayContext = {}) {
    this.processPool = new ProcessPool(config);
    this.toolRouter = new ToolRouter(registry, this.processPool, config, context);
    this.server = new Server({ name: 'multi-mcp-gateway', version: getCoreVersion() }, { capabilities: { tools: {} } });
    this.server.onclose = this.onShutdown;
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: buildGatewayTools(this.toolRouter.getRegistry(), this.toolRouter.getConfig().categories ?? {}),
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const { name, arguments: args } = request.params;
      try {
        if (this.shutdownPromise) throw new Error('Gateway 正在關閉');
        return await this.toolRouter.route(name, (args ?? {}) as Record<string, unknown>, { signal: extra.signal }) as {
          content: Array<{ type: 'text'; text: string }>;
        };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `錯誤: ${(error as Error).message}` }], isError: true };
      }
    });
  }

  async start(): Promise<void> {
    if (this.started || this.shutdownPromise) throw new Error('Gateway 已啟動或關閉');
    this.started = true;
    // Install before preload/health work so EOF or SIGTERM during initialize also cancels it.
    process.on('SIGINT', this.onShutdown);
    process.on('SIGTERM', this.onShutdown);
    process.stdin.on('end', this.onShutdown);
    process.stdin.on('close', this.onShutdown);
    this.listenersInstalled = true;
    if (process.stdin.readableEnded || process.stdin.destroyed) {
      await this.shutdown();
      return;
    }
    try {
      // Attach stdin before optional downstream initialization, otherwise a host EOF
      // can remain unread while a preloaded child is waiting for initialize.
      await this.server.connect(new StdioServerTransport());
      if (this.shutdownPromise) return;
      if (this.config.gateway.health_check_on_start) {
        const results = await this.processPool.healthCheck();
        const problems = results.filter((result) => !['valid', 'unknown'].includes(result.authStatus));
        if (problems.length) logger.warn('部分伺服器認證設定或連線異常', { servers: problems.map((result) => result.serverName) });
      }
      if (this.shutdownPromise) return;
      await this.processPool.preloadServers();
      if (this.shutdownPromise) return;
      logger.info('Gateway 已就緒，等待 IDE 呼叫');
    } catch (error) {
      const alreadyClosing = this.shutdownPromise !== null;
      await this.shutdown();
      if (!alreadyClosing) throw error;
    }
  }

  shutdown(): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    // Assign before calling close, which may synchronously invoke server.onclose.
    this.shutdownPromise = Promise.resolve().then(async () => {
      const results = await Promise.allSettled([this.processPool.shutdownAll(), this.server.close()]);
      process.stdin.pause();
      if (this.listenersInstalled) {
        process.off('SIGINT', this.onShutdown);
        process.off('SIGTERM', this.onShutdown);
        process.stdin.off('end', this.onShutdown);
        process.stdin.off('close', this.onShutdown);
        this.listenersInstalled = false;
      }
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failures.length) throw new AggregateError(failures.map((result) => result.reason), 'Gateway 清理失敗');
    });
    return this.shutdownPromise;
  }
}
