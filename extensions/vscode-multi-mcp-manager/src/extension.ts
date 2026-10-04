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
  switchCredential,
  updateMcp,
  upsertCredential,
  type CredentialInput,
  type McpServerSummary,
  type OperationResult,
} from '../../../src/management/index.js';
import type { McpServerConfig } from '../../../src/types.js';
import {
  checkExtensionUpdate,
  createInitialExtensionUpdateState,
  downloadExtensionVsix,
  type ExtensionUpdateState,
} from './extensionUpdate.js';
import { t } from './localization.js';
import { createFormModel } from './formModel.js';
import { FormRequestGate, submitMcpForm } from './formOperations.js';
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
const EXTENSION_UPDATE_STATE_KEY = 'multiMcp.extensionUpdate';

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
    vscode.commands.registerCommand('multiMcp.checkExtensionUpdate', () => dashboard.showExtensionUpdateReport()),
    vscode.commands.registerCommand('multiMcp.openDataDir', () => openDataDir()),
    vscode.commands.registerCommand('multiMcp.openRegistry', () => openRegistry()),
    vscode.commands.registerCommand('multiMcp.openMarketplace', () => openMarketplace()),
    vscode.commands.registerCommand('multiMcp.internal.getDashboardStateForTest', () => dashboard.getDashboardStateForTest()),
    vscode.commands.registerCommand('multiMcp.internal.getDashboardStructureMarkersForTest', () => getDashboardStructureMarkers()),
  );
  void dashboard.checkExtensionUpdateSilently();
}

export function deactivate(): void {
  // VS Code disposes subscriptions for this extension.
}

class DashboardProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private extensionUpdate: ExtensionUpdateState;
  private readonly formRequests = new FormRequestGate();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel,
  ) {
    this.extensionUpdate = context.globalState.get<ExtensionUpdateState>(EXTENSION_UPDATE_STATE_KEY)
      ?? createInitialExtensionUpdateState(getExtensionVersion(context));
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage((message: WebviewMessage) => this.handleMessage(message));
    view.webview.html = renderDashboardHtml(view.webview, this.context.extensionUri, this.createState());
  }

  refresh(): void {
    this.postState();
  }

  getDashboardStateForTest(): DashboardState {
    return this.createState();
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
      vscode.window.showInformationMessage(withRuntimeNotice(result.message));
    } else {
      vscode.window.showErrorMessage(result.message);
    }
    this.refresh();
  }

  async addCredentialFromPrompt(name?: string): Promise<void> {
    const server = await pickServer(name);
    if (!server) return;
    const credential = await collectCredential(server.name, server.credential ? [server.credential.envVar] : server.requiredEnvVars, server.credential?.active);
    if (!credential) return;
    const result = upsertCredential(credential);
    if (result.ok) {
      const active = listMcpServers().find((entry) => entry.name === server.name)?.credential?.active;
      vscode.window.showInformationMessage(withRuntimeNotice(`${result.message}。目前使用：${active ?? '尚未設定'}；新增標籤不會自動切換帳號。`));
    }
    else vscode.window.showErrorMessage(result.message);
    this.refresh();
  }

  async rescan(): Promise<void> {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: t('Rescanning MCP tools') }, async () => {
      const registry = await rescanRegistry();
      const failed = Object.entries(registry.servers).filter(([, entry]) => entry.stale || entry.scan_error).map(([name]) => name);
      if (failed.length) vscode.window.showWarningMessage(withRuntimeNotice(`掃描部分失敗：${failed.join('、')}。失敗服務保留上次有效工具清單（若有）。`));
      else vscode.window.showInformationMessage(withRuntimeNotice(t('Registry updated: {count} tools.', { count: Object.keys(registry.all_tools).length })));
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

  async checkExtensionUpdateSilently(): Promise<void> {
    const result = await checkExtensionUpdate(getExtensionVersion(this.context));
    await this.storeExtensionUpdate(result);
    if (result.status === 'error') {
      this.output.appendLine(t('Extension update check failed: {message}', { message: result.error ?? t('Unknown error') }));
      return;
    }
    const summary = result.latestVersion
      ? t('Extension update check: {status} ({version})', { status: result.status, version: result.latestVersion })
      : t('Extension update check: {status}', { status: result.status });
    this.output.appendLine(summary);
  }

  async showExtensionUpdateReport(): Promise<void> {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: t('Checking Multi-MCP Manager updates') },
      () => checkExtensionUpdate(getExtensionVersion(this.context)),
    );
    await this.storeExtensionUpdate(result);

    if (result.status === 'current') {
      vscode.window.showInformationMessage(t('Multi-MCP Manager is up to date ({version}).', { version: result.currentVersion }));
      return;
    }
    if (result.status === 'assetMissing') {
      await this.showReleaseOnlyMessage(result);
      return;
    }
    if (result.status === 'updateAvailable') {
      await this.showInstallableUpdateMessage(result);
      return;
    }
    vscode.window.showWarningMessage(t('Could not check Multi-MCP Manager updates: {message}', { message: result.error ?? t('Unknown error') }));
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
      case 'getFormResult':
        this.reconcileFormRequest(message.operationId);
        return;
      case 'saveMcpForm':
        await this.runFormRequest(message.operationId, () => this.saveMcpForm(message.payload));
        return;
      case 'removeServer':
        await this.removeFromPrompt(message.name);
        return;
      case 'setEnabled':
        await this.setEnabledFromPrompt(message.enabled, message.name);
        return;
      case 'saveCredential':
        await this.runFormRequest(message.operationId, () => this.saveCredentialFromDashboard(message.payload));
        return;
      case 'switchCredential':
        await this.runFormRequest(message.operationId, async () => {
          const result = switchCredential(message.name, message.label);
          return { ...result, savedName: message.name, message: result.ok ? withRuntimeNotice(result.message) : result.message };
        });
        return;
      case 'deleteCredential':
        await this.runFormRequest(message.operationId, () => this.deleteCredentialFromDashboard(message.name));
        return;
      case 'rescan':
        await this.rescan();
        return;
      case 'checkVersions':
        await this.showVersionReport();
        return;
      case 'checkExtensionUpdate':
        await this.showExtensionUpdateReport();
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

  private reconcileFormRequest(operationId: string): void {
    if (typeof operationId !== 'string' || !operationId || operationId.length > 200) return;
    const outcome = this.formRequests.inspect(operationId);
    const state = this.createState();
    if (outcome.status === 'pending') {
      this.view?.webview.postMessage({ command: 'formPending', operationId, state });
    } else if (outcome.status === 'completed') {
      const result = outcome.result;
      const message = result.ok || result.committed ? withRuntimeNotice(result.message) : result.message;
      this.view?.webview.postMessage({ command: 'formResult', operationId, ...result, message, state });
    } else {
      // The host may have restarted or evicted an old result. Never guess whether it committed
      // and never replay a mutation. Show the current disk state and require a fresh edit.
      this.view?.webview.postMessage({ command: 'formResult', operationId, ok: false, outcomeUnknown: true,
        message: '無法確認上次提交的結果；沒有自動重試。已重新讀取目前設定，請檢查後重新開啟表單。', state });
    }
  }

  private async runFormRequest(operationId: string, task: () => Promise<OperationResult>): Promise<void> {
    if (typeof operationId !== 'string' || !operationId || operationId.length > 200) return;
    const result = await this.formRequests.run(operationId, task);
    if (!result) return;
    // A refresh is not an acknowledgement. Include the operation id and a fresh snapshot together.
    const message = result.ok || result.committed ? withRuntimeNotice(result.message) : result.message;
    this.view?.webview.postMessage({ command: 'formResult', operationId, ...result, message, state: this.createState() });
    if (result.ok) vscode.window.showInformationMessage(message);
    else if (result.committed) vscode.window.showWarningMessage(message);
  }

  private async saveMcpForm(payload: McpFormPayload): Promise<OperationResult> {
    return vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: payload.mode === 'install' ? t('Installing MCP') : t('Updating MCP') },
      () => submitMcpForm(payload, {
        listServers: listMcpServers,
        collectCredential: collectCredentialSecret,
        confirmOverwrite,
        confirmEdit: confirmMcpEdit,
        install: installMcp,
        update: updateMcp,
      }),
    );
  }

  private async saveCredentialFromDashboard(payload: CredentialFormPayload): Promise<OperationResult> {
    const credential = await collectCredentialSecret(payload.name, payload.envVar, payload.label);
    if (!credential) return { ok: false, message: '已取消，草稿仍保留。' };
    const result = upsertCredential({ ...credential, mcpName: payload.name });
    const active = listMcpServers().find((server) => server.name === payload.name)?.credential?.active;
    return { ...result, savedName: payload.name,
      message: result.ok ? `金鑰標籤已儲存。目前使用：${active ?? '尚未設定'}；可在下方切換帳號。執行中的 Gateway 需重新載入／重連。` : result.message };
  }

  private async deleteCredentialFromDashboard(name: string): Promise<OperationResult> {
    const remove = t('Remove credential');
    const picked = await vscode.window.showWarningMessage(
      t('Remove credential for {name}?', { name }),
      { modal: true, detail: t('This removes all stored account labels from credentials.json and gateway.env. The running Gateway must reload or reconnect.') },
      remove,
    );
    if (picked !== remove) return { ok: false, message: '已取消，草稿仍保留。' };
    return { ...deleteCredential(name), savedName: name };
  }

  private async runOperation(
    title: string,
    task: () => Promise<OperationResult>,
    _successMessage: string,
  ): Promise<void> {
    try {
      const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, task);
      if (result.ok) vscode.window.showInformationMessage(withRuntimeNotice(result.message));
      else if (result.committed) vscode.window.showWarningMessage(withRuntimeNotice(result.message));
      else vscode.window.showErrorMessage(result.message);
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message);
    }
  }

  private postState(): void {
    this.view?.webview.postMessage({ command: 'state', state: this.createState() });
  }

  private createState(): DashboardState {
    return { ...createDashboardState(this.extensionUpdate), extensionVersion: getExtensionVersion(this.context) };
  }

  private async storeExtensionUpdate(result: ExtensionUpdateState): Promise<void> {
    this.extensionUpdate = result;
    await this.context.globalState.update(EXTENSION_UPDATE_STATE_KEY, result);
    this.refresh();
  }

  private async showReleaseOnlyMessage(result: ExtensionUpdateState): Promise<void> {
    const openRelease = t('Open Release');
    const picked = await vscode.window.showWarningMessage(
      t('Multi-MCP Manager {version} is available, but no VSIX asset was found.', { version: result.latestVersion ?? t('new version') }),
      openRelease,
      t('Later'),
    );
    if (picked === openRelease && result.releaseUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(result.releaseUrl));
    }
  }

  private async showInstallableUpdateMessage(result: ExtensionUpdateState): Promise<void> {
    const install = t('Download and Install');
    const openRelease = t('Open Release');
    const picked = await vscode.window.showInformationMessage(
      t('Multi-MCP Manager {version} is available.', { version: result.latestVersion ?? t('new version') }),
      install,
      openRelease,
      t('Later'),
    );
    if (picked === openRelease && result.releaseUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(result.releaseUrl));
      return;
    }
    if (picked !== install) return;
    await this.installExtensionUpdate(result);
  }

  private async installExtensionUpdate(result: ExtensionUpdateState): Promise<void> {
    try {
      const vsix = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: t('Downloading Multi-MCP Manager update') },
        () => downloadExtensionVsix(result, this.context.globalStorageUri),
      );
      await vscode.commands.executeCommand('workbench.extensions.installExtension', vsix);
      const reload = t('Reload Window');
      const picked = await vscode.window.showInformationMessage(
        t('Multi-MCP Manager update installed. Reload VS Code to finish.'),
        reload,
      );
      if (picked === reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
    } catch (error) {
      vscode.window.showErrorMessage(t('Could not install Multi-MCP Manager update: {message}', { message: (error as Error).message }));
    }
  }
}

function createDashboardState(extensionUpdate?: ExtensionUpdateState): DashboardState {
  return {
    status: getGatewayStatus(),
    servers: listMcpServers(),
    extensionUpdate,
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

async function collectCredentialSecret(
  mcpName: string,
  envVar: string,
  label: string,
): Promise<Omit<CredentialInput, 'mcpName'> | undefined> {
  const trimmedEnvVar = envVar.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedEnvVar)) {
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
  try { return createFormModel().validateConfig(value); }
  catch { return undefined; }
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

function getExtensionVersion(context: vscode.ExtensionContext): string {
  const packageJson = context.extension.packageJSON as { version?: unknown };
  return typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function withRuntimeNotice(message: string): string {
  const notice = '正在執行的 Gateway 請重新連線，或呼叫 Gateway 自己的 rescan/reload 才生效。';
  return message.includes('Gateway 自己的 rescan/reload') ? message : `${message} ${notice}`;
}
