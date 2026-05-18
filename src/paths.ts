/**
 * Multi-MCP Gateway — 路徑解析與使用者資料初始化
 *
 * 程式碼可安裝在 npm package 目錄，設定與金鑰必須留在使用者本機資料夾。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface GatewayPaths {
  packageRoot: string;
  dataDir: string;
  configPath: string;
  envPath: string;
  credentialsPath: string;
  registryPath: string;
  mcpsDir: string;
  catalogPath: string;
}

export interface GatewayPathEnv {
  MULTI_MCP_HOME?: string;
  APPDATA?: string;
  LOCALAPPDATA?: string;
  XDG_CONFIG_HOME?: string;
}

export function getPackageRoot(): string {
  return resolve(__dirname, '..');
}

export function getUserDataDir(
  env: GatewayPathEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  if (env.MULTI_MCP_HOME) {
    return resolve(env.MULTI_MCP_HOME);
  }

  if (platform === 'win32') {
    const base = env.APPDATA ?? env.LOCALAPPDATA ?? resolve(homedir(), 'AppData', 'Roaming');
    return resolve(base, 'multi-mcp-gateway');
  }

  if (platform === 'darwin') {
    return resolve(homedir(), 'Library', 'Application Support', 'multi-mcp-gateway');
  }

  const base = env.XDG_CONFIG_HOME ?? resolve(homedir(), '.config');
  return resolve(base, 'multi-mcp-gateway');
}

export function getGatewayPaths(dataDir = getUserDataDir()): GatewayPaths {
  const resolvedDataDir = isAbsolute(dataDir) ? dataDir : resolve(dataDir);
  const packageRoot = getPackageRoot();
  return {
    packageRoot,
    dataDir: resolvedDataDir,
    configPath: resolve(resolvedDataDir, 'gateway.config.json'),
    envPath: resolve(resolvedDataDir, 'gateway.env'),
    credentialsPath: resolve(resolvedDataDir, 'credentials.json'),
    registryPath: resolve(resolvedDataDir, 'registry.json'),
    mcpsDir: resolve(resolvedDataDir, 'mcps'),
    catalogPath: resolve(packageRoot, 'mcp-catalog.json'),
  };
}

export function ensureUserDataDir(paths = getGatewayPaths()): GatewayPaths {
  mkdirSync(paths.dataDir, { recursive: true });
  mkdirSync(paths.mcpsDir, { recursive: true });

  if (!existsSync(paths.configPath)) {
    writeFileSync(paths.configPath, defaultGatewayConfig(), 'utf-8');
  }
  if (!existsSync(paths.envPath)) {
    writeFileSync(paths.envPath, defaultGatewayEnv(), 'utf-8');
  }
  if (!existsSync(paths.registryPath)) {
    writeFileSync(paths.registryPath, defaultRegistry(), 'utf-8');
  }

  return paths;
}

function defaultGatewayConfig(): string {
  return `${JSON.stringify({
    gateway: {
      idle_timeout_ms: 300000,
      startup_timeout_ms: 60000,
      max_retries: 3,
      log_level: 'info',
      env_file: 'gateway.env',
      health_check_on_start: false,
      mcps_dir: 'mcps',
    },
  }, null, 2)}\n`;
}

function defaultGatewayEnv(): string {
  return [
    '# Multi-MCP Gateway — 認證（由主控台自動產生，請勿手動編輯）',
    '# 使用 npx -y multi-mcp-gateway@latest console 管理帳號與密鑰',
    '',
  ].join('\n');
}

function defaultRegistry(): string {
  return `${JSON.stringify({
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    servers: {},
    all_tools: {},
  }, null, 2)}\n`;
}
