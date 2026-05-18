/**
 * Multi-MCP Gateway — 路徑解析與使用者資料初始化
 *
 * 程式碼可安裝在 npm package 目錄，設定與金鑰必須留在使用者本機資料夾。
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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
  defaultMcpSeedPath: string;
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
    defaultMcpSeedPath: resolve(resolvedDataDir, 'default-mcps.seed.json'),
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
  seedDefaultMcps(paths);

  return paths;
}

interface DefaultMcpSeed {
  category: string;
  name: string;
  config: {
    command: string;
    args: string[];
  };
}

export const DEFAULT_MCP_SEEDS: readonly DefaultMcpSeed[] = [
  {
    category: '記憶管理',
    name: 'cartridge-system',
    config: { command: 'npx', args: ['-y', '--package', 'cartridge-system@latest', '--', 'cartridge-system'] },
  },
  {
    category: '文件查詢',
    name: 'context7',
    config: { command: 'npx', args: ['-y', '--package', '@upstash/context7-mcp@latest', '--', 'context7-mcp'] },
  },
  {
    category: '網頁測試',
    name: 'playwright',
    config: { command: 'npx', args: ['-y', '--package', '@playwright/mcp@latest', '--', 'playwright-mcp'] },
  },
  {
    category: '網頁測試',
    name: 'a11y',
    config: { command: 'npx', args: ['-y', '--package', 'accessibility-mcp@latest', '--', 'accessibility-mcp'] },
  },
  {
    category: '資料處理',
    name: 'excel',
    config: { command: 'npx', args: ['-y', '--package', '@shmaxi/excel-mcp-server@latest', '--', 'excel-mcp-server', 'stdio'] },
  },
  {
    category: '輔助工具',
    name: 'sequentialthinking',
    config: { command: 'npx', args: ['-y', '--package', '@modelcontextprotocol/server-sequential-thinking@latest', '--', 'mcp-server-sequential-thinking'] },
  },
  {
    category: '開發工具',
    name: 'gitnexus',
    config: { command: 'npx', args: ['-y', '--package', 'gitnexus@1.6.5', '--', 'gitnexus', 'mcp'] },
  },
];

function seedDefaultMcps(paths: GatewayPaths): void {
  if (existsSync(paths.defaultMcpSeedPath)) return;

  const seeded: Array<{ category: string; name: string; path?: string; skipped?: string }> = [];

  for (const seed of DEFAULT_MCP_SEEDS) {
    if (mcpConfigExists(paths.mcpsDir, seed.name)) {
      seeded.push({ category: seed.category, name: seed.name, skipped: 'existing' });
      continue;
    }

    const categoryDir = resolve(paths.mcpsDir, seed.category);
    const targetPath = resolve(categoryDir, `${seed.name}.json`);
    mkdirSync(categoryDir, { recursive: true });
    writeFileSync(targetPath, `${JSON.stringify(seed.config, null, 2)}\n`, 'utf-8');
    seeded.push({ category: seed.category, name: seed.name, path: targetPath });
  }

  writeFileSync(paths.defaultMcpSeedPath, `${JSON.stringify({
    version: '1.1.1',
    generated_at: new Date().toISOString(),
    seeded,
  }, null, 2)}\n`, 'utf-8');
}

function mcpConfigExists(mcpsDir: string, name: string): boolean {
  if (!existsSync(mcpsDir)) return false;
  const reservedNames = new Set([
    `${name}.json`,
    `${name}.disabled`,
    `${name}.json.disabled`,
  ]);

  for (const category of readdirSync(mcpsDir)) {
    const categoryPath = resolve(mcpsDir, category);
    if (!statSync(categoryPath).isDirectory()) continue;
    for (const file of readdirSync(categoryPath)) {
      if (reservedNames.has(file)) return true;
    }
  }
  return false;
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
