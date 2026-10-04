import type { McpServerConfig } from '../../../src/types.js';
import type { McpServerSummary } from '../../../src/management/types.js';

export interface McpFormPayload {
  mode: 'install' | 'edit';
  currentName?: string;
  nextName: string;
  category: string;
  sourceMode: 'npm' | 'remote' | 'custom' | 'json';
  source: string;
  command: string;
  args: string[];
  editedFields: Array<'command' | 'args'>;
  credential?: { envVar: string; label: string };
  rescan: boolean;
}

export interface FormDraft {
  draftId: string;
  kind: 'mcp' | 'credential';
  mode: 'install' | 'edit';
  currentName: string;
  nextName: string;
  category: string;
  sourceMode: McpFormPayload['sourceMode'];
  source: string;
  command: string;
  argsText: string;
  jsonText: string;
  originalConfig?: McpServerConfig;
  originalSource: string;
  originalSourceMode: McpFormPayload['sourceMode'];
  rescan: boolean;
  saveCredential: boolean;
  credentialEnvVar: string;
  credentialLabel: string;
  credentialSummary: string;
  credentialLocked: boolean;
  accountLabels: string[];
  activeLabel: string;
  sensitiveDraftLost: boolean;
}

export interface PendingFormOperation {
  operationId: string;
  draftId: string;
}

export interface FormResult {
  operationId: string;
  ok: boolean;
  committed?: boolean;
  outcomeUnknown?: boolean;
  savedName?: string;
  message?: string;
}

/** A self-contained model shared by the host, generated webview and dependency-free tests. */
export function createFormModel() {
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const id = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const argsText = (args: string[]) => JSON.stringify(args, null, 2);
  function parseArgs(text: string): string[] {
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new Error('args 必須是 JSON 字串陣列，例如 ["-y", "server"]'); }
    if (!Array.isArray(value) || value.some((arg) => typeof arg !== 'string')) throw new Error('args 必須是 JSON 字串陣列');
    return value;
  }
  function validateConfig(value: unknown): McpServerConfig {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('MCP 設定必須是物件');
    const config = value as McpServerConfig;
    if (typeof config.command !== 'string' || !config.command.trim()) throw new Error('Command is required.');
    if (!Array.isArray(config.args) || config.args.some((arg) => typeof arg !== 'string')) throw new Error('args 必須是字串陣列');
    if (config.env !== undefined && (!config.env || typeof config.env !== 'object' || Array.isArray(config.env) || Object.values(config.env).some((value) => typeof value !== 'string'))) throw new Error('env 必須是字串值的物件');
    if (config.preload !== undefined && typeof config.preload !== 'boolean') throw new Error('preload 必須是 boolean');
    return clone(config);
  }
  function parseJson(raw: string, currentName?: string, nextName?: string): McpServerConfig {
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error('The pasted JSON is invalid.'); }
    if (value && typeof value === 'object' && !Array.isArray(value) && 'mcpServers' in value) {
      const servers = (value as { mcpServers: unknown }).mcpServers;
      if (!servers || typeof servers !== 'object' || Array.isArray(servers)) throw new Error('mcpServers 必須是物件');
      const entries = Object.entries(servers);
      const selected = entries.find(([name]) => name === currentName || name === nextName) ?? (entries.length === 1 ? entries[0] : undefined);
      if (!selected) throw new Error('請指定 JSON 中要儲存的 MCP 名稱');
      value = selected[1];
    }
    return validateConfig(value);
  }
  function createInstall(sourceMode: McpFormPayload['sourceMode'], category = '未分類'): FormDraft {
    return {
      draftId: id(), kind: 'mcp', mode: 'install', currentName: '', nextName: '', category,
      sourceMode, source: '', originalSource: '', originalSourceMode: sourceMode,
      command: 'npx', argsText: '[]', jsonText: '', rescan: true, saveCredential: false,
      credentialEnvVar: '', credentialLabel: 'default', credentialSummary: '目前未設定金鑰；安裝後可再補。',
      credentialLocked: false, accountLabels: [], activeLabel: '', sensitiveDraftLost: false,
    };
  }
  function createEdit(server: McpServerSummary): FormDraft {
    const form = createInstall(server.sourceType, server.category || '未分類');
    return { ...form, mode: 'edit', currentName: server.name, nextName: server.name,
      source: server.source ?? '', originalSource: server.source ?? '', originalConfig: clone(server.config),
      command: server.config.command, argsText: argsText(server.config.args), jsonText: JSON.stringify(server.config, null, 2),
      rescan: false, credentialEnvVar: server.credential?.envVar ?? server.requiredEnvVars?.[0] ?? '',
      credentialLabel: server.credential?.active ?? 'default', credentialLocked: !!server.credential,
      accountLabels: [...(server.credential?.accountLabels ?? [])], activeLabel: server.credential?.active ?? '',
      credentialSummary: server.credential?.active ? '目前使用：' + server.credential.active : '尚未設定金鑰',
    };
  }
  function createCredential(server: McpServerSummary): FormDraft {
    return { ...createEdit(server), kind: 'credential' };
  }
  function defaultName(source: string): string {
    if (/^https?:\/\//.test(source)) {
      try { return new URL(source).hostname.replace(/\./g, '-'); } catch { return ''; }
    }
    return (source.split('/').pop() ?? '').replace(/@[^@]*$/, '');
  }
  /** Invoke only on an explicit source edit or type switch, never on general DOM sync. */
  function applySourceDefaults(form: FormDraft): void {
    if (form.sourceMode === 'npm' && form.source.trim()) {
      const source = form.source.trim();
      const separator = source.lastIndexOf('@');
      const hasVersion = separator > (source.startsWith('@') ? source.indexOf('/') : 0);
      const packageSpec = hasVersion || /^(?:git\+|git@|https?:|github:|file:)/.test(source) || (!source.startsWith('@') && source.includes('/')) ? source : source + '@latest';
      form.command = 'npx';
      form.argsText = argsText(['-y', packageSpec]);
    } else if (form.sourceMode === 'remote' && form.source.trim()) {
      form.command = 'npx';
      form.argsText = argsText(['-y', 'mcp-remote', form.source.trim()]);
    }
    if (!form.nextName && form.sourceMode !== 'json') form.nextName = defaultName(form.source);
  }
  function buildPayload(form: FormDraft): McpFormPayload {
    if (form.kind !== 'mcp') throw new Error('MCP 設定表單未開啟');
    if (form.sensitiveDraftLost) throw new Error('請重新輸入未保存的來源／啟動設定，或確認使用目前顯示的設定');
    const args = form.sourceMode === 'json' ? [] : parseArgs(form.argsText);
    const editedFields: McpFormPayload['editedFields'] = [];
    if (!form.originalConfig || form.command !== form.originalConfig.command) editedFields.push('command');
    if (!form.originalConfig || JSON.stringify(args) !== JSON.stringify(form.originalConfig.args)) editedFields.push('args');
    const payload: McpFormPayload = { mode: form.mode, currentName: form.currentName || undefined,
      nextName: form.nextName.trim(), category: form.category.trim(), sourceMode: form.sourceMode,
      source: form.sourceMode === 'json' ? form.jsonText : form.source.trim(), command: form.command,
      args, editedFields, rescan: form.rescan };
    if (form.saveCredential) {
      const envVar = form.credentialEnvVar.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envVar)) throw new Error('目前每個 MCP 僅支援一個金鑰環境變數，請填入單一有效名稱');
      payload.credential = { envVar, label: form.credentialLabel.trim() || 'default' };
    }
    return payload;
  }
  function configFromPayload(payload: McpFormPayload, existing?: McpServerConfig): McpServerConfig {
    if (payload.sourceMode === 'json') return parseJson(payload.source, payload.currentName, payload.nextName);
    if (payload.mode === 'edit' && !existing) throw new Error('原 MCP 已不存在；請重新開啟編輯表單');
    const config = existing ? clone(existing) : { command: payload.command, args: [...payload.args] };
    if (!existing || payload.editedFields.includes('command')) config.command = payload.command;
    if (!existing || payload.editedFields.includes('args')) config.args = [...payload.args];
    return validateConfig(config);
  }
  function hasSensitiveChanges(form: FormDraft): boolean {
    if (form.kind === 'credential') return false;
    if (!form.originalConfig) return !!(form.source || form.jsonText || form.argsText !== '[]' || form.command !== 'npx');
    return form.source !== form.originalSource || form.sourceMode !== form.originalSourceMode || form.command !== form.originalConfig.command || form.argsText !== argsText(form.originalConfig.args) || form.jsonText !== JSON.stringify(form.originalConfig, null, 2);
  }
  function persist(form: FormDraft | null): Record<string, unknown> | null {
    if (!form) return null;
    // Deliberate allowlist. Source URLs, command/args, JSON and config/env may all contain literal secrets.
    return { version: 1, draftId: form.draftId, kind: form.kind, mode: form.mode, currentName: form.currentName,
      nextName: form.nextName, category: form.category, sourceMode: form.sourceMode,
      rescan: form.rescan, saveCredential: form.saveCredential,
      credentialEnvVar: /^[A-Za-z_][A-Za-z0-9_]*$/.test(form.credentialEnvVar) ? form.credentialEnvVar : '',
      credentialLabel: form.credentialLabel,
      sensitiveDraftLost: form.sensitiveDraftLost || hasSensitiveChanges(form) };
  }
  function safeId(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= 200 && /^[a-z0-9:-]+$/.test(value);
  }
  function persistPending(pending: PendingFormOperation | null, form: FormDraft | null): PendingFormOperation | null {
    if (!form || !pending || pending.draftId !== form.draftId || !safeId(pending.operationId) || !safeId(pending.draftId)) return null;
    // Correlation metadata only. Never save the mutation payload or any credential values.
    return { operationId: pending.operationId, draftId: pending.draftId };
  }
  function newOperationId(form: FormDraft): string { return form.draftId + ':' + id(); }
  function restore(saved: unknown, servers: McpServerSummary[], savedPending?: unknown): { form: FormDraft | null; pending: PendingFormOperation | null; notice: string } {
    const empty = { form: null, pending: null, notice: '' };
    if (!saved || typeof saved !== 'object') return empty;
    const draft = saved as Record<string, unknown>;
    if (draft.version !== 1 || !['mcp', 'credential'].includes(String(draft.kind)) || !['edit', 'install'].includes(String(draft.mode))) return empty;
    const candidatePending = savedPending && typeof savedPending === 'object' ? savedPending as Record<string, unknown> : null;
    const pending = candidatePending && safeId(candidatePending.operationId) && safeId(candidatePending.draftId) && candidatePending.draftId === draft.draftId
      ? { operationId: candidatePending.operationId, draftId: candidatePending.draftId } : null;
    const server = servers.find((server) => server.name === draft.currentName);
    if ((draft.mode === 'edit' || draft.kind === 'credential') && !server && !pending) return { ...empty, notice: '原 MCP 已移除或重新命名，已清除過期草稿。請重新選擇 MCP。' };
    // A pending rename may already be committed before its scan/ack completes, so its old name
    // can legitimately be absent. Retain a metadata-only shell until the host reports the outcome.
    const form = server ? (draft.kind === 'credential' ? createCredential(server) : createEdit(server)) : createInstall(['npm', 'remote', 'custom', 'json'].includes(String(draft.sourceMode)) ? draft.sourceMode as McpFormPayload['sourceMode'] : 'npm');
    if (safeId(draft.draftId)) form.draftId = draft.draftId;
    form.kind = draft.kind as FormDraft['kind'];
    form.mode = draft.mode as FormDraft['mode'];
    if (typeof draft.currentName === 'string') form.currentName = draft.currentName;
    for (const key of ['nextName', 'category', 'credentialEnvVar', 'credentialLabel'] as const) {
      const value = draft[key];
      if (typeof value === 'string') form[key] = value;
    }
    form.rescan = draft.rescan === true;
    form.saveCredential = draft.saveCredential === true;
    form.sensitiveDraftLost = draft.sensitiveDraftLost === true;
    if (form.credentialLocked) form.credentialEnvVar = server!.credential!.envVar;
    return { form, pending, notice: pending ? '正在確認上次提交的結果，請稍候…' : form.sensitiveDraftLost ? '已還原名稱／分類等草稿。來源、JSON、command、args 等可能含金鑰，未持久保存；請重新輸入或確認目前設定。' : '' };
  }
  function settle(form: FormDraft | null, pending: PendingFormOperation | null, result: FormResult, servers: McpServerSummary[]): FormDraft | null {
    if (!form || !pending || pending.operationId !== result.operationId || pending.draftId !== form.draftId) return form;
    if (result.outcomeUnknown) return null;
    if (!result.ok && !result.committed) return form;
    const server = servers.find((server) => server.name === result.savedName);
    if (!server) return null;
    return form.kind === 'credential' ? createCredential(server) : createEdit(server);
  }
  return { createInstall, createEdit, createCredential, applySourceDefaults, buildPayload, configFromPayload,
    parseArgs, parseJson, validateConfig, persist, persistPending, newOperationId, restore, settle };
}
