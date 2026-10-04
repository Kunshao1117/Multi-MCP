import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { getCoreVersion } from '../version.js';
import { loadConfig, validateMcpServerConfig } from '../config-loader.js';
import { scanAndGenerateRegistry } from '../registry.js';
import type { McpServerConfig, RegistryToolEntry } from '../types.js';
import { getAuthGuide } from '../auth-guides.js';
import {
  applyCredentialInput, credentialFileChanges, loadCredentialStore, summarizeCredential,
  type CredentialStore,
} from './credentials.js';
import {
  assertGatewayPathsSafe, ensureGatewayPaths, findMcpConfigFile, listMcpConfigFiles, loadRegistrySnapshot,
  planSaveMcpConfig, planUpdateMcpConfig, resolveGatewayPaths, setMcpConfigEnabled,
} from './files.js';
import { commitFileChanges, removeEmptyDirectory, validatePathSegment, withDataLock } from './storage.js';
import type {
  GatewayStatus,
  ManagementOptions,
  McpInstallInput,
  McpServerSummary,
  McpToolSummary,
  McpUpdateInput,
  OperationResult,
} from './types.js';

const RUNTIME_NOTICE = ' 執行中的 Gateway 請重新連線，或呼叫 Gateway 自己的 rescan/reload。';

export function getGatewayStatus(options: ManagementOptions = {}): GatewayStatus {
  const paths = resolveGatewayPaths(options);
  const registry = loadRegistrySnapshot(paths);
  const servers = listMcpConfigFiles(paths);
  return {
    packageVersion: getCoreVersion(),
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

function preflightPaths(options: ManagementOptions) {
  const paths = resolveGatewayPaths(options);
  assertGatewayPathsSafe(paths);
  listMcpConfigFiles(paths);
  loadCredentialStore(paths);
  return paths;
}

function applyEditedCredential(store: CredentialStore, currentName: string, nextName: string, credential?: McpUpdateInput['credential']) {
  if (currentName !== nextName) {
    if (store[nextName]) throw new Error(`"${nextName}" 認證已存在`);
    if (store[currentName]) { store[nextName] = store[currentName]; delete store[currentName]; }
  }
  if (credential) applyCredentialInput(store, { ...credential, mcpName: nextName });
}

async function afterSave(name: string, action: string, rescan: boolean | undefined, options: ManagementOptions): Promise<OperationResult> {
  if (rescan) {
    try {
      const registry = await rescanRegistry(options);
      const failedServers = Object.entries(registry.servers)
        .filter(([, entry]) => 'stale' in entry && entry.stale === true).map(([server]) => server);
      if (failedServers.length) return { ok: false, changed: true, committed: true, savedName: name, failedServers,
        message: `"${name}" 已${action}，但以下 MCP 掃描失敗（保留舊工具快取）：${failedServers.join(', ')}` + RUNTIME_NOTICE };
    } catch {
      return { ok: false, changed: true, committed: true, savedName: name,
        message: `"${name}" 已${action}，但重新掃描失敗；設定與認證已保存，請修復掃描問題後重試掃描` + RUNTIME_NOTICE };
    }
  }
  return { ok: true, changed: true, committed: true, savedName: name, message: `"${name}" 已${action}` + RUNTIME_NOTICE };
}

export async function installMcp(input: McpInstallInput, options: ManagementOptions = {}): Promise<OperationResult> {
  const name = input.name.trim();
  const category = input.category.trim();
  if (!name || !category) return { ok: false, message: 'MCP 名稱與分類不可為空' };
  validatePathSegment(name, 'MCP 名稱'); validatePathSegment(category, '分類');
  const config = input.config ?? await createConfigFromSource(input.source ?? '');
  validateMcpServerConfig(config);
  const before = preflightPaths(options);
  const existing = findMcpConfigFile(before, name);
  if (existing && (!input.overwrite || existing.name !== name)) return { ok: false, message: `"${name}" 已存在` };
  if (existing) planUpdateMcpConfig(before, { currentName: name, nextName: name, category, config });
  else planSaveMcpConfig(before, category, name, config);
  const credentials = loadCredentialStore(before);
  if (input.credential) applyCredentialInput(credentials, { ...input.credential, mcpName: name });
  credentialFileChanges(before, credentials);
  const paths = ensureGatewayPaths(options);
  const result = withDataLock(paths.dataDir, () => {
    const existingNow = findMcpConfigFile(paths, name);
    if (existingNow && (!input.overwrite || existingNow.name !== name)) return { ok: false, message: `"${name}" 已存在` };
    const updated = existingNow ? planUpdateMcpConfig(paths, { currentName: name, nextName: name, category, config }) : undefined;
    const store = loadCredentialStore(paths);
    if (input.credential) applyCredentialInput(store, { ...input.credential, mcpName: name });
    commitFileChanges(paths.dataDir, [
      ...(updated ? updated.changes : [planSaveMcpConfig(paths, category, name, config)]),
      ...(input.credential ? credentialFileChanges(paths, store) : []),
    ]);
    if (updated && updated.oldPath !== updated.newPath) removeEmptyDirectory(dirname(updated.oldPath));
    return undefined;
  });
  if (result) return result;
  return afterSave(name, '安裝', input.rescan, options);
}

export async function removeMcp(name: string, options: ManagementOptions = {}): Promise<OperationResult> {
  validatePathSegment(name, 'MCP 名稱');
  const before = preflightPaths(options);
  if (!findMcpConfigFile(before, name)) return { ok: false, message: `找不到 "${name}"` };
  const paths = ensureGatewayPaths(options);
  return withDataLock(paths.dataDir, () => {
    const entry = findMcpConfigFile(paths, name);
    if (!entry) return { ok: false, message: `找不到 "${name}"` };
    const store = loadCredentialStore(paths);
    const hadCredential = !!store[entry.name];
    delete store[entry.name];
    commitFileChanges(paths.dataDir, [{ path: entry.path, data: null }, ...(hadCredential ? credentialFileChanges(paths, store) : [])]);
    removeEmptyDirectory(dirname(entry.path));
    return { ok: true, changed: true, committed: true, message: `"${entry.name}" 已移除` + RUNTIME_NOTICE };
  });
}

export function setMcpEnabled(name: string, enabled: boolean, options: ManagementOptions = {}): OperationResult {
  validatePathSegment(name, 'MCP 名稱');
  if (typeof enabled !== 'boolean') throw new Error('啟用狀態必須是布林值');
  const before = preflightPaths(options);
  if (!findMcpConfigFile(before, name)) return { ok: false, message: `找不到 "${name}"` };
  const paths = ensureGatewayPaths(options);
  const changed = setMcpConfigEnabled(paths, name, enabled);
  return { ok: true, changed, message: changed ? `"${name}" 已${enabled ? '啟用' : '停用'}` + RUNTIME_NOTICE : `"${name}" 狀態未變更` };
}

export async function updateMcp(input: McpUpdateInput, options: ManagementOptions = {}): Promise<OperationResult> {
  const currentName = input.currentName.trim();
  const nextName = input.nextName.trim();
  const category = input.category.trim();
  if (!currentName || !nextName || !category) return { ok: false, message: 'MCP 名稱與分類不可為空' };
  validatePathSegment(currentName, 'MCP 名稱'); validatePathSegment(nextName, 'MCP 名稱'); validatePathSegment(category, '分類');
  validateMcpServerConfig(input.config);
  const before = preflightPaths(options);
  const existing = findMcpConfigFile(before, currentName);
  if (!existing) return { ok: false, message: `找不到 "${currentName}"` };
  const conflict = findMcpConfigFile(before, nextName);
  if (conflict && conflict.path !== existing.path) return { ok: false, message: `"${nextName}" 已存在` };
  const credentials = loadCredentialStore(before);
  if (existing.name !== nextName && credentials[nextName]) return { ok: false, message: `"${nextName}" 認證已存在` };
  applyEditedCredential(credentials, existing.name, nextName, input.credential);
  credentialFileChanges(before, credentials);
  planUpdateMcpConfig(before, { currentName, nextName, category, config: input.config });
  const paths = ensureGatewayPaths(options);
  withDataLock(paths.dataDir, () => {
    const updated = planUpdateMcpConfig(paths, { currentName, nextName, category, config: input.config });
    const store = loadCredentialStore(paths);
    const originalName = findMcpConfigFile(paths, currentName)!.name;
    const hadCredential = !!store[originalName];
    applyEditedCredential(store, originalName, nextName, input.credential);
    commitFileChanges(paths.dataDir, [
      ...updated.changes,
      ...((updated.renamed && hadCredential) || input.credential ? credentialFileChanges(paths, store) : []),
    ]);
    if (updated.oldPath !== updated.newPath) removeEmptyDirectory(dirname(updated.oldPath));
  });
  return afterSave(nextName, '更新', input.rescan, options);
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
  // Only a bare npm package receives the default tag; explicit versions, ranges and tags stay verbatim.
  const barePackage = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(packageName);
  return { command: 'npx', args: ['-y', barePackage ? `${packageName}@latest` : packageName] };
}

function parseConfigJson(raw: string): McpServerConfig {
  return validateMcpServerConfig(JSON.parse(raw));
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

