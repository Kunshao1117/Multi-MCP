/**
 * Multi-MCP Gateway — 工具路由引擎
 * 含認證錯誤優雅降級 + 閘道器管理工具（含增值功能）
 */
import path from 'node:path';
import type { ToolRegistry, ParsedToolName, SearchToolsResult } from './types.js';
import { NAMESPACE_SEPARATOR, GATEWAY_TOOL_PREFIX } from './types.js';
import type { ProcessPool } from './process-pool.js';
import { getAuthGuide, isAuthError } from './auth-guides.js';
import { searchTools, pruneRegistry } from './registry.js';
import { getConfigContext } from './config-loader.js';
import type { GatewayConfig } from './types.js';
import { callToolSearchResult, searchGatewayTools } from './gateway-tools.js';
import { createLogger } from './logger.js';

const logger = createLogger('tool-router');
function absoluteWorkspace(value: string): boolean {
  if (process.platform !== 'win32') return path.isAbsolute(value);
  return /^[A-Za-z]:[\\/]/.test(value) || /^\\\\[^\\/]+[\\/][^\\/]+/.test(value);
}

export interface RouteOptions { signal?: AbortSignal; workspace?: string }
export interface RouterContext { configPath?: string; registryPath?: string }

export class ToolRouter {
  constructor(
    private registry: ToolRegistry,
    private readonly processPool: ProcessPool,
    private config: GatewayConfig,
    private readonly context: RouterContext = {},
  ) { this.registry = this.enabledRegistry(registry); }

  private enabledRegistry(registry: ToolRegistry): ToolRegistry {
    const servers = Object.fromEntries(Object.entries(registry.servers).filter(([name]) => Object.prototype.hasOwnProperty.call(this.config.mcpServers, name)));
    const all_tools = Object.fromEntries(Object.entries(registry.all_tools).filter(([, name]) => name in servers));
    return { ...registry, servers, all_tools };
  }

  getRegistry(): ToolRegistry { return this.registry; }
  getConfig(): GatewayConfig { return this.config; }
  private rescanPromise?: Promise<unknown>;
  private mutationTail: Promise<void> = Promise.resolve();

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.mutationTail.then(operation);
    this.mutationTail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  private requireEnabled(name: string): void {
    if (!Object.prototype.hasOwnProperty.call(this.config.mcpServers, name)) {
      throw new Error(`server 未註冊、未啟用或已移除: ${name}。請重新掃描後確認可用下游 MCP。`);
    }
  }

  /** 熱替換集成表（掃描後呼叫） */
  updateRegistry(newRegistry: ToolRegistry): void {
    this.registry = this.enabledRegistry(newRegistry);
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
  async route(namespacedName: string, args: Record<string, unknown>, options: RouteOptions = {}): Promise<unknown> {
    const { serverName, originalToolName } = this.parseToolName(namespacedName);

    // 閘道器自身的管理工具
    if (serverName === GATEWAY_TOOL_PREFIX) {
      return this.handleGatewayTool(originalToolName, args, options);
    }

    // 驗證工具存在
    if (!this.registry.all_tools[namespacedName]) {
      const knownServer = this.registry.servers[serverName];
      if (!knownServer) {
        throw new Error(`server 未註冊: ${serverName}。請先用 gateway__list_servers 確認可用下游 MCP；若剛新增 MCP，請呼叫 gateway__rescan。`);
      }
      throw new Error(`工具不存在: ${namespacedName}。請先用 gateway__search_tools 或 gateway__list_server_tools 查詢正確工具名稱與 inputSchema。`);
    }

    this.requireEnabled(serverName);
    if (!options.workspace || !absoluteWorkspace(options.workspace)) throw new Error('請透過 gateway__call_tool 傳入 workspace 絕對路徑。');
    logger.info('路由呼叫', { tool: namespacedName, server: serverName });

    // 根據集成表中的 inputSchema 自動修正參數型別
    const toolEntry = this.registry.servers[serverName]?.tools[namespacedName];
    const coercedArgs = toolEntry
      ? this.coerceArgs(args, toolEntry.inputSchema)
      : args;
    const argumentDiagnostics = toolEntry
      ? this.formatArgumentDiagnostics(coercedArgs, toolEntry.inputSchema)
      : [];

    try {
      const result = await this.processPool.callTool(serverName, { name: originalToolName, arguments: coercedArgs }, options);
      return this.appendArgumentDiagnosticsToErrorResult(result, argumentDiagnostics);
    } catch (err) {
      const errorMsg = (err as Error).message;

      // 認證失敗 → 優雅降級：回傳操作指引而非原始錯誤碼
      if (isAuthError(err)) {
        const guide = getAuthGuide(serverName, this.config.mcpServers[serverName]?.env);

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

      throw new Error([
        `下游工具呼叫失敗: ${namespacedName}`,
        `錯誤: ${errorMsg}`,
        ...argumentDiagnostics,
        '請先用 gateway__search_tools 或 gateway__list_server_tools 查詢下游工具 inputSchema，arguments 必須使用真實參數名稱。',
      ].join('\n'));
    }
  }

  /** 處理閘道器管理工具 */
  private async handleGatewayTool(toolName: string, args: Record<string, unknown>, options: RouteOptions): Promise<unknown> {
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
          return `${icon} ${h.serverName}${h.workspace ? ` [${h.workspace}]` : ''}: ${h.authStatus} (${h.state})${detail}`;
        });
        return { content: [{ type: 'text' as const, text: statusLines.join('\n') || '目前沒有已設定的伺服器' }] };
      }

      case 'auth_test': {
        const serverName = args.server_name as string;
        if (!serverName) throw new Error('缺少 server_name 參數');
        this.requireEnabled(serverName);
        try {
          await this.processPool.getClient(serverName, options);
          return { content: [{ type: 'text' as const, text: `✅ ${serverName} 協定連線成功；金鑰與權限尚未驗證` }] };
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
        this.requireEnabled(serverName);
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
        return this.mutate(async () => {
          if (options.signal?.aborted) throw new Error('MCP operation cancelled');
          this.requireEnabled(serverName);
          await this.processPool.reloadServer(serverName);
          this.config = this.processPool.getConfig();
          const configPath = getConfigContext(this.config)?.configPath;
          const registryPath = this.context.registryPath ?? (configPath ? path.join(path.dirname(configPath), 'registry.json') : undefined);
          this.registry = registryPath ? pruneRegistry(this.config, registryPath) : this.enabledRegistry(this.registry);
          this.requireEnabled(serverName);
          return { content: [{ type: 'text' as const, text: `✅ 已重新載入 ${serverName}，下次呼叫時使用新的環境變數` }] };
        });
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
        const downstreamResults = searchTools(this.registry, query, { server, limit });
        const gatewayResults = server
          ? []
          : searchGatewayTools(query, limit ?? 10);
        const results = this.mergeSearchResults(query, gatewayResults, downstreamResults, limit ?? 10);
        if (results.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: [
                `沒有找到與 "${query}" 相關的工具。請嘗試其他關鍵字，或用 gateway__list_servers / gateway__list_server_tools 確認下游 server 與工具名稱。`,
                '若使用者要求 Gateway MCP 真實呼叫，找不到入口時請回報卡點，不要改用 stdio、終端 handler 或單元測試宣稱已完成 Gateway 驗證。',
              ].join('\n'),
            }],
          };
        }
        const formatted = results.map((r) =>
          `🔧 ${r.name}\n   類型: ${r.server === GATEWAY_TOOL_PREFIX ? 'Gateway 管理工具' : `下游 MCP 工具 (${r.server})`}\n   ${r.description}\n   參數: ${JSON.stringify(r.inputSchema)}`,
        ).join('\n\n');
        return {
          content: [{
            type: 'text' as const,
            text: [
              `找到 ${results.length} 個相關工具：`,
              '',
              formatted,
              '',
              '使用守則：gateway__search_tools / gateway__list_server_tools 只負責探索與查 schema；要真實執行下游 MCP，請用 gateway__call_tool，並讓 arguments 符合下游 inputSchema。',
            ].join('\n'),
          }],
        };
      }

      case 'call_tool': {
        const toolName = args.name as string;
        if (args.arguments !== undefined && (!args.arguments || typeof args.arguments !== 'object' || Array.isArray(args.arguments))) throw new Error('arguments 必須是 JSON object');
        const toolArgs = { ...(args.arguments ?? {}) as Record<string, unknown> };
        const callWorkspace = typeof args.workspace === 'string' ? args.workspace.trim() : '';
        if (!toolName) throw new Error('缺少 name 參數');
        if (!callWorkspace) {
          throw new Error('缺少 workspace 參數。gateway__call_tool 必須在每次呼叫時明確傳入當前專案絕對路徑，避免跨專案共用 Gateway 時誤用固定工作目錄。');
        }
        const parsed = this.parseToolName(toolName);
        if (parsed.serverName === GATEWAY_TOOL_PREFIX) {
          throw new Error('Gateway 呼叫入口使用錯誤: gateway__call_tool 只能呼叫下游 MCP 工具，不能包裝呼叫 Gateway 管理工具。');
        }
        if (!this.registry.servers[parsed.serverName]) {
          throw new Error(`server 未註冊: ${parsed.serverName}。請先用 gateway__list_servers 確認可用下游 MCP。`);
        }
        if (!this.registry.all_tools[toolName]) {
          throw new Error(`工具不存在: ${toolName}。請先用 gateway__search_tools 或 gateway__list_server_tools 查詢正確工具名稱與 inputSchema。`);
        }

        this.requireEnabled(parsed.serverName);
        if (!absoluteWorkspace(callWorkspace)) throw new Error('workspace 必須是此主機的絕對路徑');
        const effectiveWorkspace = path.resolve(callWorkspace);
        const schema = this.registry.servers[parsed.serverName].tools[toolName]?.inputSchema;
        const properties = schema?.properties as Record<string, unknown> | undefined;
        // Inject only into a declared schema field. Strict tools must not receive an invented argument.
        if (properties && Object.prototype.hasOwnProperty.call(properties, 'projectRoot')) {
          if ('projectRoot' in toolArgs && (typeof toolArgs.projectRoot !== 'string'
            || !absoluteWorkspace(toolArgs.projectRoot)
            || path.resolve(toolArgs.projectRoot) !== effectiveWorkspace)) {
            throw new Error('projectRoot 與 workspace 必須是相同的專案絕對路徑');
          }
          toolArgs.projectRoot = effectiveWorkspace;
        }
        return this.route(toolName, toolArgs, { ...options, workspace: effectiveWorkspace });
      }

      case 'list_server_tools': {
        const serverName = args.server_name as string;
        if (!serverName) throw new Error('缺少 server_name 參數');
        this.requireEnabled(serverName);
        const serverEntry = this.registry.servers[serverName];
        if (!serverEntry) throw new Error(`server 未註冊: ${serverName}。請先用 gateway__list_servers 確認可用下游 MCP。`);
        const list = Object.entries(serverEntry.tools).map(([ns, t]) =>
          `• ${ns} — ${t.description}\n  inputSchema: ${JSON.stringify(t.inputSchema)}`,
        ).join('\n');
        const actualToolCount = Object.keys(serverEntry.tools).length;
        return {
          content: [{
            type: 'text' as const,
            text: [
              `${serverName} 共有 ${actualToolCount} 個工具：`,
              ...(serverEntry.stale ? ['⚠️ 上次掃描失敗；以下為最後可用快取，可能已過期。'] : []),
              '',
              list,
              '',
              '這是探索結果，不代表已執行工具。要透過 Gateway 真實呼叫下游 MCP，請使用 gateway__call_tool，並讓 arguments 符合上方 inputSchema。',
            ].join('\n'),
          }],
        };
      }

      case 'rescan': {
        if (this.rescanPromise) return this.rescanPromise;
        this.rescanPromise = this.mutate(() => this.rescan(options)).finally(() => { this.rescanPromise = undefined; });
        return this.rescanPromise;
      }

      default:
        throw new Error(`Gateway 本身缺少呼叫入口或管理工具不存在: gateway__${toolName}`);
    }
  }

  private async rescan(options: RouteOptions): Promise<unknown> {
    if (options.signal?.aborted) throw new Error('MCP scan cancelled');
    const { scanAndGenerateRegistry } = await import('./registry.js');
    const { getConfigContext, loadConfig, reloadConfig } = await import('./config-loader.js');
    const freshConfig = getConfigContext(this.config) || !this.context.configPath ? reloadConfig(this.config) : loadConfig(this.context.configPath);
    // Drain removed or changed runtimes before publishing their replacement discovery snapshot.
    await this.processPool.reconcile(freshConfig);
    this.config = freshConfig;
    this.registry = this.enabledRegistry(this.registry);
    const newRegistry = await scanAndGenerateRegistry(freshConfig, this.context.registryPath, { signal: options.signal });
    this.updateRegistry(newRegistry);
    const failed = Object.entries(newRegistry.servers).filter(([, value]) => value.stale).map(([name]) => name);
    return { content: [{ type: 'text', text: failed.length
      ? `⚠️ 部分掃描失敗：${failed.join(', ')}；保留可用舊快取，請修正後重試。`
      : `✅ 重新掃描完成！共 ${Object.keys(newRegistry.all_tools).length} 個工具已更新` }], isError: failed.length > 0 };
  }

  private mergeSearchResults(
    query: string,
    gatewayResults: SearchToolsResult[],
    downstreamResults: SearchToolsResult[],
    limit: number,
  ): SearchToolsResult[] {
    const shouldExposeCallTool = downstreamResults.length > 0 || /call|invoke|呼叫|gateway/i.test(query);
    const merged = [...gatewayResults, ...downstreamResults];
    if (shouldExposeCallTool && !merged.some((r) => r.name === 'gateway__call_tool')) {
      merged.unshift(callToolSearchResult());
    }

    const seen = new Set<string>();
    return merged
      .filter((result) => {
        if (seen.has(result.name)) return false;
        seen.add(result.name);
        return true;
      })
      .sort((a, b) => {
        if (a.name === 'gateway__call_tool') return -1;
        if (b.name === 'gateway__call_tool') return 1;
        return 0;
      })
      .slice(0, limit);
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
        if (value.trim() !== '' && Number.isFinite(num) && (expectedType !== 'integer' || Number.isInteger(num))) result[key] = num;
      } else if (expectedType === 'boolean' && typeof value === 'string') {
        if (value === 'true') result[key] = true;
        else if (value === 'false') result[key] = false;
      } else if (expectedType === 'string' && typeof value === 'number') {
        result[key] = String(value);
      }
    }
    if (Object.keys(result).some((k) => result[k] !== args[k])) {
      logger.info('參數型別強轉', { changes: Object.keys(result).filter((key) => result[key] !== args[key]).map((key) => ({ key, fromType: typeof args[key], toType: typeof result[key] })) });
    }
    return result;
  }

  private appendArgumentDiagnosticsToErrorResult(result: unknown, diagnostics: string[]): unknown {
    if (diagnostics.length === 0 || !this.isValidationErrorResult(result)) return result;
    const content = (result as { content?: unknown }).content;
    if (!Array.isArray(content)) return result;

    return {
      ...(result as Record<string, unknown>),
      content: [
        ...content,
        {
          type: 'text' as const,
          text: [
            'Gateway 參數診斷:',
            ...diagnostics.map((line) => line.replace(/^參數診斷:$/, '').trim()).filter(Boolean),
            '請先用 gateway__search_tools 或 gateway__list_server_tools 查詢下游工具 inputSchema，arguments 必須使用真實參數名稱。',
          ].join('\n'),
        },
      ],
    };
  }

  private isValidationErrorResult(result: unknown): boolean {
    if (!result || typeof result !== 'object') return false;
    const maybeResult = result as { isError?: unknown; content?: unknown };
    if (maybeResult.isError === true) return true;
    if (!Array.isArray(maybeResult.content)) return false;

    return maybeResult.content.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const text = (item as { text?: unknown }).text;
      if (typeof text !== 'string') return false;
      const lowerText = text.toLowerCase();
      if (lowerText.includes('validation error') || lowerText.includes('schema validation')) return true;

      try {
        const parsed = JSON.parse(text) as { status?: unknown; findings?: unknown };
        return parsed.status === 'error'
          && Array.isArray(parsed.findings)
          && parsed.findings.some((finding) => {
            if (!finding || typeof finding !== 'object') return false;
            const code = (finding as { code?: unknown }).code;
            return typeof code === 'string' && code.toLowerCase().includes('validation');
          });
      } catch {
        return false;
      }
    });
  }

  /** 根據 inputSchema 產生保守的參數錯誤診斷，不自動修正或重試 */
  private formatArgumentDiagnostics(
    args: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): string[] {
    const properties = schema['properties'] as Record<string, unknown> | undefined;
    if (!properties) {
      return ['參數診斷: Gateway 無法從 inputSchema 判斷可用參數，請先查詢下游工具 schema。'];
    }

    const acceptedKeys = Object.keys(properties);
    const receivedKeys = Object.keys(args);
    const unknownKeys = receivedKeys.filter((key) => !acceptedKeys.includes(key));
    const required = Array.isArray(schema['required'])
      ? (schema['required'] as unknown[]).filter((key): key is string => typeof key === 'string')
      : [];
    const missingRequired = required.filter((key) => !(key in args));

    const diagnostics = ['參數診斷:'];
    if (unknownKeys.length > 0) {
      diagnostics.push(`- 收到未知參數: ${unknownKeys.join(', ')}`);
      const suggestions = unknownKeys
        .map((key) => {
          const suggestion = this.findSimilarArgumentName(key, acceptedKeys);
          return suggestion ? `${key} -> ${suggestion}` : undefined;
        })
        .filter((item): item is string => Boolean(item));
      if (suggestions.length > 0) {
        diagnostics.push(`- 疑似應改用: ${suggestions.join(', ')}`);
      }
    }
    if (missingRequired.length > 0) {
      diagnostics.push(`- 缺少必要參數: ${missingRequired.join(', ')}`);
    }
    diagnostics.push(`- 此工具接受的 arguments: ${acceptedKeys.length > 0 ? acceptedKeys.join(', ') : '(無)'}`);

    return diagnostics;
  }

  private findSimilarArgumentName(receivedKey: string, acceptedKeys: string[]): string | undefined {
    const normalizedReceived = this.normalizeArgumentName(receivedKey);
    if (!normalizedReceived) return undefined;

    return acceptedKeys.find((acceptedKey) => {
      const normalizedAccepted = this.normalizeArgumentName(acceptedKey);
      return normalizedAccepted.startsWith(normalizedReceived)
        || normalizedReceived.startsWith(normalizedAccepted);
    });
  }

  private normalizeArgumentName(key: string): string {
    return key.toLowerCase().replace(/[\s_-]/g, '');
  }

}
