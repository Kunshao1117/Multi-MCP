/**
 * Multi-MCP Gateway — 集成表引擎
 * 掃描下游 MCP 生成工具目錄 / 載入已生成的目錄
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { GatewayConfig, ToolRegistry, RegistryToolEntry, SearchToolsResult, CategorySummary } from './types.js';
import { NAMESPACE_SEPARATOR } from './types.js';
import { createLogger } from './logger.js';

const logger = createLogger('registry');
const DEFAULT_REGISTRY_PATH = 'registry.json';

/** 載入已生成的集成表 */
export function loadRegistry(registryPath?: string): ToolRegistry {
  const resolvedPath = resolve(registryPath ?? DEFAULT_REGISTRY_PATH);
  logger.info('載入集成表', { path: resolvedPath });

  let rawContent: string;
  try {
    rawContent = readFileSync(resolvedPath, 'utf-8');
  } catch {
    logger.warn('集成表不存在，請先執行 npm run scan');
    return { version: '1.0.0', generated_at: new Date().toISOString(), servers: {}, all_tools: {} };
  }

  const registry = JSON.parse(rawContent) as ToolRegistry;
  logger.info('集成表載入成功', {
    toolCount: Object.keys(registry.all_tools).length,
    servers: Object.keys(registry.servers),
  });
  return registry;
}

/** 將工具名稱加上伺服器前綴 */
export function namespaceTool(serverName: string, toolName: string): string {
  return `${serverName}${NAMESPACE_SEPARATOR}${toolName}`;
}

/**
 * 掃描所有下游 MCP 並生成集成表
 * 依序連接每個 MCP，取得工具清單，然後關閉
 */
export async function scanAndGenerateRegistry(
  config: GatewayConfig,
  registryPath?: string,
): Promise<ToolRegistry> {
  const resolvedPath = resolve(registryPath ?? DEFAULT_REGISTRY_PATH);
  logger.info('開始掃描下游 MCP', { serverCount: Object.keys(config.mcpServers).length });

  const registry: ToolRegistry = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    servers: {},
    all_tools: {},
  };

  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    logger.info(`掃描: ${serverName}`, { command: serverConfig.command });
    let transport: StdioClientTransport | null = null;

    try {
      transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: { ...process.env, ...(serverConfig.env ?? {}) } as Record<string, string>,
      });

      const client = new Client(
        { name: 'multi-mcp-scanner', version: '0.1.0' },
        { capabilities: {} },
      );
      await client.connect(transport);

      const toolsResult = await client.listTools();
      const tools = toolsResult.tools ?? [];
      logger.info(`${serverName}: 發現 ${tools.length} 個工具`);

      const serverTools: Record<string, RegistryToolEntry> = {};
      for (const tool of tools) {
        const ns = namespaceTool(serverName, tool.name);
        serverTools[ns] = {
          original_name: tool.name,
          server_name: serverName,
          description: tool.description ?? '',
          inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {},
        };
        registry.all_tools[ns] = serverName;
      }
      registry.servers[serverName] = { tool_count: tools.length, tools: serverTools };
      await client.close();
    } catch (err) {
      logger.error(`掃描 ${serverName} 失敗`, { error: (err as Error).message });
      registry.servers[serverName] = { tool_count: 0, tools: {} };
    } finally {
      try { if (transport) await transport.close(); } catch { /* 忽略關閉錯誤 */ }
    }
  }

  writeFileSync(resolvedPath, JSON.stringify(registry, null, 2), 'utf-8');
  logger.info('集成表產生完成', { totalTools: Object.keys(registry.all_tools).length });
  return registry;
}

/** 模糊搜尋工具清冊 */
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

/** 從集成表 + 分類設定產生分類總表 */
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
      toolCount += serverEntry.tool_count;
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
      uncatToolCount += entry.tool_count;
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

/** 將分類總表格式化為精簡文字（嵌入工具描述用） */
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
