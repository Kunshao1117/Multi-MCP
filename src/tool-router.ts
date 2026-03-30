/**
 * Multi-MCP Gateway — 工具路由引擎
 * 含認證錯誤優雅降級 + 閘道器管理工具（含增值功能）
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ToolRegistry, ParsedToolName } from './types.js';
import { NAMESPACE_SEPARATOR, GATEWAY_TOOL_PREFIX } from './types.js';
import type { ProcessPool } from './process-pool.js';
import { getAuthGuide } from './auth-guides.js';
import { searchTools } from './registry.js';
import type { GatewayConfig } from './types.js';
import { createLogger } from './logger.js';

const logger = createLogger('tool-router');
const AUTH_KEYWORDS = ['unauthorized', 'forbidden', '401', '403', 'auth', 'token', 'credential'];

export class ToolRouter {
  /** 目前設定的目標專案工作目錄（由 gateway__set_workspace 設定） */
  private workspacePath: string | null = null;

  constructor(
    private registry: ToolRegistry,
    private readonly processPool: ProcessPool,
    private readonly config: GatewayConfig,
    initWorkspace: string | null = null,
  ) {
    // 若啟動時已偵測到工作目錄，直接初始化
    this.workspacePath = initWorkspace;
  }

  /** 熱替換集成表（掃描後呼叫） */
  updateRegistry(newRegistry: ToolRegistry): void {
    this.registry = newRegistry;
  }

  /** 解析帶有命名空間前綴的工具名稱 */
  parseToolName(namespacedName: string): ParsedToolName {
    const idx = namespacedName.indexOf(NAMESPACE_SEPARATOR);
    if (idx === -1) {
      throw new Error(`工具名稱格式錯誤，缺少命名空間前綴: ${namespacedName}`);
    }
    return {
      serverName: namespacedName.substring(0, idx),
      originalToolName: namespacedName.substring(idx + NAMESPACE_SEPARATOR.length),
    };
  }

  /** 路由工具呼叫到正確的下游 MCP */
  async route(namespacedName: string, args: Record<string, unknown>): Promise<unknown> {
    const { serverName, originalToolName } = this.parseToolName(namespacedName);

    // 閘道器自身的管理工具
    if (serverName === GATEWAY_TOOL_PREFIX) {
      return this.handleGatewayTool(originalToolName, args);
    }

    // 驗證工具存在
    if (!this.registry.all_tools[namespacedName]) {
      throw new Error(`未知的工具: ${namespacedName}`);
    }

    logger.info('路由呼叫', { tool: namespacedName, server: serverName });
    const client = await this.processPool.getClient(serverName);

    // 根據集成表中的 inputSchema 自動修正參數型別
    const toolEntry = this.registry.servers[serverName]?.tools[namespacedName];
    const coercedArgs = toolEntry
      ? this.coerceArgs(args, toolEntry.inputSchema)
      : args;

    try {
      return await client.callTool({ name: originalToolName, arguments: coercedArgs });
    } catch (err) {
      const errorMsg = (err as Error).message;

      // 認證失敗 → 優雅降級：回傳操作指引而非原始錯誤碼
      if (this.isAuthError(errorMsg)) {
        const guide = getAuthGuide(serverName, this.config.mcpServers[serverName]?.env);
        await this.processPool.reloadServer(serverName);

        return {
          content: [{
            type: 'text' as const,
            text: [
              `⚠️ ${serverName} 認證失敗`,
              '',
              `錯誤: ${errorMsg}`,
              '',
              '📋 修復步驟:',
              ...guide.steps,
              '',
              guide.docsUrl ? `📖 文件: ${guide.docsUrl}` : '',
              '',
              '修復完成後，呼叫 gateway__reload_server 即可重新連線。',
            ].filter(Boolean).join('\n'),
          }],
          isError: true,
        };
      }

      throw err;
    }
  }

  /** 處理閘道器管理工具 */
  private async handleGatewayTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      // === 認證增值工具 ===

      case 'auth_status': {
        const healthInfo = this.processPool.getHealthInfo();
        const statusLines = healthInfo.map((h) => {
          const icon = h.authStatus === 'valid' ? '✅'
            : h.authStatus === 'not_configured' ? '⚙️'
            : h.authStatus === 'expired' ? '❌'
            : h.authStatus === 'error' ? '💥'
            : '❓';
          const detail = h.lastError ? ` — ${h.lastError}` : '';
          return `${icon} ${h.serverName}: ${h.authStatus} (${h.state})${detail}`;
        });
        return { content: [{ type: 'text' as const, text: statusLines.join('\n') || '目前沒有已設定的伺服器' }] };
      }

      case 'auth_test': {
        const serverName = args.server_name as string;
        if (!serverName) throw new Error('缺少 server_name 參數');
        try {
          await this.processPool.getClient(serverName);
          return { content: [{ type: 'text' as const, text: `✅ ${serverName} 認證有效，連線成功` }] };
        } catch (err) {
          const guide = getAuthGuide(serverName, this.config.mcpServers[serverName]?.env);
          return {
            content: [{
              type: 'text' as const,
              text: [
                `❌ ${serverName} 認證測試失敗`,
                `錯誤: ${(err as Error).message}`,
                '',
                '📋 修復步驟:',
                ...guide.steps,
                guide.docsUrl ? `\n📖 文件: ${guide.docsUrl}` : '',
              ].filter(Boolean).join('\n'),
            }],
            isError: true,
          };
        }
      }

      case 'auth_guide': {
        const serverName = args.server_name as string;
        if (!serverName) throw new Error('缺少 server_name 參數');
        const guide = getAuthGuide(serverName, this.config.mcpServers[serverName]?.env);
        return {
          content: [{
            type: 'text' as const,
            text: [
              `📋 ${serverName} 授權指南`,
              `認證方式: ${guide.authType}`,
              guide.requiredEnvVars.length > 0 ? `需要的環境變數: ${guide.requiredEnvVars.join(', ')}` : '',
              '',
              '操作步驟:',
              ...guide.steps,
              guide.docsUrl ? `\n📖 官方文件: ${guide.docsUrl}` : '',
            ].filter(Boolean).join('\n'),
          }],
        };
      }

      // === 基本管理工具 ===

      case 'server_status':
        return { content: [{ type: 'text' as const, text: JSON.stringify(this.processPool.getHealthInfo(), null, 2) }] };

      case 'reload_server': {
        const serverName = args.server_name as string;
        if (!serverName) throw new Error('缺少 server_name 參數');
        await this.processPool.reloadServer(serverName);
        return { content: [{ type: 'text' as const, text: `✅ 已重新載入 ${serverName}，下次呼叫時使用新的環境變數` }] };
      }

      case 'list_servers':
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              servers: Object.keys(this.registry.servers),
              total_tools: Object.keys(this.registry.all_tools).length,
            }, null, 2),
          }],
        };

      case 'search_tools': {
        const query = args.query as string;
        if (!query) throw new Error('缺少 query 參數');
        const server = args.server as string | undefined;
        const limit = args.limit as number | undefined;
        const results = searchTools(this.registry, query, { server, limit });
        if (results.length === 0) {
          return { content: [{ type: 'text' as const, text: `沒有找到與 "${query}" 相關的工具。請嘗試其他關鍵字。` }] };
        }
        const formatted = results.map((r) =>
          `🔧 ${r.name}\n   ${r.description}\n   參數: ${JSON.stringify(r.inputSchema)}`,
        ).join('\n\n');
        return { content: [{ type: 'text' as const, text: `找到 ${results.length} 個相關工具：\n\n${formatted}` }] };
      }

      case 'call_tool': {
        const toolName = args.name as string;
        const toolArgs = (args.arguments ?? {}) as Record<string, unknown>;
        const callWorkspace = args.workspace as string | undefined;
        if (!toolName) throw new Error('缺少 name 參數');
        // 本次呼叫暫時套用 workspace，結束後自動還原（不污染全局狀態）
        const previousWorkspace = this.workspacePath;
        if (callWorkspace) this.workspacePath = callWorkspace;

        // ── projectRoot 智慧填充 ──
        const effectiveWorkspace = this.workspacePath;
        if (effectiveWorkspace && typeof toolArgs.projectRoot === 'string') {
          const agentsAtArg = path.join(toolArgs.projectRoot, '.agents');
          const agentsAtWs = path.join(effectiveWorkspace, '.agents');
          if (!fs.existsSync(agentsAtArg) && fs.existsSync(agentsAtWs)) {
            logger.info('projectRoot 自動修正', {
              from: toolArgs.projectRoot,
              to: effectiveWorkspace,
            });
            toolArgs.projectRoot = effectiveWorkspace;
          }
        } else if (effectiveWorkspace && !('projectRoot' in toolArgs)) {
          toolArgs.projectRoot = effectiveWorkspace;
          logger.info('projectRoot 自動注入', { value: effectiveWorkspace });
        }

        try {
          return await this.route(toolName, toolArgs);
        } finally {
          this.workspacePath = previousWorkspace;
        }
      }

      case 'list_server_tools': {
        const serverName = args.server_name as string;
        if (!serverName) throw new Error('缺少 server_name 參數');
        const serverEntry = this.registry.servers[serverName];
        if (!serverEntry) throw new Error(`找不到伺服器: ${serverName}`);
        const list = Object.entries(serverEntry.tools).map(([ns, t]) =>
          `• ${ns} — ${t.description}`,
        ).join('\n');
        return {
          content: [{
            type: 'text' as const,
            text: `${serverName} 共有 ${serverEntry.tool_count} 個工具：\n\n${list}`,
          }],
        };
      }

      case 'rescan': {
        const { scanAndGenerateRegistry } = await import('./registry.js');
        const { loadConfig } = await import('./config-loader.js');
        const freshConfig = loadConfig();
        const newRegistry = await scanAndGenerateRegistry(freshConfig);
        this.updateRegistry(newRegistry);
        // 同步所有伺服器設定到程序池（新增或更新）
        for (const name of Object.keys(freshConfig.mcpServers)) {
          this.processPool.addServer(name, freshConfig.mcpServers[name]);
        }
        const total = Object.keys(newRegistry.all_tools).length;
        return { content: [{ type: 'text' as const, text: `✅ 重新掃描完成！共 ${total} 個工具已更新` }] };
      }

      case 'set_workspace': {
        const wsPath = args.path as string;
        if (!wsPath) throw new Error('缺少 path 參數');
        this.workspacePath = wsPath;
        logger.info('工作目錄已設定', { path: wsPath });
        return { content: [{ type: 'text' as const, text: `✅ 工作目錄已設定為: ${wsPath}` }] };
      }

      case 'get_workspace':
        return {
          content: [{
            type: 'text' as const,
            text: this.workspacePath
              ? `📁 目前工作目錄: ${this.workspacePath}`
              : '⚠️ 尚未設定工作目錄。請使用 gateway__set_workspace 設定，例如: { "path": "d:\\\\BartenderMap" }',
          }],
        };

      default:
        throw new Error(`未知的管理工具: ${toolName}`);
    }
  }

  /** 根據 inputSchema 自動修正參數型別（容錯強轉） */
  private coerceArgs(
    args: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): Record<string, unknown> {
    const properties = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
    if (!properties) return args;

    const result = { ...args };
    for (const [key, value] of Object.entries(result)) {
      const propSchema = properties[key];
      if (!propSchema) continue;
      const expectedType = propSchema['type'] as string | undefined;
      if (!expectedType) continue;

      if ((expectedType === 'number' || expectedType === 'integer') && typeof value === 'string') {
        const num = Number(value);
        if (!Number.isNaN(num)) result[key] = num;
      } else if (expectedType === 'boolean' && typeof value === 'string') {
        if (value === 'true') result[key] = true;
        else if (value === 'false') result[key] = false;
      } else if (expectedType === 'string' && typeof value === 'number') {
        result[key] = String(value);
      }
    }
    if (Object.keys(result).some((k) => result[k] !== args[k])) {
      logger.info('參數型別強轉', { before: args, after: result });
    }
    return result;
  }

  /** 判斷錯誤訊息是否與認證相關 */
  private isAuthError(message: string): boolean {
    return AUTH_KEYWORDS.some((kw) => message.toLowerCase().includes(kw));
  }
}
