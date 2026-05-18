/**
 * Multi-MCP Gateway — 閘道器主體
 * 使用 MCP SDK 建立 Server，聚合所有下游工具並處理請求
 * 含 10 個管理工具（基本 5 + 認證增值 3 + 工具路由 2）
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { GatewayConfig, ToolRegistry } from './types.js';
import { ProcessPool } from './process-pool.js';
import { ToolRouter } from './tool-router.js';
import { buildGatewayTools, type GatewayToolDefinition } from './gateway-tools.js';
import { createLogger } from './logger.js';

const logger = createLogger('gateway-server');

export class GatewayServer {
  private server: Server;
  private processPool: ProcessPool;
  private toolRouter: ToolRouter;
  private gatewayTools: GatewayToolDefinition[];

  constructor(
    private readonly config: GatewayConfig,
    private readonly registry: ToolRegistry,
  ) {
    this.processPool = new ProcessPool(config);
    this.toolRouter = new ToolRouter(registry, this.processPool, config);
    this.gatewayTools = buildGatewayTools(registry, config.categories ?? {});

    this.server = new Server(
      { name: 'multi-mcp-gateway', version: '1.1.0' },
      { capabilities: { tools: {} } },
    );
    this.registerHandlers();

    logger.info('閘道器初始化完成', {
      downstreamTools: Object.keys(registry.all_tools).length,
      managementTools: this.gatewayTools.length,
      totalTools: Object.keys(registry.all_tools).length + this.gatewayTools.length,
    });
  }

  /** 註冊 MCP 請求處理器 */
  private registerHandlers(): void {
    // 處理 tools/list 請求
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [];
      // 只暴露閘道器管理工具（含動態發現工具）
      tools.push(...this.gatewayTools);
      return { tools };
    });

    // 處理 tools/call 請求
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        return await this.toolRouter.route(name, (args ?? {}) as Record<string, unknown>) as {
          content: Array<{ type: 'text'; text: string }>;
        };
      } catch (err) {
        logger.error('工具呼叫失敗', { tool: name, error: (err as Error).message });
        return { content: [{ type: 'text' as const, text: `錯誤: ${(err as Error).message}` }], isError: true };
      }
    });
  }

  /** 啟動伺服器（stdio 模式） */
  async start(): Promise<void> {
    logger.info('啟動 Multi-MCP Gateway');

    // 啟動健康自檢（如設定中啟用）
    if (this.config.gateway.health_check_on_start) {
      const results = await this.processPool.healthCheck();
      const problems = results.filter((r) => r.authStatus !== 'valid');
      if (problems.length > 0) {
        logger.warn('部分伺服器認證異常', {
          problems: problems.map((p) => `${p.serverName}: ${p.authStatus}`),
        });
      }
    }

    // 預載
    await this.processPool.preloadServers();

    // 連接 stdio 傳輸層
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Gateway 已就緒，等待 IDE 呼叫');

    // 優雅關閉
    const shutdown = async () => {
      logger.info('正在關閉...');
      await this.processPool.shutdownAll();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}
