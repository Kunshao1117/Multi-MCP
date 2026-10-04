import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ensureUserDataDir, getGatewayPaths, type GatewayPaths } from '../paths.js';
import { validateMcpServerConfig, validateMcpServerName } from '../config-loader.js';
import type { McpServerConfig, ToolRegistry } from '../types.js';
import type { ManagementOptions, McpUpdateInput } from './types.js';
import {
  assertSafePath, commitFileChanges, fileStat, removeEmptyDirectory, validatePathSegment, withDataLock,
  type FileChange,
} from './storage.js';

export interface McpConfigFile {
  name: string;
  category: string;
  enabled: boolean;
  path: string;
  config: McpServerConfig;
}

export function resolveGatewayPaths(options: ManagementOptions = {}): GatewayPaths {
  return getGatewayPaths(options.dataDir);
}

/** Initialization may seed files, so check every managed parent/target first. */
export function assertGatewayPathsSafe(paths: GatewayPaths): void {
  for (const path of [paths.dataDir, paths.mcpsDir, paths.configPath, paths.envPath,
    paths.credentialsPath, paths.registryPath, paths.defaultMcpSeedPath]) assertSafePath(paths.dataDir, path);
  if (!fileStat(paths.mcpsDir)) return;
  for (const category of readdirSync(paths.mcpsDir)) {
    const categoryPath = resolve(paths.mcpsDir, category);
    assertSafePath(paths.dataDir, categoryPath);
    if (!fileStat(categoryPath)?.isDirectory()) continue;
    for (const file of readdirSync(categoryPath)) assertSafePath(paths.dataDir, resolve(categoryPath, file));
  }
}

export function ensureGatewayPaths(options: ManagementOptions = {}): GatewayPaths {
  const paths = resolveGatewayPaths(options);
  assertGatewayPathsSafe(paths);
  return ensureUserDataDir(paths);
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fileStat(filePath)) return fallback;
  try { return JSON.parse(readFileSync(filePath, 'utf-8')) as T; }
  catch { throw new Error('設定檔無法解析；原始檔案已保留，請先修復'); }
}

export function writeJsonFile(filePath: string, value: unknown): void {
  commitFileChanges(dirname(filePath), [{ path: filePath, data: `${JSON.stringify(value, null, 2)}\n` }]);
}

export function listMcpConfigFiles(paths: GatewayPaths): McpConfigFile[] {
  assertSafePath(paths.dataDir, paths.mcpsDir);
  if (!fileStat(paths.mcpsDir)) return [];
  const result: McpConfigFile[] = [];
  const names = new Set<string>();
  for (const category of readdirSync(paths.mcpsDir)) {
    const categoryPath = resolve(paths.mcpsDir, category);
    assertSafePath(paths.dataDir, categoryPath);
    if (!fileStat(categoryPath)?.isDirectory()) continue;
    for (const file of readdirSync(categoryPath)) {
      const parsed = parseMcpFileName(file);
      if (!parsed) continue;
      const filePath = resolve(categoryPath, file);
      assertSafePath(paths.dataDir, filePath);
      if (!fileStat(filePath)?.isFile()) throw new Error('MCP 設定必須是一般檔案');
      validatePathSegment(category, '分類');
      validatePathSegment(parsed.name, 'MCP 名稱');
      validateMcpServerName(parsed.name);
      const key = parsed.name.toLocaleLowerCase('en-US');
      if (names.has(key)) throw new Error('MCP 名稱重複；請先解決重複設定，未修改任何設定檔');
      names.add(key);
      const config = validateMcpServerConfig(readJsonFile<unknown>(filePath, null), `MCP 設定 ${file}`);
      result.push({ ...parsed, category, path: filePath, config });
    }
  }
  return result.sort((a, b) => `${a.category}/${a.name}`.localeCompare(`${b.category}/${b.name}`));
}

export function findMcpConfigFile(paths: GatewayPaths, name: string): McpConfigFile | undefined {
  validatePathSegment(name, 'MCP 名稱');
  validateMcpServerName(name);
  return listMcpConfigFiles(paths).find((entry) => entry.name.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US'));
}

export function planSaveMcpConfig(paths: GatewayPaths, category: string, name: string, config: McpServerConfig): FileChange {
  validatePathSegment(category, '分類');
  validatePathSegment(name, 'MCP 名稱');
  validateMcpServerName(name);
  validateMcpServerConfig(config);
  if (findMcpConfigFile(paths, name)) throw new Error(`"${name}" 已存在`);
  const filePath = resolve(paths.mcpsDir, category, `${name}.json`);
  assertSafePath(paths.mcpsDir, filePath);
  return { path: filePath, data: `${JSON.stringify(config, null, 2)}\n`, createOnly: true };
}

export function saveMcpConfigFile(paths: GatewayPaths, category: string, name: string, config: McpServerConfig): string {
  planSaveMcpConfig(paths, category, name, config);
  return withDataLock(paths.dataDir, () => {
    const change = planSaveMcpConfig(paths, category, name, config);
    commitFileChanges(paths.dataDir, [change]);
    return change.path;
  });
}

export function removeMcpConfigFile(paths: GatewayPaths, name: string): boolean {
  if (!findMcpConfigFile(paths, name)) return false;
  return withDataLock(paths.dataDir, () => {
    const entry = findMcpConfigFile(paths, name);
    if (!entry) return false;
    commitFileChanges(paths.dataDir, [{ path: entry.path, data: null }]);
    removeEmptyDirectory(dirname(entry.path));
    return true;
  });
}

export function setMcpConfigEnabled(paths: GatewayPaths, name: string, enabled: boolean): boolean {
  if (typeof enabled !== 'boolean') throw new Error('啟用狀態必須是布林值');
  if (!findMcpConfigFile(paths, name)) return false;
  return withDataLock(paths.dataDir, () => {
    const entry = findMcpConfigFile(paths, name);
    if (!entry || entry.enabled === enabled) return false;
    const target = resolve(dirname(entry.path), enabled ? `${entry.name}.json` : `${entry.name}.json.disabled`);
    commitFileChanges(paths.dataDir, [
      { path: target, data: readFileSync(entry.path, 'utf-8'), createOnly: true },
      { path: entry.path, data: null },
    ]);
    return true;
  });
}

export function planUpdateMcpConfig(
  paths: GatewayPaths,
  input: Pick<McpUpdateInput, 'currentName' | 'nextName' | 'category' | 'config'>,
): { oldPath: string; newPath: string; renamed: boolean; moved: boolean; changes: FileChange[] } {
  validatePathSegment(input.currentName, 'MCP 名稱');
  validateMcpServerName(input.currentName);
  validatePathSegment(input.nextName, 'MCP 名稱');
  validateMcpServerName(input.nextName);
  validatePathSegment(input.category, '分類');
  validateMcpServerConfig(input.config);
  const entry = findMcpConfigFile(paths, input.currentName);
  if (!entry) throw new Error(`找不到 "${input.currentName}"`);
  const conflict = findMcpConfigFile(paths, input.nextName);
  if (conflict && conflict.path !== entry.path) throw new Error(`"${input.nextName}" 已存在`);
  // Case-only renames are ambiguous on case-insensitive filesystems.
  if (entry.name !== input.nextName && entry.name.toLowerCase() === input.nextName.toLowerCase()) throw new Error('MCP 名稱不可只變更大小寫');
  if (entry.category !== input.category && entry.category.toLowerCase() === input.category.toLowerCase()) throw new Error('分類不可只變更大小寫');
  const target = resolve(paths.mcpsDir, input.category, `${input.nextName}${configFileSuffix(entry.path)}`);
  assertSafePath(paths.mcpsDir, target);
  const samePath = target === entry.path;
  if (!samePath && fileStat(target)) throw new Error('目標設定檔已存在');
  return {
    oldPath: entry.path, newPath: target, renamed: entry.name !== input.nextName, moved: entry.category !== input.category,
    changes: [
      { path: target, data: `${JSON.stringify(input.config, null, 2)}\n`, createOnly: !samePath },
      ...(!samePath ? [{ path: entry.path, data: null }] : []),
    ],
  };
}

export function updateMcpConfigFile(
  paths: GatewayPaths,
  input: Pick<McpUpdateInput, 'currentName' | 'nextName' | 'category' | 'config'>,
): { oldPath: string; newPath: string; renamed: boolean; moved: boolean } {
  planUpdateMcpConfig(paths, input);
  return withDataLock(paths.dataDir, () => {
    const { changes, ...result } = planUpdateMcpConfig(paths, input);
    commitFileChanges(paths.dataDir, changes);
    if (result.oldPath !== result.newPath) removeEmptyDirectory(dirname(result.oldPath));
    return result;
  });
}

export function loadRegistrySnapshot(paths: GatewayPaths): ToolRegistry {
  assertSafePath(paths.dataDir, paths.registryPath);
  return readJsonFile<ToolRegistry>(paths.registryPath, { version: '1.0.0', generated_at: '', servers: {}, all_tools: {} });
}

function configFileSuffix(filePath: string): '.json' | '.json.disabled' | '.disabled' {
  if (filePath.endsWith('.json.disabled')) return '.json.disabled';
  if (filePath.endsWith('.disabled')) return '.disabled';
  return '.json';
}

function parseMcpFileName(file: string): { name: string; enabled: boolean } | null {
  if (file.endsWith('.json')) return { name: file.replace(/\.json$/, ''), enabled: true };
  if (file.endsWith('.json.disabled')) return { name: file.replace(/\.json\.disabled$/, ''), enabled: false };
  if (file.endsWith('.disabled')) return { name: file.replace(/\.disabled$/, ''), enabled: false };
  return null;
}
