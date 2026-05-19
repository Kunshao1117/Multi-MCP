import type { AuthStatus, McpServerConfig } from '../types.js';

export interface ManagementOptions {
  dataDir?: string;
}

export interface GatewayStatus {
  packageVersion: string;
  dataDir: string;
  configPath: string;
  envPath: string;
  credentialsPath: string;
  registryPath: string;
  mcpsDir: string;
  initialized: boolean;
  enabledServers: number;
  disabledServers: number;
  totalServers: number;
  totalTools: number;
  registryGeneratedAt?: string;
}

export interface CredentialSummary {
  authType: 'env_token' | 'oauth_browser' | 'api_key' | 'none';
  envVar: string;
  active?: string;
  accountCount: number;
  maskedValue?: string;
}

export interface McpToolSummary {
  name: string;
  originalName: string;
  description: string;
}

export interface McpServerSummary {
  name: string;
  category: string;
  enabled: boolean;
  configPath: string;
  config: McpServerConfig;
  sourceType: 'npm' | 'remote' | 'custom';
  source: string;
  packageName?: string;
  toolCount: number;
  tools: McpToolSummary[];
  authStatus: AuthStatus;
  requiredEnvVars: string[];
  credential?: CredentialSummary;
}

export interface McpInstallInput {
  name: string;
  category: string;
  source?: string;
  config?: McpServerConfig;
  credential?: Omit<CredentialInput, 'mcpName'>;
  overwrite?: boolean;
  rescan?: boolean;
}

export interface McpUpdateInput {
  currentName: string;
  nextName: string;
  category: string;
  config: McpServerConfig;
  rescan?: boolean;
}

export interface CredentialInput {
  mcpName: string;
  label: string;
  value: string;
  envVar: string;
  authType?: CredentialSummary['authType'];
}

export interface VersionCheckResult {
  name: string;
  enabled: boolean;
  packageName?: string;
  latestVersion?: string;
  status: 'latest' | 'skip' | 'error';
  error?: string;
}

export interface CatalogEntry {
  category: string;
  name: string;
  package: string;
  description: string;
  authRequired: boolean;
}

export interface OperationResult {
  ok: boolean;
  message: string;
  changed?: boolean;
}
