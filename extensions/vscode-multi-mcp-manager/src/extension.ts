import * as vscode from 'vscode';
import {
  checkVersions,
  deleteCredential,
  getGatewayStatus,
  installMcp,
  listMcpServers,
  removeMcp,
  rescanRegistry,
  setMcpEnabled,
  updateMcp,
  upsertCredential,
  type CredentialInput,
  type McpServerSummary,
} from '../../../src/management/index.js';
import type { McpServerConfig } from '../../../src/types.js';
import { t } from './localization.js';
import {
  getDashboardStructureMarkers,
  renderDashboardHtml,
  type DashboardState,
  type CredentialFormPayload,
  type McpFormPayload,
  type WebviewMessage,
} from './webview.js';

type InstallMode = 'source' | 'json';
const MCP_MARKETPLACES = [
  {
    label: 'PulseMCP',
    description: '12,000+ MCP servers',
    url: 'https://www.pulsemcp.com/servers',
  },
  {
    label: 'Official MCP Registry',
    description: 'Official registry metadata',
    url: 'https://modelcontextprotocol.io/registry/about',
  },
  {
    label: 'Glama',
    description: 'Indexed MCP server registry',
    url: 'https://glama.ai/mcp/servers',
  },
  {
    label: 'Smithery',
    description: 'MCP registry and gateway',
    url: 'https://smithery.ai/index',
  },
] as const;

export function activate(context: vscode.ExtensionContext): void {
  process.env.MULTI_MCP_PACKAGE_ROOT = context.extensionPath;
  const output = vscode.window.createOutputChannel(t('Multi-MCP'));
  const dashboard = new DashboardProvider(context, output);

  context.subscriptions.push(
    output,
    vscode.window.registerWebviewViewProvider('multiMcp.dashboard', dashboard),
    vscode.commands.registerCommand('multiMcp.refresh', () => dashboard.refresh()),
    vscode.commands.registerCommand('multiMcp.installAdvanced', () => dashboard.installFromPrompt()),
    vscode.commands.registerCommand('multiMcp.installManual', () => dashboard.installFromPrompt('source')),
    vscode.commands.registerCommand('multiMcp.removePick', () => dashboard.removeFromPrompt()),
    vscode.commands.registerCommand('multiMcp.remove', (name?: string) => dashboard.removeFromPrompt(name)),
    vscode.commands.registerCommand('multiMcp.enable', (name?: string) => dashboard.setEnabledFromPrompt(true, name)),
    vscode.commands.registerCommand('multiMcp.disable', (name?: string) => dashboard.setEnabledFromPrompt(false, name)),
    vscode.commands.registerCommand('multiMcp.addCredentialPick', () => dashboard.addCredentialFromPrompt()),
    vscode.commands.registerCommand('multiMcp.addCredential', (name?: string) => dashboard.addCredentialFromPrompt(name)),
    vscode.commands.registerCommand('multiMcp.rescan', () => dashboard.rescan()),
    vscode.commands.registerCommand('multiMcp.checkVersions', () => dashboard.showVersionReport()),
    vscode.commands.registerCommand('multiMcp.openDataDir', () => openDataDir()),
    vscode.commands.registerCommand('multiMcp.openRegistry', () => openRegistry()),
    vscode.commands.registerCommand('multiMcp.openMarketplace', () => openMarketplace()),
    vscode.commands.registerCommand('multiMcp.internal.getDashboardStateForTest', () => createDashboardState()),
    vscode.commands.registerCommand('multiMcp.internal.getDashboardStructureMarkersForTest', () => getDashboardStructureMarkers()),
  );
}

export function deactivate(): void {
  // VS Code disposes subscriptions for this extension.
}

class DashboardProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = renderDashboardHtml(view.webview, this.context.extensionUri, createDashboardState());
    view.webview.onDidReceiveMessage((message: WebviewMessage) => this.handleMessage(message));
  }

  refresh(): void {
    this.postState();
  }

  async installFromPrompt(forcedMode?: InstallMode): Promise<void> {
    const mode = forcedMode ?? await pickInstallMode();
    if (!mode) return;
    const draft = await buildInstallDraft(mode);
    if (!draft) return;

    const existing = listMcpServers().find((server) => server.name === draft.name);
    const overwrite = existing ? await confirmOverwrite(draft.name) : false;
    if (overwrite === undefined) return;

    const credential = await maybeCollectCredential(draft.name, draft.requiredEnvVars, draft.authRecommended);
    const rescanAfterInstall = await confirmRescanAfterInstall();
    if (rescanAfterInstall === undefined) return;

    await this.runOperation(
      t('Installing MCP'),
      () => installMcp({
        name: draft.name,
        category: draft.category,
        source: draft.source,
        config: draft.config,
        credential,
        overwrite,
        rescan: rescanAfterInstall,
      }),
      t('{name} installed.', { name: draft.name }),
    );
  }

  async removeFromPrompt(name?: string): Promise<void> {
    const server = await pickServer(name);
    if (!server) return;
    const details = [
      t('Name: {value}', { value: server.name }),
      t('Category: {value}', { value: server.category }),
      t('Config: {path}', { path: server.configPath }),
      t('Credential: {value}', { value: server.credential ? credentialLabel(server) : t('Not configured') }),
    ].join('\n');
    const remove = t('Remove MCP');
    const yes = await vscode.window.showWarningMessage(
      t('Remove {name}?', { name: server.name }),
      { modal: true, detail: t('The MCP config file and its stored credential will be removed.\n\n{details}', { details }) },
      remove,
    );
    if (yes !== remove) return;
    await this.runOperation(
      t('Removing MCP'),
      () => removeMcp(server.name),
      t('{name} removed.', { name: server.name }),
    );
  }

  async setEnabledFromPrompt(enabled: boolean, name?: string): Promise<void> {
    const server = await pickServer(name);
    if (!server) return;
    const result = setMcpEnabled(server.name, enabled);
    if (result.ok) {
      vscode.window.showInformationMessage(enabled
        ? t('{name} enabled.', { name: server.name })
        : t('{name} disabled.', { name: server.name }));
    } else {
      vscode.window.showErrorMessage(result.message);
    }
    this.refresh();
  }

  async addCredentialFromPrompt(name?: string): Promise<void> {
    const server = await pickServer(name);
    if (!server) return;
    const credential = await collectCredential(server.name, server.requiredEnvVars, server.credential?.active);
    if (!credential) return;
    const result = upsertCredential(credential);
    if (result.ok) vscode.window.showInformationMessage(t('{name} credential updated.', { name: server.name }));
    else vscode.window.showErrorMessage(result.message);
    this.refresh();
  }

  async rescan(): Promise<void> {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t('Rescanning MCP tools') }, async () => {
      const registry = await rescanRegistry();
      vscode.window.showInformationMessage(t('Registry updated: {count} tools.', { count: Object.keys(registry.all_tools).length }));
    });
    this.refresh();
  }

  async showVersionReport(): Promise<void> {
    const results = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: t('Checking MCP package versions') },
      () => checkVersions(),
    );
    this.output.clear();
    this.output.appendLine(t('Multi-MCP package version report'));
    for (const result of results) {
      const suffix = result.latestVersion ? t('latest {version}', { version: result.latestVersion }) : result.error ?? result.status;
      this.output.appendLine(`${result.name}: ${result.packageName ?? t('(not npm)')} - ${suffix}`);
    }
    this.output.show(true);
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.command) {
      case 'refreshState':
        this.refresh();
        return;
      case 'openInstallForm':
      case 'openEditForm':
      case 'cancelMcpForm':
      case 'openCredentialPanel':
        this.refresh();
        return;
      case 'saveMcpForm':
        await this.saveMcpForm(message.payload);
        return;
      case 'removeServer':
        await this.removeFromPrompt(message.name);
        return;
      case 'setEnabled':
        await this.setEnabledFromPrompt(message.enabled, message.name);
        return;
      case 'saveCredential':
        await this.saveCredentialFromDashboard(message.payload);
        return;
      case 'deleteCredential':
        await this.deleteCredentialFromDashboard(message.name);
        return;
      case 'rescan':
        await this.rescan();
        return;
      case 'checkVersions':
        await this.showVersionReport();
        return;
      case 'openDataDir':
        await openDataDir();
        return;
      case 'openRegistry':
        await openRegistry();
        return;
      case 'openMarketplace':
        await openMarketplace();
        return;
    }
  }

  private async saveMcpForm(payload: McpFormPayload): Promise<void> {
    const nextName = payload.nextName.trim();
    const category = payload.category.trim();
    if (!nextName || !category) {
      vscode.window.showErrorMessage(t('MCP name and category are required.'));
      return;
    }

    const config = parseFormConfig(payload);
    if (!config) return;
    const credential = payload.credential
      ? await collectCredentialSecret(nextName, payload.credential.envVar, payload.credential.label)
      : undefined;

    if (payload.credential && !credential) return;

    if (payload.mode === 'install') {
      const existing = listMcpServers().find((server) => server.name === nextName);
      const overwrite = existing ? await confirmOverwrite(nextName) : false;
      if (overwrite === undefined) return;

      await this.runOperation(
        t('Installing MCP'),
        () => installMcp({
          name: nextName,
          category,
          source: payload.sourceMode === 'json' ? undefined : payload.source,
          config,
          credential,
          overwrite,
          rescan: payload.rescan,
        }),
        t('{name} installed.', { name: nextName }),
      );
      return;
    }

    if (!payload.currentName) {
      vscode.window.showErrorMessage(t('Current MCP name is missing.'));
      return;
    }

    const confirm = await confirmMcpEdit(payload.currentName, nextName, category, config, payload.rescan);
    if (!confirm) return;

    await this.runOperation(
      t('Updating MCP'),
      async () => {
        const result = await updateMcp({
          currentName: payload.currentName!,
          nextName,
          category,
          config,
          rescan: payload.rescan,
        });
        if (result.ok && credential) {
          const credentialResult = upsertCredential({ ...credential, mcpName: nextName });
          if (!credentialResult.ok) return credentialResult;
        }
        return result;
      },
      t('{name} updated.', { name: nextName }),
    );
  }

  private async saveCredentialFromDashboard(payload: CredentialFormPayload): Promise<void> {
    const credential = await collectCredentialSecret(payload.name, payload.envVar, payload.label);
    if (!credential) return;
    const result = upsertCredential({ ...credential, mcpName: payload.name });
    if (result.ok) vscode.window.showInformationMessage(t('{name} credential updated.', { name: payload.name }));
    else vscode.window.showErrorMessage(result.message);
    this.refresh();
  }

  private async deleteCredentialFromDashboard(name: string): Promise<void> {
    const remove = t('Remove credential');
    const picked = await vscode.window.showWarningMessage(
      t('Remove credential for {name}?', { name }),
      { modal: true, detail: t('This removes the stored credential from credentials.json and gateway.env.') },
      remove,
    );
    if (picked !== remove) return;
    const result = deleteCredential(name);
    if (result.ok) vscode.window.showInformationMessage(t('{name} credential removed.', { name }));
    else vscode.window.showErrorMessage(result.message);
    this.refresh();
  }

  private async runOperation(
    title: string,
    task: () => Promise<{ ok: boolean; message: string }>,
    successMessage: string,
  ): Promise<void> {
    try {
      const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, task);
      if (result.ok) vscode.window.showInformationMessage(successMessage);
      else vscode.window.showErrorMessage(result.message);
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message);
    }
  }

  private postState(): void {
    this.view?.webview.postMessage({ command: 'state', state: createDashboardState() });
  }
}

function createDashboardState(): DashboardState {
  return {
    status: getGatewayStatus(),
    servers: listMcpServers(),
  };
}

async function buildInstallDraft(mode: InstallMode): Promise<{
  name: string;
  category: string;
  source?: string;
  config?: McpServerConfig;
  requiredEnvVars: string[];
  authRecommended: boolean;
} | undefined> {
  if (mode === 'json') {
    const raw = await input(t('Paste mcpServers JSON or a single MCP config'));
    if (!raw) return undefined;
    const configs = parseMcpConfigJson(raw);
    if (configs.length === 0) {
      vscode.window.showErrorMessage(t('No valid MCP config was found in the pasted JSON.'));
      return undefined;
    }
    const picked = configs.length === 1 ? configs[0] : await pickParsedConfig(configs);
    if (!picked) return undefined;
    const name = await input(t('MCP name'), picked.name ?? t('custom-mcp'));
    if (!name) return undefined;
    const category = await pickCategory();
    if (!category) return undefined;
    const requiredEnvVars = collectRequiredEnvVars(picked.config);
    return {
      name,
      category,
      config: picked.config,
      requiredEnvVars,
      authRecommended: requiredEnvVars.length > 0,
    };
  }

  const source = await input(t('MCP source: npm package, remote URL, or JSON config'));
  if (!source) return undefined;
  if (source.trim().startsWith('{')) {
    const configs = parseMcpConfigJson(source);
    const picked = configs[0];
    if (!picked) {
      vscode.window.showErrorMessage(t('No valid MCP config was found in the pasted JSON.'));
      return undefined;
    }
    const name = await input(t('MCP name'), picked.name ?? t('custom-mcp'));
    if (!name) return undefined;
    const category = await pickCategory();
    if (!category) return undefined;
    const requiredEnvVars = collectRequiredEnvVars(picked.config);
    return {
      name,
      category,
      config: picked.config,
      requiredEnvVars,
      authRecommended: requiredEnvVars.length > 0,
    };
  }
  const name = await input(t('MCP name'), defaultNameFromSource(source));
  if (!name) return undefined;
  const category = await pickCategory();
  if (!category) return undefined;
  return { name, category, source, requiredEnvVars: [], authRecommended: false };
}

function parseFormConfig(payload: McpFormPayload): McpServerConfig | undefined {
  if (payload.sourceMode === 'json') {
    const configs = parseMcpConfigJson(payload.source);
    const picked = payload.currentName
      ? configs.find((entry) => entry.name === payload.currentName || entry.name === payload.nextName) ?? configs[0]
      : configs[0];
    if (!picked) {
      vscode.window.showErrorMessage(t('No valid MCP config was found in the pasted JSON.'));
      return undefined;
    }
    return picked.config;
  }

  if (!payload.command.trim()) {
    vscode.window.showErrorMessage(t('Command is required.'));
    return undefined;
  }
  return {
    command: payload.command.trim(),
    args: payload.args.map((arg) => arg.trim()).filter(Boolean),
  };
}

async function collectCredentialSecret(
  mcpName: string,
  envVar: string,
  label: string,
): Promise<Omit<CredentialInput, 'mcpName'> | undefined> {
  const trimmedEnvVar = envVar.trim();
  if (!trimmedEnvVar) {
    vscode.window.showErrorMessage(t('請填入 MCP 要讀取的環境變數名稱。'));
    return undefined;
  }
  const value = await vscode.window.showInputBox({
    title: t('{name} 金鑰值', { name: mcpName }),
    prompt: t('金鑰值會寫入 gateway.env 與 credentials.json 以維持 Gateway 相容；完整值不會顯示在管理頁或輸出紀錄。'),
    password: true,
    ignoreFocusOut: true,
  });
  if (!value) return undefined;
  return {
    label: label.trim() || 'default',
    value,
    envVar: trimmedEnvVar,
  };
}

async function confirmMcpEdit(
  currentName: string,
  nextName: string,
  category: string,
  config: McpServerConfig,
  rescan: boolean,
): Promise<boolean> {
  const apply = t('Apply changes');
  const detail = [
    t('Current name: {value}', { value: currentName }),
    t('Next name: {value}', { value: nextName }),
    t('Category: {value}', { value: category }),
    t('Command: {value}', { value: config.command }),
    t('Args: {value}', { value: config.args.join(' ') || t('(none)') }),
    rescan ? t('Registry will be rescanned after saving.') : t('Registry will not be rescanned automatically.'),
  ].join('\n');
  const picked = await vscode.window.showWarningMessage(
    t('Apply MCP changes?'),
    { modal: true, detail },
    apply,
  );
  return picked === apply;
}

async function openDataDir(): Promise<void> {
  const status = getGatewayStatus();
  await vscode.env.openExternal(vscode.Uri.file(status.dataDir));
}

async function openRegistry(): Promise<void> {
  const status = getGatewayStatus();
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(status.registryPath));
  await vscode.window.showTextDocument(document);
}

async function openMarketplace(): Promise<void> {
  const picked = await vscode.window.showQuickPick(MCP_MARKETPLACES.map((entry) => ({
    label: entry.label,
    description: entry.description,
    url: entry.url,
  })), { placeHolder: t('Choose an MCP directory') });
  if (!picked) return;
  await vscode.env.openExternal(vscode.Uri.parse(picked.url));
}

async function pickCategory(): Promise<string | undefined> {
  const existingCategories = [...new Set(listMcpServers().map((server) => server.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const createNew = t('Create new category...');
  const picked = await vscode.window.showQuickPick([
    ...existingCategories.map((category) => ({
      label: category,
      description: t('Existing category'),
      value: category,
    })),
    {
      label: createNew,
      description: existingCategories.length > 0 ? t('Type a different category name') : t('No existing categories yet'),
      value: undefined,
    },
  ], { placeHolder: t('Choose an MCP category') });
  if (!picked) return undefined;
  if (picked.value) return picked.value;
  return input(t('New category name'), existingCategories[0] ?? t('Custom'));
}

async function pickInstallMode(): Promise<InstallMode | undefined> {
  const picked = await vscode.window.showQuickPick([
    { label: t('Install from Source'), description: t('npm package, remote URL, or JSON config'), value: 'source' as const },
    { label: t('Paste mcpServers JSON'), description: t('Compatible with MCP client config snippets'), value: 'json' as const },
  ], { placeHolder: t('Choose how to install an MCP') });
  return picked?.value;
}

async function pickParsedConfig(configs: Array<{ name?: string; config: McpServerConfig }>): Promise<{ name?: string; config: McpServerConfig } | undefined> {
  const picked = await vscode.window.showQuickPick(configs.map((entry, index) => ({
    label: entry.name ?? t('MCP config #{index}', { index: index + 1 }),
    description: entry.config.command,
    detail: entry.config.args.join(' '),
    entry,
  })), { placeHolder: t('Select the MCP config to install') });
  return picked?.entry;
}

async function pickServer(name?: string): Promise<McpServerSummary | undefined> {
  if (name) {
    const server = listMcpServers().find((entry) => entry.name === name);
    if (server) return server;
  }
  const servers = listMcpServers();
  const picked = await vscode.window.showQuickPick(servers.map((server) => ({
    label: server.name,
    description: server.category,
    detail: server.enabled ? server.source : t('{source} (disabled)', { source: server.source }),
    server,
  })), { placeHolder: t('Select an MCP server') });
  return picked?.server;
}

async function confirmOverwrite(name: string): Promise<boolean | undefined> {
  const overwrite = t('Overwrite');
  const picked = await vscode.window.showWarningMessage(
    t('{name} already exists.', { name }),
    { modal: true, detail: t('Installing with the same name will replace the existing MCP config.') },
    overwrite,
  );
  return picked === overwrite ? true : undefined;
}

async function maybeCollectCredential(
  mcpName: string,
  requiredEnvVars: string[],
  authRecommended: boolean,
): Promise<Omit<CredentialInput, 'mcpName'> | undefined> {
  const picked = await vscode.window.showQuickPick([
    { label: authRecommended ? t('Set Token now') : t('Set Token'), description: t('Write gateway.env and credentials.json'), value: true },
    { label: t('Skip for now'), description: t('You can add credentials later'), value: false },
  ], { placeHolder: authRecommended ? t('This MCP may need a Token') : t('Add a Token for this MCP?') });
  if (!picked?.value) return undefined;
  const credential = await collectCredential(mcpName, requiredEnvVars);
  if (!credential) return undefined;
  const { mcpName: _mcpName, ...input } = credential;
  return input;
}

async function collectCredential(
  mcpName: string,
  requiredEnvVars: string[],
  activeLabel?: string,
): Promise<CredentialInput | undefined> {
  const envVar = await input(t('Environment variable name'), requiredEnvVars[0]);
  if (!envVar) return undefined;
  const label = await input(t('Account label'), activeLabel ?? 'default');
  if (!label) return undefined;
  const value = await vscode.window.showInputBox({
    title: t('{name} 金鑰值', { name: mcpName }),
    prompt: t('金鑰值會寫入 gateway.env 與 credentials.json 以維持 Gateway 相容；完整值不會顯示在管理頁或輸出紀錄。'),
    password: true,
    ignoreFocusOut: true,
  });
  if (!value) return undefined;
  return { mcpName, label, value, envVar };
}

async function confirmRescanAfterInstall(): Promise<boolean | undefined> {
  const picked = await vscode.window.showQuickPick([
    { label: t('Rescan after install'), description: t('Recommended when you want tools available immediately'), value: true },
    { label: t('Scan later'), description: t('Install config only'), value: false },
  ], { placeHolder: t('Update registry after installation?') });
  return picked?.value;
}

async function input(title: string, value?: string): Promise<string | undefined> {
  const text = await vscode.window.showInputBox({ title, value, ignoreFocusOut: true });
  const trimmed = text?.trim();
  return trimmed || undefined;
}

function parseMcpConfigJson(raw: string): Array<{ name?: string; config: McpServerConfig }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    vscode.window.showErrorMessage(t('The pasted JSON is invalid.'));
    return [];
  }

  if (isRecord(parsed) && isRecord(parsed.mcpServers)) {
    return Object.entries(parsed.mcpServers)
      .map(([name, value]) => ({ name, config: normalizeConfig(value) }))
      .filter((entry): entry is { name: string; config: McpServerConfig } => !!entry.config);
  }

  const single = normalizeConfig(parsed);
  return single ? [{ config: single }] : [];
}

function normalizeConfig(value: unknown): McpServerConfig | undefined {
  if (!isRecord(value) || typeof value.command !== 'string') return undefined;
  const args = Array.isArray(value.args) ? value.args.map(String) : [];
  const env = isRecord(value.env)
    ? Object.fromEntries(Object.entries(value.env).map(([key, envValue]) => [key, String(envValue)]))
    : undefined;
  return {
    command: value.command,
    args,
    ...(env ? { env } : {}),
    ...(typeof value.preload === 'boolean' ? { preload: value.preload } : {}),
  };
}

function collectRequiredEnvVars(config: McpServerConfig): string[] {
  const vars = new Set<string>();
  const text = JSON.stringify(config);
  for (const match of text.matchAll(/\$\{([A-Z][A-Z0-9_]+)\}/g)) vars.add(match[1]);
  for (const key of Object.keys(config.env ?? {})) vars.add(key);
  return [...vars];
}

function defaultNameFromSource(source: string): string {
  if (source.startsWith('https://')) return source.replace('https://', '').split('/')[0].replace(/\./g, '-');
  return source.split('/').pop()?.replace(/@latest$/, '') ?? source;
}

function credentialLabel(server: McpServerSummary): string {
  if (!server.credential) return t('Not configured');
  const value = server.credential.maskedValue ? ` · ${server.credential.maskedValue}` : '';
  return `${server.credential.active ?? t('configured')}${value}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
