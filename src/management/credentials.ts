import { readFileSync } from 'node:fs';
import type { GatewayPaths } from '../paths.js';
import { ensureGatewayPaths, resolveGatewayPaths, assertGatewayPathsSafe } from './files.js';
import { assertSafePath, commitFileChanges, fileStat, validatePathSegment, withDataLock, type FileChange } from './storage.js';
import type { CredentialInput, CredentialSummary, ManagementOptions, OperationResult } from './types.js';

export interface AccountEntry { value: string }
export interface McpCredential {
  active: string;
  authType: CredentialSummary['authType'];
  envVar: string;
  accounts: Record<string, AccountEntry>;
}
export type CredentialStore = Record<string, McpCredential>;
const RUNTIME_NOTICE = ' 執行中的 Gateway 請重新連線，或呼叫 Gateway 自己的 rescan/reload。';
const revisions = new WeakMap<CredentialStore, string | undefined>();
const own = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));

function validateLabel(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || /[\x00-\x1f\x7f]/u.test(value)
    || ['__proto__', 'constructor', 'prototype'].includes(value)) throw new Error('認證標籤無效');
}
function validateValue(value: unknown): asserts value is string {
  if (typeof value !== 'string' || /[\r\n\0]/u.test(value)) throw new Error('認證值必須是單行字串');
}
function validateEnvVar(value: unknown, emptyAllowed = false): asserts value is string {
  if (typeof value !== 'string' || (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value) && !(emptyAllowed && value === ''))) {
    throw new Error('環境變數名稱無效；一次只支援一個鍵');
  }
}
export function validateCredentialStore(value: unknown): asserts value is CredentialStore {
  if (!record(value)) throw new Error('認證資料格式無效；原始檔案已保留');
  for (const [name, credential] of Object.entries(value)) {
    validatePathSegment(name, 'MCP 名稱');
    if (!record(credential) || !['env_token', 'oauth_browser', 'api_key', 'none'].includes(String(credential.authType))
      || !record(credential.accounts) || typeof credential.active !== 'string') throw new Error('認證資料格式無效；原始檔案已保留');
    validateEnvVar(credential.envVar, credential.authType === 'oauth_browser' || credential.authType === 'none');
    for (const [label, account] of Object.entries(credential.accounts)) {
      validateLabel(label);
      if (!record(account)) throw new Error('認證帳號格式無效；原始檔案已保留');
      validateValue(account.value);
    }
    if (Object.keys(credential.accounts).length ? !own(credential.accounts, credential.active) : credential.active !== '') {
      throw new Error('使用中的認證帳號不存在；原始檔案已保留');
    }
  }
}

export function validateCredentialInput(input: CredentialInput): void {
  validatePathSegment(input.mcpName, 'MCP 名稱');
  validateLabel(input.label);
  validateValue(input.value);
  validateEnvVar(input.envVar);
  if (input.authType !== undefined && !['env_token', 'oauth_browser', 'api_key', 'none'].includes(input.authType)) throw new Error('認證類型無效');
}

export function loadCredentialStore(paths: GatewayPaths): CredentialStore {
  assertSafePath(paths.dataDir, paths.credentialsPath);
  const stat = fileStat(paths.credentialsPath);
  if (stat && !stat.isFile()) throw new Error('認證資料必須是一般檔案');
  const raw = stat ? readFileSync(paths.credentialsPath, 'utf-8') : undefined;
  let store: unknown;
  try { store = raw === undefined ? {} : JSON.parse(raw); }
  catch { throw new Error('認證資料無法解析；原始檔案已保留，請先修復'); }
  validateCredentialStore(store);
  revisions.set(store, raw);
  return store;
}

/** Preserve existing labels and the explicit active-account selection. */
export function applyCredentialInput(store: CredentialStore, input: CredentialInput): void {
  validateCredentialStore(store);
  validateCredentialInput(input);
  if (own(store, input.mcpName) && store[input.mcpName].envVar !== input.envVar) {
    throw new Error('每個 MCP 的認證目前只支援一個環境變數；不可覆寫成另一個鍵。請保留原鍵，或先明確刪除原認證再設定');
  }
  if (!own(store, input.mcpName)) {
    store[input.mcpName] = { active: input.label, authType: input.authType ?? 'env_token', envVar: input.envVar, accounts: {} };
  }
  const credential = store[input.mcpName];
  credential.authType = input.authType ?? credential.authType;
  credential.accounts[input.label] = { value: input.value };
  if (!credential.active || !own(credential.accounts, credential.active)) credential.active = input.label;
}

export function credentialFileChanges(paths: GatewayPaths, store: CredentialStore): FileChange[] {
  validateCredentialStore(store);
  return [
    { path: paths.credentialsPath, data: `${JSON.stringify(store, null, 2)}\n`, mode: 0o600 },
    { path: paths.envPath, data: renderGatewayEnv(store), mode: 0o600 },
  ];
}

export function saveCredentialStore(paths: GatewayPaths, store: CredentialStore): void {
  validateCredentialStore(store);
  withDataLock(paths.dataDir, () => {
    // A damaged on-disk store must never become an implicit empty replacement.
    loadCredentialStore(paths);
    if (revisions.has(store)) {
      const current = fileStat(paths.credentialsPath) ? readFileSync(paths.credentialsPath, 'utf-8') : undefined;
      if (current !== revisions.get(store)) throw new Error('認證資料已由其他操作更新，請重新載入後再試');
    }
    commitFileChanges(paths.dataDir, credentialFileChanges(paths, store));
    revisions.set(store, readFileSync(paths.credentialsPath, 'utf-8'));
  });
}

export function summarizeCredential(store: CredentialStore, mcpName: string): CredentialSummary | undefined {
  const credential = own(store, mcpName) ? store[mcpName] : undefined;
  if (!credential) return undefined;
  const active = credential.accounts[credential.active];
  return {
    authType: credential.authType, envVar: credential.envVar, active: credential.active || undefined,
    accountCount: Object.keys(credential.accounts).length, accountLabels: Object.keys(credential.accounts),
    maskedValue: active ? maskSecret(active.value) : undefined,
  };
}

export function writeCredential(paths: GatewayPaths, input: CredentialInput): void {
  validateCredentialInput(input);
  withDataLock(paths.dataDir, () => {
    const store = loadCredentialStore(paths);
    applyCredentialInput(store, input);
    saveCredentialStore(paths, store);
  });
}

export function switchCredentialInStore(paths: GatewayPaths, mcpName: string, label: string): boolean {
  validatePathSegment(mcpName, 'MCP 名稱'); validateLabel(label);
  return withDataLock(paths.dataDir, () => {
    const store = loadCredentialStore(paths);
    const credential = store[mcpName];
    if (!credential || !own(credential.accounts, label)) return false;
    credential.active = label;
    saveCredentialStore(paths, store);
    return true;
  });
}

export function deleteCredentialFromStore(paths: GatewayPaths, mcpName: string, label?: string): boolean {
  validatePathSegment(mcpName, 'MCP 名稱'); if (label !== undefined) validateLabel(label);
  return withDataLock(paths.dataDir, () => {
    const store = loadCredentialStore(paths);
    const credential = store[mcpName];
    if (!credential) return false;
    if (label === undefined) delete store[mcpName];
    else {
      if (!own(credential.accounts, label)) return false;
      delete credential.accounts[label];
      if (credential.active === label) credential.active = Object.keys(credential.accounts)[0] ?? '';
      if (!Object.keys(credential.accounts).length) delete store[mcpName];
    }
    saveCredentialStore(paths, store);
    return true;
  });
}

export function renameCredentialInStore(paths: GatewayPaths, fromName: string, toName: string): boolean {
  validatePathSegment(fromName, 'MCP 名稱'); validatePathSegment(toName, 'MCP 名稱');
  if (fromName === toName) return false;
  return withDataLock(paths.dataDir, () => {
    const store = loadCredentialStore(paths);
    if (!store[fromName]) return false;
    if (store[toName]) throw new Error(`"${toName}" 認證已存在`);
    store[toName] = store[fromName]; delete store[fromName];
    saveCredentialStore(paths, store);
    return true;
  });
}

function renderGatewayEnv(store: CredentialStore): string {
  const lines = [
    '# Multi-MCP Gateway - credentials generated by the VS Code extension or management API',
    '# Manage these values from the Multi-MCP VS Code activity bar.', '',
  ];
  const values = new Map<string, string>();
  for (const [mcpName, credential] of Object.entries(store)) {
    const active = credential.accounts[credential.active];
    if (!active || !credential.envVar) continue;
    if (values.has(credential.envVar) && values.get(credential.envVar) !== active.value) throw new Error('多個 MCP 對同一環境變數設定不同值，請先解決衝突');
    values.set(credential.envVar, active.value);
    lines.push(`# --- ${mcpName} (${credential.active}) ---`, `${credential.envVar}=${active.value}`, '');
  }
  return lines.join('\n');
}

export function syncGatewayEnv(paths: GatewayPaths, store = loadCredentialStore(paths)): void {
  validateCredentialStore(store);
  withDataLock(paths.dataDir, () => {
    const current = loadCredentialStore(paths);
    if (JSON.stringify(current) !== JSON.stringify(store)) throw new Error('認證資料與目前檔案不同，請先保存或重新載入');
    commitFileChanges(paths.dataDir, [{ path: paths.envPath, data: renderGatewayEnv(store), mode: 0o600 }]);
  });
}

export function maskSecret(value: string): string {
  if (value.length <= 12) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function prepareCredentialPaths(options: ManagementOptions): GatewayPaths {
  const paths = resolveGatewayPaths(options);
  assertGatewayPathsSafe(paths);
  loadCredentialStore(paths);
  return ensureGatewayPaths(options);
}

export function upsertCredential(input: CredentialInput, options: ManagementOptions = {}): OperationResult {
  validateCredentialInput(input);
  // Validate the existing key mapping before initialization can seed any files.
  const current = loadCredentialStore(resolveGatewayPaths(options));
  applyCredentialInput(current, input);
  credentialFileChanges(resolveGatewayPaths(options), current);
  const paths = prepareCredentialPaths(options);
  writeCredential(paths, input);
  return { ok: true, changed: true, message: `"${input.mcpName}" 認證已保存` + RUNTIME_NOTICE };
}

export function switchCredential(mcpName: string, label: string, options: ManagementOptions = {}): OperationResult {
  validatePathSegment(mcpName, 'MCP 名稱'); validateLabel(label);
  const paths = prepareCredentialPaths(options);
  const changed = switchCredentialInStore(paths, mcpName, label);
  return { ok: changed, changed, message: changed ? `"${mcpName}" 已切換到 "${label}"` + RUNTIME_NOTICE : `找不到 "${label}"` };
}

export function deleteCredential(mcpName: string, label?: string, options: ManagementOptions = {}): OperationResult {
  validatePathSegment(mcpName, 'MCP 名稱'); if (label !== undefined) validateLabel(label);
  const paths = prepareCredentialPaths(options);
  const changed = deleteCredentialFromStore(paths, mcpName, label);
  return { ok: changed, changed, message: changed ? `"${mcpName}" 認證已刪除` + RUNTIME_NOTICE : `找不到 "${mcpName}" 認證` };
}
