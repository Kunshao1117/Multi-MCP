/**
 * Multi-MCP Gateway — 多帳號認證儲存引擎
 * 管理 credentials.json，支援多帳號/多金鑰切換
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ensureUserDataDir, getGatewayPaths } from './paths.js';

const paths = getGatewayPaths();
const CRED_PATH = paths.credentialsPath;
const ENV_PATH = paths.envPath;

/** 單一帳號 */
export interface AccountEntry {
  value: string;
}

/** 單一 MCP 的認證記錄 */
export interface McpCredential {
  active: string;
  authType: 'env_token' | 'oauth_browser' | 'api_key' | 'none';
  envVar: string;
  accounts: Record<string, AccountEntry>;
}

/** 整體認證資料 */
export type CredentialStore = Record<string, McpCredential>;

/** 載入認證資料 */
export function loadCredentials(): CredentialStore {
  if (!existsSync(CRED_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CRED_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

/** 儲存認證資料 */
export function saveCredentials(store: CredentialStore): void {
  ensureUserDataDir();
  writeFileSync(CRED_PATH, JSON.stringify(store, null, 2) + '\n', 'utf-8');
}

/** 新增帳號 */
export function addAccount(
  store: CredentialStore,
  mcpName: string,
  label: string,
  value: string,
  envVar: string,
  authType: McpCredential['authType'] = 'env_token',
): void {
  if (!store[mcpName]) {
    store[mcpName] = { active: label, authType, envVar, accounts: {} };
  }
  store[mcpName].accounts[label] = { value };
  // 如果是第一個帳號，自動設為使用中
  if (Object.keys(store[mcpName].accounts).length === 1) {
    store[mcpName].active = label;
  }
  saveCredentials(store);
}

/** 切換使用中的帳號 */
export function switchAccount(store: CredentialStore, mcpName: string, label: string): boolean {
  const entry = store[mcpName];
  if (!entry || !entry.accounts[label]) return false;
  entry.active = label;
  saveCredentials(store);
  syncToEnvFile(store);
  return true;
}

/** 刪除帳號 */
export function removeAccount(store: CredentialStore, mcpName: string, label: string): boolean {
  const entry = store[mcpName];
  if (!entry || !entry.accounts[label]) return false;
  delete entry.accounts[label];
  // 如果刪除的是使用中，切換到第一個
  if (entry.active === label) {
    const remaining = Object.keys(entry.accounts);
    entry.active = remaining[0] ?? '';
  }
  // 如果完全沒有帳號了，刪除整個記錄
  if (Object.keys(entry.accounts).length === 0) {
    delete store[mcpName];
  }
  saveCredentials(store);
  syncToEnvFile(store);
  return true;
}

/** 更新帳號的密鑰 */
export function updateAccountValue(
  store: CredentialStore,
  mcpName: string,
  label: string,
  newValue: string,
): boolean {
  const entry = store[mcpName];
  if (!entry || !entry.accounts[label]) return false;
  entry.accounts[label].value = newValue;
  saveCredentials(store);
  if (entry.active === label) syncToEnvFile(store);
  return true;
}

/** 將所有使用中帳號的密鑰同步到 gateway.env */
export function syncToEnvFile(store: CredentialStore): void {
  ensureUserDataDir();
  const lines = [
    '# Multi-MCP Gateway — 認證（由主控台自動產生，請勿手動編輯）',
    '# 使用 npx -y multi-mcp-gateway@latest console 管理帳號與密鑰',
    '',
  ];

  for (const [mcpName, cred] of Object.entries(store)) {
    const activeAccount = cred.accounts[cred.active];
    if (!activeAccount || !cred.envVar) continue;
    lines.push(`# --- ${mcpName} (${cred.active}) ---`);
    lines.push(`${cred.envVar}=${activeAccount.value}`);
    lines.push('');
  }

  writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8');
}

/** 從 gateway.env 讀取所有環境變數鍵值對 */
export function parseEnvFile(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const content = readFileSync(ENV_PATH, 'utf-8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    result[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
  }
  return result;
}

/** 遮罩密鑰顯示（只露前4後4） */
export function maskValue(value: string): string {
  if (value.length <= 12) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
