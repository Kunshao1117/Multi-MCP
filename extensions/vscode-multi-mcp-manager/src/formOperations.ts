import type { McpFormPayload } from './formModel.js';
import { createFormModel } from './formModel.js';
import type { CredentialInput, McpInstallInput, McpUpdateInput, McpServerSummary, OperationResult } from '../../../src/management/types.js';
import type { McpServerConfig } from '../../../src/types.js';

export interface FormServices {
  listServers(): McpServerSummary[];
  collectCredential(name: string, envVar: string, label: string): Promise<Omit<CredentialInput, 'mcpName'> | undefined>;
  confirmOverwrite(name: string): Promise<boolean | undefined>;
  confirmEdit(currentName: string, nextName: string, category: string, config: McpServerConfig, rescan: boolean): Promise<boolean>;
  install(input: McpInstallInput): Promise<OperationResult>;
  update(input: McpUpdateInput): Promise<OperationResult>;
}

/** All mutation inputs, including credential, are passed to one management transaction before scanning. */
export async function submitMcpForm(payload: McpFormPayload, services: FormServices): Promise<OperationResult> {
  const nextName = payload.nextName.trim();
  const category = payload.category.trim();
  if (!nextName || !category) return { ok: false, message: 'MCP name and category are required.' };
  const existing = services.listServers().find((server) => server.name === payload.currentName);
  const config = createFormModel().configFromPayload(payload, payload.mode === 'edit' ? existing?.config : undefined);
  if (payload.mode === 'edit' && !payload.currentName) return { ok: false, message: 'Current MCP name is missing.' };
  const credential = payload.credential
    ? await services.collectCredential(nextName, payload.credential.envVar, payload.credential.label)
    : undefined;
  if (payload.credential && !credential) return { ok: false, message: '已取消，草稿仍保留。' };
  if (payload.mode === 'install') {
    const overwrite = services.listServers().some((server) => server.name === nextName) ? await services.confirmOverwrite(nextName) : false;
    if (overwrite === undefined) return { ok: false, message: '已取消，草稿仍保留。' };
    return services.install({ name: nextName, category, config, credential, overwrite, rescan: payload.rescan });
  }
  if (!await services.confirmEdit(payload.currentName!, nextName, category, config, payload.rescan)) return { ok: false, message: '已取消，草稿仍保留。' };
  return services.update({ currentName: payload.currentName!, nextName, category, config, credential, rescan: payload.rescan });
}

/** Host-side duplicate protection also covers prompts that outlive a webview redraw. */
export class FormRequestGate {
  private active?: string;
  private readonly completed = new Map<string, OperationResult>();

  inspect(operationId: string): { status: 'pending' | 'unknown' } | { status: 'completed'; result: OperationResult } {
    const result = this.completed.get(operationId);
    if (result) return { status: 'completed', result };
    return { status: this.active === operationId ? 'pending' : 'unknown' };
  }

  async run(operationId: string, task: () => Promise<OperationResult>): Promise<OperationResult | undefined> {
    if (this.completed.has(operationId)) return this.completed.get(operationId);
    if (this.active === operationId) return undefined;
    if (this.active) return { ok: false, message: '另一個表單操作仍在處理中，請稍後重試。' };
    this.active = operationId;
    try {
      let result: OperationResult;
      try { result = await task(); }
      catch (error) { result = { ok: false, message: error instanceof Error ? error.message : '表單操作失敗' }; }
      this.completed.set(operationId, result);
      if (this.completed.size > 32) this.completed.delete(this.completed.keys().next().value!);
      return result;
    } finally { this.active = undefined; }
  }
}
