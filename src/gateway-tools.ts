/**
 * Multi-MCP Gateway — Gateway management tool metadata
 */
import type { SearchToolsResult, ToolRegistry } from './types.js';
import { GATEWAY_TOOL_PREFIX, NAMESPACE_SEPARATOR } from './types.js';
import { formatCategorySummaryText, generateCategorySummary } from './registry.js';

export interface GatewayToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const CALL_TOOL_NAME = `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}call_tool`;
const SEARCH_TOOL_NAME = `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}search_tools`;

export const GATEWAY_TOOL_DEFINITIONS: GatewayToolDefinition[] = [
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}auth_status`,
    description: '查看所有 MCP 伺服器的認證狀態（有效/過期/未設定）',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}auth_test`,
    description: '測試指定 MCP 伺服器的認證是否有效',
    inputSchema: {
      type: 'object',
      properties: { server_name: { type: 'string', description: '伺服器名稱' } },
      required: ['server_name'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}auth_guide`,
    description: '取得指定 MCP 伺服器的授權操作步驟指南',
    inputSchema: {
      type: 'object',
      properties: { server_name: { type: 'string', description: '伺服器名稱' } },
      required: ['server_name'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}server_status`,
    description: '查看所有下游 MCP 伺服器的運行狀態（JSON 格式）',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}reload_server`,
    description: '重新載入指定的 MCP 伺服器（更新密鑰或授權後使用）',
    inputSchema: {
      type: 'object',
      properties: { server_name: { type: 'string', description: '伺服器名稱' } },
      required: ['server_name'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}list_servers`,
    description: '列出所有已註冊的下游 MCP 伺服器及工具總數',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: SEARCH_TOOL_NAME,
    description: '',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜尋關鍵字，描述你需要的功能或想呼叫的下游工具' },
        server: { type: 'string', description: '可選，限定在某個下游伺服器內搜尋' },
        limit: { type: 'number', description: '回傳結果上限，預設 10' },
      },
      required: ['query'],
    },
  },
  {
    name: CALL_TOOL_NAME,
    description: [
      '呼叫下游 MCP 工具的 Gateway 真實執行入口。search_tools 與 list_server_tools 只負責探索；要實際執行 cartridge-system、GitHub、Sentry 等下游工具，必須呼叫本工具。',
      'name 必須是完整命名空間工具名，例如 cartridge-system__memory_audit、cartridge-system__workspace_brief、cartridge-system__commit_preflight。',
      'arguments 必須符合下游工具 inputSchema。參數不明時，先用 gateway__search_tools 或 gateway__list_server_tools 查 schema；不要自行猜參數名。例如 cartridge-system__memory_deps 使用 moduleName，不是 module。',
      '當使用者明確要求 Gateway MCP 真實呼叫時，不要用 stdio E2E、終端 handler、單元測試或其他替代方案取代本工具；替代方案只能標示為補充驗證。',
      'English discovery terms: call tool, call downstream MCP tool, Gateway call, invoke downstream tool.',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '完整的下游工具名稱（含命名空間前綴），例如 cartridge-system__memory_audit',
        },
        arguments: {
          type: 'object',
          description: '傳給下游工具的參數物件；必須符合該工具 inputSchema，未知時先查 gateway__list_server_tools 或 gateway__search_tools',
        },
        workspace: { type: 'string', description: '當前操作的目標專案絕對路徑，例如 d:\\BartenderMap' },
      },
      required: ['name', 'arguments', 'workspace'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}list_server_tools`,
    description: '列出指定下游伺服器的所有可用工具、描述與 schema。這是探索工具；確認 name 與 arguments 後，使用 gateway__call_tool 才會真實執行。',
    inputSchema: {
      type: 'object',
      properties: {
        server_name: { type: 'string', description: '下游伺服器名稱，例如 cartridge-system' },
      },
      required: ['server_name'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}rescan`,
    description: '重新掃描所有 MCP 並熱更新集成表（安裝、移除或下游工具數量變更後使用，無需重啟 Gateway）',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}set_workspace`,
    description: '設定 AI 工作的目標專案目錄路徑（讓 ESLint、Playwright、cartridge-system 等工具在正確的專案下執行）',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: '目標專案的絕對路徑，例如 d:\\BartenderMap' } },
      required: ['path'],
    },
  },
  {
    name: `${GATEWAY_TOOL_PREFIX}${NAMESPACE_SEPARATOR}get_workspace`,
    description: '查詢目前 Gateway 設定的工作目錄路徑',
    inputSchema: { type: 'object', properties: {} },
  },
];

export function buildGatewayTools(
  registry: ToolRegistry,
  categories: Record<string, string[]>,
): GatewayToolDefinition[] {
  const tools = GATEWAY_TOOL_DEFINITIONS.map((tool) => ({
    ...tool,
    inputSchema: structuredClone(tool.inputSchema),
  }));
  const searchTool = tools.find((tool) => tool.name === SEARCH_TOOL_NAME);
  if (!searchTool) return tools;

  const summaryText = formatCategorySummaryText(generateCategorySummary(registry, categories));
  searchTool.description = [
    '探索可用 Gateway 與下游 MCP 工具。此工具只負責搜尋與讀取 schema，不會執行下游工具。',
    '找到工具後，若要真實呼叫下游 MCP，請使用 gateway__call_tool。gateway__call_tool 是呼叫下游 MCP 工具的唯一 Gateway 入口。',
    '',
    '可用下游分類摘要：',
    summaryText,
    '',
    '用法：傳入需求關鍵字，回傳匹配工具與完整參數結構。可搜尋 call tool、呼叫工具、Gateway 呼叫、cartridge-system__memory_audit 等詞。',
    '參數不明時，先看回傳 inputSchema 或使用 gateway__list_server_tools；不要猜下游參數名稱。',
    '若使用者明確要求 Gateway MCP 真實呼叫，找不到入口或 schema 不明時應先回報卡點，不得改用 stdio、終端測試或 handler 測試宣稱通過。',
  ].join('\n');
  return tools;
}

export function searchGatewayTools(query: string, limit = 10): SearchToolsResult[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];

  const scored: Array<{ entry: SearchToolsResult; score: number }> = [];
  for (const tool of GATEWAY_TOOL_DEFINITIONS) {
    let score = 0;
    const nameLower = tool.name.toLowerCase();
    const descLower = tool.description.toLowerCase();
    const schemaLower = JSON.stringify(tool.inputSchema).toLowerCase();

    for (const kw of keywords) {
      if (nameLower.includes(kw)) score += 4;
      if (descLower.includes(kw)) score += 2;
      if (schemaLower.includes(kw)) score += 1;
      if (kw === 'call' || kw === '呼叫' || kw === 'invoke') {
        if (tool.name === CALL_TOOL_NAME) score += 8;
      }
      if (kw.includes('memory_audit') || kw.includes('workspace_brief') || kw.includes('commit_preflight')) {
        if (tool.name === CALL_TOOL_NAME) score += 8;
      }
    }

    if (score > 0) {
      scored.push({
        entry: {
          name: tool.name,
          server: GATEWAY_TOOL_PREFIX,
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        score,
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((result) => result.entry);
}

export function callToolSearchResult(): SearchToolsResult {
  const tool = GATEWAY_TOOL_DEFINITIONS.find((entry) => entry.name === CALL_TOOL_NAME);
  if (!tool) throw new Error('Gateway 本身缺少呼叫入口: gateway__call_tool');
  return {
    name: tool.name,
    server: GATEWAY_TOOL_PREFIX,
    description: tool.description,
    inputSchema: tool.inputSchema,
  };
}
