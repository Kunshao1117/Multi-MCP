import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config-loader.js';
import { scanAndGenerateRegistry } from '../registry.js';
import type { McpServerConfig, RegistryToolEntry } from '../types.js';
import { getAuthGuide } from '../auth-guides.js';
import {
  deleteCredentialFromStore as removeCredential,
  loadCredentialStore,
  summarizeCredential,
  writeCredential,
} from './credentials.js';
import {
  ensureGatewayPaths, findMcpConfigFile, listMcpConfigFiles, loadRegistrySnapshot,
  removeMcpConfigFile, resolveGatewayPaths, saveMcpConfigFile, setMcpConfigEnabled,
} from './files.js';
import type {
  GatewayStatus,
  ManagementOptions,
  McpInstallInput,
  McpServerSummary,
  McpToolSummary,
  OperationResult,
} from './types.js';

export function getGatewayStatus(options: ManagementOptions = {}): GatewayStatus {
  const paths = resolveGatewayPaths(options);
  const registry = loadRegistrySnapshot(paths);
  const servers = listMcpConfigFiles(paths);
  return {
    packageVersion: readPackageVersion(paths.packageRoot),
    dataDir: paths.dataDir,
    configPath: paths.configPath,
    envPath: paths.envPath,
    credentialsPath: paths.credentialsPath,
    registryPath: paths.registryPath,
    mcpsDir: paths.mcpsDir,
    initialized: existsSync(paths.configPath) && existsSync(paths.mcpsDir),
    enabledServers: servers.filter((server) => server.enabled).length,
    disabledServers: servers.filter((server) => !server.enabled).length,
    totalServers: servers.length,
    totalTools: Object.keys(registry.all_tools).length,
    registryGeneratedAt: registry.generated_at || undefined,
  };
}

export function listMcpServers(options: ManagementOptions = {}): McpServerSummary[] {
  const paths = resolveGatewayPaths(options);
  const registry = loadRegistrySnapshot(paths);
  const credentials = loadCredentialStore(paths);
  return listMcpConfigFiles(paths).map((entry) => {
    const source = classifySource(entry.config);
    const requiredEnvVars = collectRequiredEnvVars(entry.name, entry.config);
    const credential = summarizeCredential(credentials, entry.name);
    const serverTools = registry.servers[entry.name]?.tools ?? {};
    return {
      name: entry.name,
      category: entry.category,
      enabled: entry.enabled,
      configPath: entry.path,
      config: entry.config,
      sourceType: source.type,
      source: source.source,
      packageName: source.packageName,
      toolCount: Object.keys(serverTools).length,
      tools: summarizeTools(serverTools),
      authStatus: credential || requiredEnvVars.length === 0 ? 'unknown' : 'not_configured',
      requiredEnvVars,
      credential,
    };
  });
}

export async function installMcp(input: McpInstallInput, options: ManagementOptions = {}): Promise<OperationResult> {
  const paths = ensureGatewayPaths(options);
  const name = input.name.trim();
  const category = input.category.trim();
  if (!name || !category) return { ok: false, message: 'MCP 名稱與分類不可為空' };
  if (findMcpConfigFile(paths, name) && !input.overwrite) return { ok: false, message: `"${name}" 已存在` };
  const config = input.config ?? await createConfigFromSource(input.source ?? '');
  saveMcpConfigFile(paths, category, name, config);
  if (input.credential?.value) writeCredential(paths, { ...input.credential, mcpName: name });
  if (input.rescan) await rescanRegistry(options);
  return { ok: true, changed: true, message: `"${name}" 已安裝` };
}

export async function removeMcp(name: string, options: ManagementOptions = {}): Promise<OperationResult> {
  const paths = ensureGatewayPaths(options);
  const removed = removeMcpConfigFile(paths, name);
  if (!removed) return { ok: false, message: `找不到 "${name}"` };
  removeCredential(paths, name);
  return { ok: true, changed: true, message: `"${name}" 已移除` };
}

export function setMcpEnabled(name: string, enabled: boolean, options: ManagementOptions = {}): OperationResult {
  const paths = ensureGatewayPaths(options);
  const changed = setMcpConfigEnabled(paths, name, enabled);
  return {
    ok: true,
    changed,
    message: changed ? `"${name}" 已${enabled ? '啟用' : '停用'}` : `"${name}" 狀態未變更`,
  };
}

export async function rescanRegistry(options: ManagementOptions = {}) {
  const paths = ensureGatewayPaths(options);
  const config = loadConfig(paths.configPath);
  return scanAndGenerateRegistry(config, paths.registryPath);
}

async function createConfigFromSource(source: string): Promise<McpServerConfig> {
  const trimmed = source.trim();
  if (!trimmed) throw new Error('MCP 來源不可為空');
  if (trimmed.startsWith('{')) return parseConfigJson(trimmed);
  if (trimmed.startsWith('https://') && !trimmed.includes('github.com')) {
    return { command: 'npx', args: ['-y', 'mcp-remote', trimmed] };
  }
  const packageName = trimmed.includes('github.com') ? await packageNameFromGitHub(trimmed) : trimmed;
  return { command: 'npx', args: ['-y', packageName.endsWith('@latest') ? packageName : `${packageName}@latest`] };
}

function parseConfigJson(raw: string): McpServerConfig {
  const parsed = JSON.parse(raw) as { command?: unknown; args?: unknown; env?: unknown };
  if (typeof parsed.command !== 'string') throw new Error('JSON 設定缺少 command');
  const args = Array.isArray(parsed.args) ? parsed.args.map(String) : [];
  const env = parsed.env && typeof parsed.env === 'object' && !Array.isArray(parsed.env)
    ? parsed.env as Record<string, string>
    : undefined;
  return { command: parsed.command, args, ...(env ? { env } : {}) };
}

async function packageNameFromGitHub(source: string): Promise<string> {
  const match = source.match(/github\.com\/([^/]+)\/([^/\s#]+)/);
  if (!match) return source;
  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/package.json`);
    if (response.ok) {
      const pkg = await response.json() as { name?: string };
      if (pkg.name) return pkg.name;
    }
  } catch {
    // Fall through to repository name.
  }
  return cleanRepo;
}

function classifySource(config: McpServerConfig): { type: McpServerSummary['sourceType']; source: string; packageName?: string } {
  const remoteIndex = config.args.indexOf('mcp-remote');
  if (remoteIndex >= 0) return { type: 'remote', source: config.args[remoteIndex + 1] ?? '(remote)' };
  const pkgIndex = config.args.indexOf('--package');
  if (pkgIndex >= 0 && config.args[pkgIndex + 1]) {
    const packageName = stripNpmVersion(config.args[pkgIndex + 1]);
    return { type: 'npm', source: config.args[pkgIndex + 1], packageName };
  }
  const direct = config.args.find((arg) => arg !== '-y' && !arg.startsWith('-'));
  if (config.command === 'npx' && direct) return { type: 'npm', source: direct, packageName: stripNpmVersion(direct) };
  return { type: 'custom', source: `${config.command} ${config.args.join(' ')}`.trim() };
}

function collectRequiredEnvVars(name: string, config: McpServerConfig): string[] {
  const vars = new Set(getAuthGuide(name).requiredEnvVars);
  const text = JSON.stringify(config);
  for (const match of text.matchAll(/\$\{([A-Z][A-Z0-9_]+)\}/g)) vars.add(match[1]);
  return [...vars];
}

function stripNpmVersion(spec: string): string {
  const at = spec.lastIndexOf('@');
  if (spec.startsWith('@')) return at > spec.indexOf('/') ? spec.slice(0, at) : spec;
  return at > 0 ? spec.slice(0, at) : spec;
}

function summarizeTools(tools: Record<string, RegistryToolEntry>): McpToolSummary[] {
  return Object.entries(tools)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 5)
    .map(([name, tool]) => ({
      name,
      originalName: tool.original_name,
      description: tool.description || '無描述',
    }));
}

function readPackageVersion(packageRoot: string): string {
  const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf-8')) as { version?: string };
  return pkg.version ?? '0.0.0';
}
