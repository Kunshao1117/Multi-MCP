/**
 * Multi-MCP Gateway — 閘道器主體
 * 使用 MCP SDK 建立 Server，聚合所有下游工具並處理請求
 * 含 12 個管理工具（基本 5 + 認證增值 3 + 工具路由 2 + 工作目錄 2）
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { GatewayConfig, ToolRegistry } from './types.js';
import { GATEWAY_TOOL_PREFIX, NAMESPACE_SEPARATOR } from './types.js';
import { ProcessPool } from './process-pool.js';
import { ToolRouter } from './tool-router.js';
import { generateCategorySummary, formatCategorySummaryText } from './registry.js';
import { createLogger } from './logger.js';

const logger = createLogger('gateway-server');

/** 閘道器管理工具定義（基本 + 認證增值） */
const GATEWAY_TOOLS = [
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}auth_status`,
    description: '查看所有 MCP 伺服器的認證狀態（有效/過期/未設定）',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}auth_test`,
    description: '測試指定 MCP 伺服器的認證是否有效',
    inputSchema: {
      type: 'object' as const,
      properties: { server_name: { type: 'string', description: '伺服器名稱' } },
      required: ['server_name'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}auth_guide`,
    description: '取得指定 MCP 伺服器的授權操作步驟指南',
    inputSchema: {
      type: 'object' as const,
      properties: { server_name: { type: 'string', description: '伺服器名稱' } },
      required: ['server_name'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}server_status`,
    description: '查看所有下游 MCP 伺服器的運行狀態（JSON 格式）',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}reload_server`,
    description: '重新載入指定的 MCP 伺服器（更新密鑰或授權後使用）',
    inputSchema: {
      type: 'object' as const,
      properties: { server_name: { type: 'string', description: '伺服器名稱' } },
      required: ['server_name'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}list_servers`,
    description: '列出所有已註冊的下游 MCP 伺服器及工具總數',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}search_tools`,
    description: '', // 動態產生，在 constructor 中設定
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: '搜尋關鍵字，描述你需要的功能' },
        server: { type: 'string', description: '可選，限定在某個伺服器內搜尋' },
        limit: { type: 'number', description: '回傳結果上限，預設 10' },
      },
      required: ['query'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}call_tool`,
    description: '呼叫透過 search_tools 找到的工具。name 為完整的命名空間名稱，arguments 為工具參數，workspace 為當前專案的絕對路徑（必填，AI 應從對話上下文中推斷）。',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: '完整的工具名稱（含命名空間前綴）' },
        arguments: { type: 'object', description: '傳給工具的參數物件' },
        workspace: { type: 'string', description: '當前操作的目標專案絕對路徑，例如 d:\\BartenderMap' },
      },
      required: ['name', 'arguments', 'workspace'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}list_server_tools`,
    description: '列出指定伺服器的所有可用工具名稱與描述。用於瀏覽特定分類下的工具。',
    inputSchema: {
      type: 'object' as const,
      properties: {
        server_name: { type: 'string', description: '伺服器名稱' },
      },
      required: ['server_name'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}rescan`,
    description: '重新掃描所有 MCP 並熱更新集成表（安裝或移除 MCP 後使用，無需重啟 Gateway）',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}set_workspace`,
    description: '設定 AI 工作的目標專案目錄路徑（讓 ESLint、Playwright 等工具在正確的專案下執行）',
    inputSchema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: '目標專案的絕對路徑，例如 d:\\BartenderMap' } },
      required: ['path'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}get_workspace`,
    description: '查詢目前 Gateway 設定的工作目錄路徑',
    inputSchema: { type: 'object' as const, properties: {} },
  },
];

export class GatewayServer {
  private server: Server;
  private processPool: ProcessPool;
  private toolRouter: ToolRouter;

  constructor(
    private readonly config: GatewayConfig,
    private readonly registry: ToolRegistry,
    private readonly initWorkspace: string | null = null,
  ) {
    this.processPool = new ProcessPool(config);
    this.toolRouter = new ToolRouter(registry, this.processPool, config, initWorkspace);

    // 動態產生 search_tools 描述（含分類總表）
    const summaries = generateCategorySummary(registry, config.categories ?? {});
    const summaryText = formatCategorySummaryText(summaries);
    const searchTool = GATEWAY_TOOLS.find(
      (t) => t.name === `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}search_tools`,
    );
    if (searchTool) {
      searchTool.description = [
        '當對話涉及以下情境，且你需要執行實際操作（非純討論）時，',
        '先用此工具搜尋可用的 MCP 工具：',
        '',
        summaryText,
        '',
        '用法：傳入描述你需求的關鍵字，回傳匹配工具含完整參數結構。',
        '找到後用 gateway__call_tool 呼叫。',
      ].join('\n');
    }

    this.server = new Server(
      { name: 'multi-mcp-gateway', version: '0.2.0' },
      { capabilities: { tools: {} } },
    );
    this.registerHandlers();

    logger.info('閘道器初始化完成', {
      downstreamTools: Object.keys(registry.all_tools).length,
      managementTools: GATEWAY_TOOLS.length,
      totalTools: Object.keys(registry.all_tools).length + GATEWAY_TOOLS.length,
    });
  }

  /** 註冊 MCP 請求處理器 */
  private registerHandlers(): void {
    // 處理 tools/list 請求
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [];
      // 只暴露閘道器管理工具（含動態發現工具）
      tools.push(...GATEWAY_TOOLS);
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
