/**
 * Multi-MCP Gateway — 設定檔載入器
 * 支援 gateway.env 集中認證管理 + 環境變數模板解析
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { GatewayConfig, LogLevel, McpServerConfig } from './types.js';
import { createLogger } from './logger.js';

const logger = createLogger('config-loader');
const VALID_LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * 載入 gateway.env 並注入到 process.env
 * 讓使用者只維護一份認證檔案
 */
function loadEnvFile(envPath: string): void {
  const resolvedPath = resolve(envPath);
  if (!existsSync(resolvedPath)) {
    logger.warn('認證檔案不存在，跳過', { path: resolvedPath });
    return;
  }

  const content = readFileSync(resolvedPath, 'utf-8');
  let loaded = 0;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // 跳過空行與註解
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();

    // 只在尚未設定時才注入（系統環境變數優先）
    if (!process.env[key]) {
      process.env[key] = value;
      loaded++;
    }
  }

  logger.info('認證檔案載入完成', { path: resolvedPath, loaded });
}

/** 替換 ${VAR} 為環境變數值 */
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName: string) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      logger.warn(`環境變數 ${varName} 未設定`, { variable: varName });
      return match;
    }
    return envValue;
  });
}

/**
 * 從 mcps/ 資料夾掃描 MCP 設定
 * 資料夾名稱 = 分類名稱，JSON 檔名 = MCP 名稱
 */
function loadMcpsFromDirectory(mcpsDir: string): {
  mcpServers: Record<string, McpServerConfig>;
  categories: Record<string, string[]>;
} {
  const resolvedDir = resolve(mcpsDir);
  if (!existsSync(resolvedDir)) {
    logger.warn('MCP 資料夾不存在', { path: resolvedDir });
    return { mcpServers: {}, categories: {} };
  }

  const mcpServers: Record<string, McpServerConfig> = {};
  const categories: Record<string, string[]> = {};
  const entries = readdirSync(resolvedDir);

  for (const entry of entries) {
    const entryPath = resolve(resolvedDir, entry);
    if (!statSync(entryPath).isDirectory()) continue;

    const categoryName = entry;
    categories[categoryName] = [];
    const files = readdirSync(entryPath);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const mcpName = file.replace(/\.json$/, '');
      try {
        const content = readFileSync(resolve(entryPath, file), 'utf-8');
        const parsed = JSON.parse(content) as McpServerConfig;
        mcpServers[mcpName] = parsed;
        categories[categoryName].push(mcpName);
        logger.info(`載入 MCP: ${mcpName}`, { category: categoryName });
      } catch (err) {
        logger.error(`載入 MCP 失敗: ${file}`, { error: (err as Error).message });
      }
    }
  }

  logger.info('MCP 資料夾掃描完成', {
    categories: Object.keys(categories).length,
    totalMcps: Object.keys(mcpServers).length,
  });
  return { mcpServers, categories };
}

/** 遞迴解析所有字串欄位 */
function deepResolveEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') return resolveEnvVars(obj);
  if (Array.isArray(obj)) return obj.map(deepResolveEnvVars);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = deepResolveEnvVars(value);
    }
    return result;
  }
  return obj;
}

/** 驗證設定檔結構 */
function validateConfig(config: unknown): config is GatewayConfig {
  if (config === null || typeof config !== 'object') {
    throw new Error('設定檔必須是有效的 JSON 物件');
  }
  const c = config as Record<string, unknown>;

  if (!c.gateway || typeof c.gateway !== 'object') {
    throw new Error('設定檔缺少 "gateway" 區段');
  }
  const gw = c.gateway as Record<string, unknown>;

  if (typeof gw.idle_timeout_ms !== 'number' || gw.idle_timeout_ms < 0) {
    throw new Error('"gateway.idle_timeout_ms" 必須是正數');
  }
  if (typeof gw.startup_timeout_ms !== 'number' || gw.startup_timeout_ms < 0) {
    throw new Error('"gateway.startup_timeout_ms" 必須是正數');
  }
  if (typeof gw.max_retries !== 'number' || gw.max_retries < 0) {
    throw new Error('"gateway.max_retries" 必須是非負整數');
  }
  if (!VALID_LOG_LEVELS.includes(gw.log_level as LogLevel)) {
    throw new Error(`"gateway.log_level" 必須是 ${VALID_LOG_LEVELS.join('/')} 之一`);
  }
  if (!c.mcpServers || typeof c.mcpServers !== 'object') {
    // 在資料夾模式下 mcpServers 由 loadMcpsFromDirectory 提供，此處允許缺少
    if (!c.gateway || !(c.gateway as Record<string, unknown>).mcps_dir) {
      throw new Error('設定檔缺少 "mcpServers" 區段（或設定 "gateway.mcps_dir" 使用資料夾模式）');
    }
  }

  for (const [name, sc] of Object.entries((c.mcpServers ?? {}) as Record<string, unknown>)) {
    if (sc === null || typeof sc !== 'object') {
      throw new Error(`MCP 伺服器 "${name}" 的設定必須是物件`);
    }
    const s = sc as Record<string, unknown>;
    if (typeof s.command !== 'string' || s.command.length === 0) {
      throw new Error(`MCP 伺服器 "${name}" 缺少 "command" 欄位`);
    }
    if (!Array.isArray(s.args)) {
      throw new Error(`MCP 伺服器 "${name}" 的 "args" 必須是陣列`);
    }
  }
  return true;
}

/** 載入設定檔 */
export function loadConfig(configPath?: string): GatewayConfig {
  const resolvedPath = resolve(configPath ?? 'gateway.config.json');
  const configDir = dirname(resolvedPath);
  logger.info('載入設定檔', { path: resolvedPath });

  let rawContent: string;
  try {
    rawContent = readFileSync(resolvedPath, 'utf-8');
  } catch (err) {
    throw new Error(`無法讀取設定檔: ${resolvedPath} — ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`設定檔 JSON 語法錯誤: ${(err as Error).message}`);
  }

  // 先讀取 gateway.env（在解析環境變數前）
  const gateway = (parsed as Record<string, unknown>).gateway as Record<string, unknown> | undefined;
  const envFile = gateway?.env_file as string | undefined;
  if (envFile) {
    loadEnvFile(resolve(configDir, envFile));
  }

  // 先做環境變數解析
  const resolved = deepResolveEnvVars(parsed);
  validateConfig(resolved);

  const config = resolved as GatewayConfig;

  // 資料夾模式：從 mcps/ 資料夾掃描 MCP 設定
  const mcpsDir = config.gateway.mcps_dir;
  if (mcpsDir) {
    const { mcpServers, categories } = loadMcpsFromDirectory(resolve(configDir, mcpsDir));
    // 解析 MCP 設定中的環境變數模板
    const resolvedMcps = deepResolveEnvVars(mcpServers) as Record<string, McpServerConfig>;
    const mutableConfig = config as unknown as Record<string, unknown>;
    mutableConfig.mcpServers = resolvedMcps;
    mutableConfig.categories = categories;
  }

  // 確保 mcpServers 存在
  if (!config.mcpServers) {
    (config as unknown as Record<string, unknown>).mcpServers = {};
  }

  logger.info('設定檔載入成功', {
    serverCount: Object.keys(config.mcpServers).length,
    servers: Object.keys(config.mcpServers),
    envFile: envFile ?? '(none)',
    mode: mcpsDir ? 'directory' : 'inline',
  });

  return Object.freeze(config);
}
