/** Legacy credential API, backed by the same validated atomic storage as management. */
import { readFileSync } from 'node:fs';
import { getGatewayPaths } from './paths.js';
import { ensureGatewayPaths } from './management/files.js';
import {
  applyCredentialInput, loadCredentialStore, maskSecret, saveCredentialStore,
  syncGatewayEnv, validateCredentialStore,
  type AccountEntry, type McpCredential, type CredentialStore,
} from './management/credentials.js';
import { assertSafePath, fileStat } from './management/storage.js';
export type { AccountEntry, McpCredential, CredentialStore };

const paths = getGatewayPaths();

export function loadCredentials(): CredentialStore {
  return loadCredentialStore(paths);
}

export function saveCredentials(store: CredentialStore): void {
  validateCredentialStore(store);
  // Check corruption before initialization writes any generated files.
  loadCredentialStore(paths);
  ensureGatewayPaths({ dataDir: paths.dataDir });
  saveCredentialStore(paths, store);
}

export function addAccount(
  store: CredentialStore, mcpName: string, label: string, value: string, envVar: string,
  authType: McpCredential['authType'] = 'env_token',
): void {
  applyCredentialInput(store, { mcpName, label, value, envVar, authType });
  saveCredentials(store);
}

export function switchAccount(store: CredentialStore, mcpName: string, label: string): boolean {
  validateCredentialStore(store);
  const entry = Object.prototype.hasOwnProperty.call(store, mcpName) ? store[mcpName] : undefined;
  if (!entry || !Object.prototype.hasOwnProperty.call(entry.accounts, label)) return false;
  entry.active = label;
  saveCredentials(store);
  return true;
}

export function removeAccount(store: CredentialStore, mcpName: string, label: string): boolean {
  validateCredentialStore(store);
  const entry = Object.prototype.hasOwnProperty.call(store, mcpName) ? store[mcpName] : undefined;
  if (!entry || !Object.prototype.hasOwnProperty.call(entry.accounts, label)) return false;
  delete entry.accounts[label];
  if (entry.active === label) entry.active = Object.keys(entry.accounts)[0] ?? '';
  if (!Object.keys(entry.accounts).length) delete store[mcpName];
  saveCredentials(store);
  return true;
}

export function updateAccountValue(store: CredentialStore, mcpName: string, label: string, newValue: string): boolean {
  validateCredentialStore(store);
  const entry = Object.prototype.hasOwnProperty.call(store, mcpName) ? store[mcpName] : undefined;
  if (!entry || !Object.prototype.hasOwnProperty.call(entry.accounts, label)) return false;
  entry.accounts[label].value = newValue;
  saveCredentials(store);
  return true;
}

export function syncToEnvFile(store: CredentialStore): void {
  validateCredentialStore(store);
  loadCredentialStore(paths);
  ensureGatewayPaths({ dataDir: paths.dataDir });
  syncGatewayEnv(paths, store);
}

export function parseEnvFile(): Record<string, string> {
  assertSafePath(paths.dataDir, paths.envPath);
  if (!fileStat(paths.envPath)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(paths.envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || ['__proto__', 'prototype', 'constructor'].includes(key)) continue;
    result[key] = trimmed.substring(eqIdx + 1).trim();
  }
  return result;
}

export function maskValue(value: string): string { return maskSecret(value); }
