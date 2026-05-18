import {
  existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ensureUserDataDir, getGatewayPaths, type GatewayPaths } from '../paths.js';
import type { McpServerConfig, ToolRegistry } from '../types.js';
import type { ManagementOptions } from './types.js';

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

export function ensureGatewayPaths(options: ManagementOptions = {}): GatewayPaths {
  return ensureUserDataDir(resolveGatewayPaths(options));
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

export function listMcpConfigFiles(paths: GatewayPaths): McpConfigFile[] {
  if (!existsSync(paths.mcpsDir)) return [];
  const result: McpConfigFile[] = [];
  for (const category of readdirSync(paths.mcpsDir)) {
    const categoryPath = resolve(paths.mcpsDir, category);
    if (!statSync(categoryPath).isDirectory()) continue;
    for (const file of readdirSync(categoryPath)) {
      const parsed = parseMcpFileName(file);
      if (!parsed) continue;
      const filePath = resolve(categoryPath, file);
      const config = readJsonFile<McpServerConfig | null>(filePath, null);
      if (!config || typeof config.command !== 'string' || !Array.isArray(config.args)) continue;
      result.push({ ...parsed, category, path: filePath, config });
    }
  }
  return result.sort((a, b) => `${a.category}/${a.name}`.localeCompare(`${b.category}/${b.name}`));
}

export function findMcpConfigFile(paths: GatewayPaths, name: string): McpConfigFile | undefined {
  return listMcpConfigFiles(paths).find((entry) => entry.name === name);
}

export function saveMcpConfigFile(paths: GatewayPaths, category: string, name: string, config: McpServerConfig): string {
  const filePath = resolve(paths.mcpsDir, category, `${name}.json`);
  writeJsonFile(filePath, config);
  return filePath;
}

export function removeMcpConfigFile(paths: GatewayPaths, name: string): boolean {
  const entry = findMcpConfigFile(paths, name);
  if (!entry) return false;
  unlinkSync(entry.path);
  removeEmptyCategory(dirname(entry.path));
  return true;
}

export function setMcpConfigEnabled(paths: GatewayPaths, name: string, enabled: boolean): boolean {
  const entry = findMcpConfigFile(paths, name);
  if (!entry || entry.enabled === enabled) return false;
  const target = resolve(dirname(entry.path), enabled ? `${entry.name}.json` : `${entry.name}.json.disabled`);
  if (existsSync(target)) {
    throw new Error(`目標設定檔已存在: ${target}`);
  }
  renameSync(entry.path, target);
  return true;
}

export function loadRegistrySnapshot(paths: GatewayPaths): ToolRegistry {
  return readJsonFile<ToolRegistry>(paths.registryPath, {
    version: '1.0.0',
    generated_at: '',
    servers: {},
    all_tools: {},
  });
}

function parseMcpFileName(file: string): { name: string; enabled: boolean } | null {
  if (file.endsWith('.json')) return { name: file.replace(/\.json$/, ''), enabled: true };
  if (file.endsWith('.json.disabled')) return { name: file.replace(/\.json\.disabled$/, ''), enabled: false };
  if (file.endsWith('.disabled')) return { name: file.replace(/\.disabled$/, ''), enabled: false };
  return null;
}

function removeEmptyCategory(categoryPath: string): void {
  if (!existsSync(categoryPath)) return;
  const remaining = readdirSync(categoryPath).filter((file) => parseMcpFileName(file));
  if (remaining.length === 0) rmSync(categoryPath, { recursive: true, force: true });
}
