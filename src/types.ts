/**
 * Multi-MCP Gateway — 共用型別定義
 */

/** 日誌等級 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 認證狀態 */
export type AuthStatus = 'valid' | 'expired' | 'not_configured' | 'unknown' | 'error';

/** 閘道器設定 */
export interface GatewayConfig {
  gateway: {
    idle_timeout_ms: number;
    startup_timeout_ms: number;
    max_retries: number;
    log_level: LogLevel;
    env_file?: string;
    health_check_on_start?: boolean;
    mcps_dir?: string;
  };
  categories?: Record<string, string[]>;
  mcpServers: Record<string, McpServerConfig>;
}

/** 單一下游 MCP 伺服器設定 */
export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  preload?: boolean;
}

/** 程序池中的程序狀態 */
export type ProcessState = 'dormant' | 'starting' | 'ready' | 'failed';

/** 伺服器認證健康資訊 */
export interface ServerHealthInfo {
  serverName: string;
  state: ProcessState;
  authStatus: AuthStatus;
  lastChecked: number;
  lastError?: string;
}

/** 集成表中的工具條目 */
export interface RegistryToolEntry {
  original_name: string;
  server_name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** 集成表結構 */
export interface ToolRegistry {
  version: string;
  generated_at: string;
  servers: Record<string, {
    tool_count: number;
    tools: Record<string, RegistryToolEntry>;
  }>;
  all_tools: Record<string, string>;
}

/** 工具路由解析結果 */
export interface ParsedToolName {
  serverName: string;
  originalToolName: string;
}

/** 認證指南 */
export interface AuthGuide {
  serverName: string;
  authType: 'env_token' | 'oauth_browser' | 'api_key' | 'none' | 'unknown';
  requiredEnvVars: string[];
  steps: string[];
  docsUrl?: string;
}

/** 工具搜尋結果 */
export interface SearchToolsResult {
  name: string;
  server: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** 分類總表條目 */
export interface CategorySummary {
  category: string;
  servers: string[];
  toolCount: number;
  highlights: string[];
}

export const GATEWAY_TOOL_PREFIX = 'gateway' as const;
export const NAMESPACE_SEPARATOR = '__' as const;
