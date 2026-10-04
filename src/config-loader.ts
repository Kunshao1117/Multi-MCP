/** Immutable configuration and credential snapshots. Never modifies process.env. */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import type { GatewayConfig, LogLevel, McpServerConfig } from './types.js';
import { createLogger } from './logger.js';
import { createDownstreamEnv } from './subprocess-env.js';

const logger = createLogger('config-loader');
const VALID_LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const RESERVED_NAMES = new Set(['__proto__', 'prototype', 'constructor']);
export interface ConfigContext {
  readonly configPath: string;
  readonly initialEnv: Readonly<NodeJS.ProcessEnv>;
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly rawConfig: Readonly<GatewayConfig>;
  readonly diagnostics: readonly string[];
}
const contexts = new WeakMap<GatewayConfig, ConfigContext>();

export function getConfigContext(config: GatewayConfig): ConfigContext | undefined {
  return contexts.get(config);
}

/** Preserve the original path and genuine OS overrides when refreshing credentials. */
export function reloadConfig(config: GatewayConfig): GatewayConfig {
  const context = contexts.get(config);
  return context ? loadConfig(context.configPath, context.initialEnv) : config;
}

export function getServerEnv(config: GatewayConfig, serverName: string): Record<string, string> {
  return createDownstreamEnv(config.mcpServers[serverName]?.env ?? {}, contexts.get(config)?.environment);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

export function validateMcpServerConfig(raw: unknown, context = 'MCP 設定'): McpServerConfig {
  if (!isRecord(raw)) throw new Error(`${context} 必須是物件`);
  if (Object.keys(raw).some((key) => RESERVED_NAMES.has(key))) throw new Error(`${context} 包含保留欄位名稱`);
  if (typeof raw.command !== 'string' || !raw.command.trim()) throw new Error(`${context} 缺少有效的 command`);
  if (!Array.isArray(raw.args) || raw.args.some((arg) => typeof arg !== 'string')) {
    throw new Error(`${context} 的 args 必須是字串陣列`);
  }
  if (raw.env !== undefined && (!isRecord(raw.env)
    || Object.entries(raw.env).some(([key, value]) => RESERVED_NAMES.has(key) || typeof value !== 'string'))) {
    throw new Error(`${context} 的 env 必須是字串物件`);
  }
  if (raw.preload !== undefined && typeof raw.preload !== 'boolean') throw new Error(`${context} 的 preload 必須是布林值`);
  return raw as unknown as McpServerConfig;
}

export function validateMcpServerName(name: string): void {
  if (!name.trim() || RESERVED_NAMES.has(name) || name === 'gateway' || name.includes('__')) {
    throw new Error('MCP 名稱無效或與保留命名空間衝突');
  }
}

/** Validation messages intentionally contain field names, never credential values. */
function validateConfig(raw: unknown): asserts raw is GatewayConfig {
  if (!isRecord(raw)) throw new Error('設定檔必須是有效的 JSON 物件');
  if (!isRecord(raw.gateway)) throw new Error('設定檔缺少 "gateway" 區段');
  const gw = raw.gateway;
  for (const field of ['idle_timeout_ms', 'startup_timeout_ms'] as const) {
    if (typeof gw[field] !== 'number' || !Number.isFinite(gw[field]) || gw[field] < 0 || gw[field] > 2147483647) {
      throw new Error(`gateway.${field} 必須是非負且有效的毫秒數`);
    }
  }
  if (typeof gw.max_retries !== 'number' || !Number.isSafeInteger(gw.max_retries) || gw.max_retries < 0) {
    throw new Error('gateway.max_retries 必須是非負整數');
  }
  if (!VALID_LOG_LEVELS.includes(gw.log_level as LogLevel)) throw new Error('gateway.log_level 無效');
  for (const field of ['env_file', 'mcps_dir'] as const) {
    if (gw[field] !== undefined && (typeof gw[field] !== 'string' || !gw[field].trim())) {
      throw new Error(`gateway.${field} 必須是非空字串`);
    }
  }
  if (gw.health_check_on_start !== undefined && typeof gw.health_check_on_start !== 'boolean') {
    throw new Error('gateway.health_check_on_start 必須是布林值');
  }
  if (raw.mcpServers === undefined && !gw.mcps_dir) throw new Error('設定檔缺少 mcpServers 區段');
  if (raw.mcpServers !== undefined && !isRecord(raw.mcpServers)) throw new Error('mcpServers 必須是物件');
  for (const [name, sc] of Object.entries(raw.mcpServers ?? {})) {
    validateMcpServerName(name);
    validateMcpServerConfig(sc, `MCP 伺服器 "${name}"`);
  }
  if (raw.categories !== undefined && (!isRecord(raw.categories)
    || Object.entries(raw.categories).some(([key, value]) => RESERVED_NAMES.has(key)
      || !Array.isArray(value) || value.some((name) => typeof name !== 'string')))) {
    throw new Error('categories 必須是字串陣列物件');
  }
}

function loadEnvFile(envPath: string): Record<string, string> {
  if (!existsSync(envPath)) return {};
  const entries: Array<[string, string]> = [];
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || RESERVED_NAMES.has(key)) continue;
    entries.push([key, trimmed.slice(eqIndex + 1).trim()]);
  }
  return Object.fromEntries(entries);
}

function deepResolve(value: unknown, environment: NodeJS.ProcessEnv): unknown {
  if (typeof value === 'string') return value.replace(/\$\{([^}]+)\}/g, (match, key: string) => environment[key] ?? match);
  if (Array.isArray(value)) return value.map((child) => deepResolve(child, environment));
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepResolve(child, environment)]));
  return value;
}

function loadDirectory(directory: string, diagnostics: string[]): Pick<GatewayConfig, 'mcpServers' | 'categories'> {
  const mcpServers: Record<string, McpServerConfig> = Object.create(null);
  const categories: Record<string, string[]> = Object.create(null);
  if (!existsSync(directory)) return { mcpServers, categories };
  for (const category of readdirSync(directory).sort()) {
    const categoryPath = resolve(directory, category);
    if (!statSync(categoryPath).isDirectory()) continue;
    if (RESERVED_NAMES.has(category)) {
      diagnostics.push('略過使用保留名稱的分類');
      continue;
    }
    categories[category] = [];
    for (const file of readdirSync(categoryPath).sort()) {
      if (!file.endsWith('.json')) continue;
      const name = file.slice(0, -5);
      try {
        validateMcpServerName(name);
        const raw: unknown = JSON.parse(readFileSync(resolve(categoryPath, file), 'utf-8'));
        const server = validateMcpServerConfig(raw, `MCP 檔案 ${basename(file)}`);
        if (Object.hasOwn(mcpServers, name)) throw new Error('MCP 名稱重複');
        mcpServers[name] = server;
        categories[category].push(name);
      } catch (error) {
        // A malformed file does not prevent other valid services from loading.
        const reason = error instanceof SyntaxError ? 'JSON 語法錯誤' : (error as Error).message;
        const diagnostic = `${category}/${basename(file)}: ${reason}`;
        diagnostics.push(diagnostic);
        logger.error('略過無效 MCP 設定', { file: `${category}/${basename(file)}`, reason });
      }
    }
  }
  return { mcpServers, categories };
}

export function loadConfig(configPath?: string, initialEnv: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const resolvedPath = resolve(configPath ?? 'gateway.config.json');
  let rawContent: string;
  try { rawContent = readFileSync(resolvedPath, 'utf-8'); }
  catch { throw new Error(`無法讀取設定檔: ${resolvedPath}`); }
  let parsed: unknown;
  try { parsed = JSON.parse(rawContent); }
  catch { throw new Error('設定檔 JSON 語法錯誤'); }
  validateConfig(parsed);
  const base = Object.fromEntries(Object.entries(initialEnv).filter(([, value]) => value !== undefined));
  const environment = { ...(parsed.gateway.env_file ? loadEnvFile(resolve(dirname(resolvedPath), parsed.gateway.env_file)) : {}), ...base };
  const diagnostics: string[] = [];
  let rawConfig = parsed;
  if (parsed.gateway.mcps_dir) {
    const dir = deepResolve(parsed.gateway.mcps_dir, environment) as string;
    rawConfig = { ...parsed, ...loadDirectory(resolve(dirname(resolvedPath), dir), diagnostics) };
  }
  const config = deepResolve(rawConfig, environment) as GatewayConfig;
  validateConfig(config);
  contexts.set(config, freezeDeep({ configPath: resolvedPath, initialEnv: base, environment, rawConfig, diagnostics }));
  logger.info('設定檔載入成功', { serverCount: Object.keys(config.mcpServers).length, invalidFiles: diagnostics.length });
  return freezeDeep(config);
}
