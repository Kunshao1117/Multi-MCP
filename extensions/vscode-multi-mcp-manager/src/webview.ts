import * as vscode from 'vscode';
import type { GatewayStatus, McpServerSummary } from '../../../src/management/index.js';
import type { ExtensionUpdateState } from './extensionUpdate.js';

export interface DashboardState {
  status: GatewayStatus;
  servers: McpServerSummary[];
  extensionUpdate?: ExtensionUpdateState;
}

export interface McpFormPayload {
  mode: 'install' | 'edit';
  currentName?: string;
  nextName: string;
  category: string;
  sourceMode: 'npm' | 'remote' | 'custom' | 'json';
  source: string;
  command: string;
  args: string[];
  envVars: string[];
  config?: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
  credential?: {
    envVar: string;
    label: string;
  };
  rescan: boolean;
}

export interface CredentialFormPayload {
  name: string;
  envVar: string;
  label: string;
}

export type WebviewMessage =
  | { command: 'refreshState' }
  | { command: 'openInstallForm'; mode?: 'source' | 'json' }
  | { command: 'openEditForm'; name: string }
  | { command: 'cancelMcpForm' }
  | { command: 'saveMcpForm'; payload: McpFormPayload }
  | { command: 'removeServer'; name: string }
  | { command: 'setEnabled'; name: string; enabled: boolean }
  | { command: 'openCredentialPanel'; name: string }
  | { command: 'saveCredential'; payload: CredentialFormPayload }
  | { command: 'deleteCredential'; name: string }
  | { command: 'rescan' }
  | { command: 'checkVersions' }
  | { command: 'checkExtensionUpdate' }
  | { command: 'openDataDir' }
  | { command: 'openRegistry' }
  | { command: 'openMarketplace' };

export function getDashboardStructureMarkers(): string[] {
  return ['category-section', 'data-category-toggle', 'mcp-row', 'mcp-form-panel', 'credential-panel', 'key-status', 'credential-help', 'check-row', 'form-footer', 'change-preview', 'tool-summary', 'tool-empty-state', 'extension-update-card', '插件更新', '探索 MCP'];
}

export function renderDashboardHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  state: DashboardState,
): string {
  const nonce = createNonce();
  const initialState = escapeScriptJson(state);
  const cspSource = webview.cspSource;
  const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'multi-mcp.svg'));

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multi-MCP Manager</title>
  <style nonce="${nonce}">
    :root {
      color-scheme: light dark;
      --panel: var(--vscode-editor-background);
      --panel-soft: var(--vscode-sideBar-background);
      --border: var(--vscode-panel-border);
      --text: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --accent: var(--vscode-button-background);
      --accent-text: var(--vscode-button-foreground);
      --danger: var(--vscode-errorForeground);
      --ok: var(--vscode-testing-iconPassed);
      --warn: var(--vscode-editorWarning-foreground);
      --row-bg: color-mix(in srgb, var(--panel-soft), var(--panel) 34%);
      --section-bg: color-mix(in srgb, var(--panel-soft), var(--panel) 12%);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      color: var(--text);
      background: var(--panel);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .app {
      width: 100%;
      max-width: 1180px;
      margin: 0 auto;
      padding: 18px;
      min-width: 0;
    }
    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .brand img {
      width: 30px;
      height: 30px;
      flex: 0 0 auto;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
      font-weight: 650;
    }
    .subtitle {
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      min-width: 0;
    }
    button {
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 6px;
      padding: 7px 10px;
      color: var(--accent-text);
      background: var(--accent);
      font: inherit;
      cursor: pointer;
      min-height: 30px;
      white-space: nowrap;
    }
    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    button.ghost {
      color: var(--text);
      background: transparent;
      border-color: var(--border);
    }
    button.danger {
      color: var(--danger);
      background: transparent;
      border-color: color-mix(in srgb, var(--danger), transparent 50%);
    }
    button.icon {
      width: 30px;
      min-width: 30px;
      padding: 0;
      font-size: 14px;
    }
    button:hover {
      filter: brightness(1.08);
    }
    section {
      margin-top: 18px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 650;
      color: var(--muted);
      text-transform: uppercase;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
      gap: 10px;
    }
    .card, .panel {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel-soft);
    }
    .card {
      padding: 12px;
      min-height: 74px;
    }
    .label {
      color: var(--muted);
      font-size: 12px;
    }
    .value {
      margin-top: 7px;
      font-size: 20px;
      font-weight: 650;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .installed-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .installed-count {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .category-stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .category-block {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--section-bg);
    }
    .category-block::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--accent);
    }
    .category-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto 30px;
      align-items: center;
      gap: 10px;
      padding: 12px 12px 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .category-title {
      min-width: 0;
    }
    .category-name {
      font-weight: 650;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .category-summary {
      margin-top: 3px;
      color: var(--muted);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mcp-list {
      display: flex;
      flex-direction: column;
      padding: 4px 0 4px 16px;
    }
    .category-block.collapsed .mcp-list {
      display: none;
    }
    .mcp-row {
      min-width: 0;
      background: transparent;
      overflow: hidden;
      border-top: 1px solid color-mix(in srgb, var(--border), transparent 38%);
    }
    .mcp-row:first-child {
      border-top: 0;
    }
    .mcp-row-head {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px 10px 8px;
      background: var(--row-bg);
    }
    .mcp-title {
      min-width: 0;
    }
    .mcp-name {
      font-weight: 650;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mcp-source {
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mcp-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 10px 10px 44px;
      background: var(--row-bg);
      min-width: 0;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pill.ok { color: var(--ok); }
    .pill.warn { color: var(--warn); }
    .card-actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .card-actions button {
      padding: 5px 8px;
      min-height: 26px;
      font-size: 12px;
    }
    .mcp-detail {
      display: none;
      grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr);
      gap: 12px;
      padding: 0 10px 12px 44px;
      background: var(--row-bg);
      color: var(--muted);
      font-size: 12px;
    }
    .mcp-row.expanded .mcp-detail {
      display: grid;
    }
    .detail-grid {
      display: grid;
      gap: 10px;
      min-width: 0;
    }
    .detail-item {
      min-width: 0;
    }
    .detail-value {
      margin-top: 3px;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tool-panel {
      min-width: 0;
      border-left: 1px solid var(--border);
      padding-left: 12px;
    }
    .tool-title {
      color: var(--muted);
      margin-bottom: 7px;
    }
    .tool-list {
      display: grid;
      gap: 7px;
    }
    .tool-item {
      min-width: 0;
      padding: 7px 8px;
      border: 1px solid color-mix(in srgb, var(--border), transparent 22%);
      border-radius: 6px;
      background: color-mix(in srgb, var(--panel), transparent 20%);
    }
    .tool-name {
      color: var(--text);
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tool-desc {
      margin-top: 3px;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tool-empty {
      color: var(--muted);
      padding: 8px;
      border: 1px dashed var(--border);
      border-radius: 6px;
    }
    .form-shell {
      display: none;
      margin-top: 18px;
    }
    .form-shell.active {
      display: block;
    }
    .mcp-form-panel {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel-soft);
      overflow: hidden;
    }
    .form-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .form-title {
      font-size: 15px;
      font-weight: 650;
    }
    .form-subtitle {
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
    }
    .form-body {
      display: grid;
      gap: 14px;
      padding: 14px 16px 16px;
    }
    .form-section {
      display: grid;
      gap: 10px;
      padding-top: 2px;
    }
    .form-section-title {
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      text-transform: uppercase;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .field {
      display: grid;
      gap: 5px;
      min-width: 0;
    }
    .field.full {
      grid-column: 1 / -1;
    }
    label {
      color: var(--muted);
      font-size: 12px;
    }
    input,
    select,
    textarea {
      width: 100%;
      min-width: 0;
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 6px;
      padding: 7px 8px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font: inherit;
    }
    textarea {
      resize: vertical;
      min-height: 72px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
    }
    input[type="checkbox"] {
      width: 16px;
      min-width: 16px;
      height: 16px;
      margin: 2px 0 0;
      padding: 0;
      accent-color: var(--accent);
    }
    .field-help {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.45;
    }
    .credential-panel,
    .change-preview {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px;
      background: color-mix(in srgb, var(--panel), transparent 15%);
    }
    .credential-panel.standalone {
      display: grid;
      gap: 14px;
      padding: 16px;
    }
    .credential-summary {
      display: grid;
      gap: 8px;
    }
    .credential-layout {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr);
      gap: 14px;
      align-items: start;
    }
    .credential-actions-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      padding-top: 2px;
      border-top: 1px solid color-mix(in srgb, var(--border), transparent 35%);
    }
    .credential-actions-bar button {
      min-width: 138px;
    }
    .credential-actions,
    .form-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .key-status {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .credential-help {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
    .check-row,
    .option-row {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 9px 10px;
      background: color-mix(in srgb, var(--panel), transparent 12%);
    }
    .check-row strong,
    .option-row strong {
      display: block;
      font-weight: 600;
    }
    .check-row small,
    .option-row small {
      display: block;
      margin-top: 3px;
      color: var(--muted);
      line-height: 1.4;
    }
    .key-fields {
      margin-top: 10px;
    }
    .form-footer {
      display: grid;
      gap: 12px;
      padding-top: 2px;
    }
    .preview-list {
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.6;
    }
    .preview-list li {
      margin: 4px 0;
      overflow-wrap: anywhere;
    }
    .preview-code {
      font-family: var(--vscode-editor-font-family, monospace);
      color: var(--text);
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .hidden {
      display: none !important;
    }
    .empty {
      padding: 28px;
      color: var(--muted);
      text-align: center;
    }
    @media (max-width: 860px) {
      header { flex-direction: column; }
      .toolbar { justify-content: flex-start; }
      .mcp-row-head {
        grid-template-columns: 24px minmax(0, 1fr);
      }
      .card-actions {
        grid-column: 2;
        justify-content: flex-start;
      }
    }
    @media (max-width: 520px) {
      .app {
        padding: 10px;
      }
      header {
        gap: 12px;
      }
      .toolbar {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .toolbar button {
        min-width: 0;
        white-space: normal;
      }
      .cards {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .category-header {
        grid-template-columns: minmax(0, 1fr) 30px;
      }
      .category-stats {
        display: none;
      }
      .mcp-badges,
      .mcp-detail {
        padding-left: 34px;
      }
      .mcp-detail {
        grid-template-columns: minmax(0, 1fr);
      }
      .tool-panel {
        border-left: 0;
        border-top: 1px solid var(--border);
        padding: 10px 0 0;
      }
      .card-actions button {
        flex: 1 1 auto;
      }
      .form-grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .credential-layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .credential-actions-bar button {
        flex: 1 1 100%;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <div class="brand">
        <img src="${iconUri}" alt="">
        <div>
          <h1>Multi-MCP Manager</h1>
          <div class="subtitle">管理本機 Gateway MCP、Token、掃描與版本狀態</div>
        </div>
      </div>
      <div class="toolbar" aria-label="主要操作">
        <button data-command="openInstallForm" data-mode="source">安裝 MCP</button>
        <button class="secondary" data-command="openInstallForm" data-mode="json">匯入 JSON</button>
        <button class="ghost" data-command="openMarketplace">探索 MCP</button>
        <button class="ghost" data-command="rescan">重新掃描</button>
        <button class="ghost" data-command="checkExtensionUpdate">插件更新</button>
        <button class="ghost" data-command="checkVersions">MCP 版本</button>
        <button class="ghost" data-command="openDataDir">開啟資料夾</button>
        <button class="ghost" data-command="refreshState">重新整理</button>
      </div>
    </header>
    <main id="root"></main>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const collapsedCategories = new Set();
    const expandedServers = new Set();
    let activeForm = null;
    let state = ${initialState};

    window.addEventListener('message', (event) => {
      if (event.data?.command === 'state') {
        state = event.data.state;
        render();
      }
    });

    document.body.addEventListener('click', (event) => {
      const categoryToggle = event.target.closest('button[data-category-toggle]');
      if (categoryToggle) {
        const category = categoryToggle.dataset.category;
        if (collapsedCategories.has(category)) collapsedCategories.delete(category);
        else collapsedCategories.add(category);
        render();
        return;
      }

      const serverToggle = event.target.closest('button[data-server-toggle]');
      if (serverToggle) {
        const name = serverToggle.dataset.name;
        if (expandedServers.has(name)) expandedServers.delete(name);
        else expandedServers.add(name);
        render();
        return;
      }

      const button = event.target.closest('button[data-command]');
      if (!button) return;
      const command = button.dataset.command;
      const name = button.dataset.name;
      const enabled = button.dataset.enabled === 'true';
      if (command === 'openInstallForm') {
        activeForm = createInstallForm(button.dataset.mode === 'json' ? 'json' : 'npm');
        render();
        return;
      }
      if (command === 'openEditForm') {
        const server = findServer(name);
        if (server) activeForm = createEditForm(server);
        render();
        return;
      }
      if (command === 'openCredentialPanel') {
        const server = findServer(name);
        if (server) activeForm = createCredentialForm(server);
        render();
        return;
      }
      if (command === 'cancelMcpForm') {
        activeForm = null;
        render();
        return;
      }
      if (command === 'saveMcpForm') {
        const payload = readFormPayload();
        if (payload) vscode.postMessage({ command, payload });
        return;
      }
      if (command === 'saveCredential') {
        const payload = readCredentialPayload();
        if (payload) vscode.postMessage({ command, payload });
        return;
      }
      if (command === 'deleteCredential') {
        vscode.postMessage({ command, name });
        return;
      }
      vscode.postMessage({ command, name, enabled });
    });

    document.body.addEventListener('input', (event) => {
      if (!activeForm || !event.target.closest('#mcp-form')) return;
      syncActiveFormFromDom();
      renderFormPreview();
    });

    document.body.addEventListener('change', (event) => {
      if (!activeForm || !event.target.closest('#mcp-form')) return;
      syncActiveFormFromDom();
      updateSourceModeVisibility();
      updateKeyPanelVisibility();
      renderFormPreview();
    });

    function render() {
      const root = document.getElementById('root');
      const status = state.status;
      const servers = state.servers ?? [];
      root.innerHTML = [
        renderOverview(status, state.extensionUpdate),
        renderMcpForm(),
        renderServers(servers)
      ].join('');
      updateSourceModeVisibility();
      updateKeyPanelVisibility();
      renderFormPreview();
    }

    function findServer(name) {
      return (state.servers ?? []).find((server) => server.name === name);
    }

    function existingCategories() {
      return Array.from(new Set((state.servers ?? []).map((server) => server.category).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b));
    }

    function createInstallForm(sourceMode) {
      const categories = existingCategories();
      return {
        kind: 'mcp',
        mode: 'install',
        currentName: '',
        nextName: '',
        category: categories[0] ?? '未分類',
        sourceMode,
        source: '',
        command: 'npx',
        argsText: '',
        jsonText: '',
        envVarsText: '',
        rescan: true,
        saveCredential: false,
        credentialEnvVar: '',
        credentialLabel: 'default',
        credentialSummary: '目前未設定金鑰；安裝完成後也可以再補。'
      };
    }

    function createEditForm(server) {
      const envVar = server.credential?.envVar ?? server.requiredEnvVars?.[0] ?? '';
      return {
        kind: 'mcp',
        mode: 'edit',
        currentName: server.name,
        nextName: server.name,
        category: server.category || '未分類',
        sourceMode: server.sourceType === 'remote' ? 'remote' : (server.sourceType === 'npm' ? 'npm' : 'custom'),
        source: server.source ?? '',
        command: server.config?.command ?? '',
        argsText: (server.config?.args ?? []).join('\\n'),
        jsonText: JSON.stringify(server.config ?? {}, null, 2),
        envVarsText: (server.requiredEnvVars ?? []).join('\\n'),
        rescan: false,
        saveCredential: false,
        credentialEnvVar: envVar,
        credentialLabel: server.credential?.active ?? 'default',
        credentialSummary: server.credential?.active ? '已設定金鑰：' + server.credential.active + (server.credential.maskedValue ? ' · ' + server.credential.maskedValue : '') : (envVar ? '建議設定金鑰：' + envVar : '此 MCP 未偵測到必要金鑰')
      };
    }

    function createCredentialForm(server) {
      return {
        kind: 'credential',
        currentName: server.name,
        credentialEnvVar: server.credential?.envVar ?? server.requiredEnvVars?.[0] ?? '',
        credentialLabel: server.credential?.active ?? 'default',
        credentialSummary: server.credential?.active ? '已設定金鑰：' + server.credential.active + (server.credential.maskedValue ? ' · ' + server.credential.maskedValue : '') : '尚未設定金鑰'
      };
    }

    function renderMcpForm() {
      if (!activeForm) return '<section class="form-shell" id="mcp-form-shell"></section>';
      if (activeForm.kind === 'credential') {
        return '<section class="form-shell active" id="mcp-form-shell">' +
          '<div class="mcp-form-panel" id="mcp-form">' +
            '<div class="form-header">' +
              '<div><div class="form-title">金鑰 / Token</div><div class="form-subtitle">' + escapeHtml(activeForm.currentName) + ' · 金鑰值只會透過 VS Code 密碼輸入框收集</div></div>' +
              '<button class="ghost" data-command="cancelMcpForm">關閉</button>' +
            '</div>' +
            '<div class="form-body">' +
              '<div class="credential-panel standalone">' +
                '<div class="credential-summary">' +
                  '<div class="key-status"><span class="pill">' + escapeHtml(activeForm.credentialSummary) + '</span></div>' +
                  '<div class="credential-help">這裡設定的是 MCP 啟動時要讀取的環境變數名稱，以及這組金鑰在本機的標籤。完整金鑰值不會出現在此畫面。</div>' +
                '</div>' +
                '<div class="credential-layout">' +
                  '<div class="field"><label for="credential-env">MCP 要讀取的環境變數</label><input id="credential-env" value="' + escapeAttr(activeForm.credentialEnvVar) + '" placeholder="GITHUB_TOKEN"></div>' +
                  '<div class="field"><label for="credential-label">本機標籤</label><input id="credential-label" value="' + escapeAttr(activeForm.credentialLabel) + '" placeholder="default"><div class="field-help">只用來區分多組金鑰，例如 default、work。</div></div>' +
                '</div>' +
                '<div class="credential-actions-bar">' +
                  '<button data-command="saveCredential" data-name="' + escapeAttr(activeForm.currentName) + '">設定 / 更新金鑰值</button>' +
                  '<button class="danger" data-command="deleteCredential" data-name="' + escapeAttr(activeForm.currentName) + '">刪除金鑰</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>';
      }

      const title = activeForm.mode === 'install' ? '新增 MCP' : '編輯 MCP';
      const submit = activeForm.mode === 'install' ? '安裝 MCP' : '套用變更';
      const categories = existingCategories();
      const hasSuggestedKey = parseLines(activeForm.envVarsText).length > 0;
      const keyFieldsClass = activeForm.saveCredential || hasSuggestedKey ? 'key-fields' : 'key-fields hidden';
      return '<section class="form-shell active" id="mcp-form-shell">' +
        '<div class="mcp-form-panel" id="mcp-form">' +
          '<div class="form-header">' +
            '<div><div class="form-title">MCP 設定 · ' + title + '</div><div class="form-subtitle">來源、名稱、分類、啟動方式與認證建議集中在同一張表單</div></div>' +
            '<button class="ghost" data-command="cancelMcpForm">取消</button>' +
          '</div>' +
          '<div class="form-body">' +
            '<div class="form-section">' +
              '<div class="form-section-title">來源</div>' +
              '<div class="form-grid">' +
                '<div class="field"><label for="mcp-source-mode">來源類型</label><select id="mcp-source-mode">' +
                  option('npm', 'npm package', activeForm.sourceMode) +
                  option('remote', 'Remote URL', activeForm.sourceMode) +
                  option('json', 'JSON 匯入', activeForm.sourceMode) +
                  option('custom', '自訂 command', activeForm.sourceMode) +
                '</select></div>' +
                '<div class="field source-panel" data-source-panel="npm remote"><label for="mcp-source">來源</label><input id="mcp-source" value="' + escapeAttr(activeForm.source) + '" placeholder="@scope/server 或 https://..."></div>' +
                '<div class="field full source-panel" data-source-panel="json"><label for="mcp-json">mcpServers JSON 或單一 MCP 設定</label><textarea id="mcp-json" placeholder="{ &quot;mcpServers&quot;: { ... } }">' + escapeHtml(activeForm.jsonText) + '</textarea></div>' +
              '</div>' +
            '</div>' +
            '<div class="form-section">' +
              '<div class="form-section-title">基本資料</div>' +
              '<div class="form-grid">' +
                '<div class="field"><label for="mcp-name">名稱</label><input id="mcp-name" value="' + escapeAttr(activeForm.nextName) + '" placeholder="context7"></div>' +
                '<div class="field"><label for="mcp-category">分類</label><input id="mcp-category" list="mcp-categories" value="' + escapeAttr(activeForm.category) + '" placeholder="文件查詢"><datalist id="mcp-categories">' + categories.map((category) => '<option value="' + escapeAttr(category) + '"></option>').join('') + '</datalist></div>' +
              '</div>' +
            '</div>' +
            '<div class="form-section">' +
              '<div class="form-section-title">啟動設定</div>' +
              '<div class="form-grid">' +
                '<div class="field source-panel" data-source-panel="custom json npm remote"><label for="mcp-command">command</label><input id="mcp-command" value="' + escapeAttr(activeForm.command) + '" placeholder="npx"></div>' +
                '<div class="field full source-panel" data-source-panel="custom json npm remote"><label for="mcp-args">args</label><textarea id="mcp-args" placeholder="每行一個參數">' + escapeHtml(activeForm.argsText) + '</textarea><div class="field-help">npm 與 remote 來源會依來源自動建議 command/args；仍可在套用前微調。</div></div>' +
              '</div>' +
            '</div>' +
            '<div class="form-section">' +
              '<div class="form-section-title">金鑰 / Token</div>' +
              '<div class="credential-panel credential-panel-form">' +
                '<div class="key-status"><span class="pill ' + (hasSuggestedKey || activeForm.saveCredential ? 'warn' : 'ok') + '">' + escapeHtml(activeForm.credentialSummary) + '</span></div>' +
                '<p class="credential-help">金鑰是這個 MCP 啟動時要讀取的 Token 或 API key。完整金鑰值只會在儲存時透過 VS Code 密碼輸入框輸入，不會顯示在管理頁。</p>' +
                '<label class="check-row"><input type="checkbox" id="mcp-save-credential" ' + (activeForm.saveCredential ? 'checked' : '') + '><span><strong>這個 MCP 需要金鑰</strong><small>勾選後可指定環境變數與本機標籤；儲存時會再要求輸入金鑰值。</small></span></label>' +
                '<div class="' + keyFieldsClass + '">' +
                  '<div class="form-grid">' +
                    '<div class="field"><label for="mcp-env-vars">MCP 要讀取的環境變數</label><textarea id="mcp-env-vars" placeholder="GITHUB_TOKEN">' + escapeHtml(activeForm.envVarsText) + '</textarea><div class="field-help">每行一個變數；若 MCP 文件要求 GITHUB_TOKEN，就填 GITHUB_TOKEN。</div></div>' +
                    '<div class="field"><label for="mcp-credential-label">本機標籤</label><input id="mcp-credential-label" value="' + escapeAttr(activeForm.credentialLabel) + '" placeholder="default"><div class="field-help">只用來區分多組金鑰，例如 default、work。</div></div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="form-section">' +
              '<div class="form-section-title">變更預覽</div>' +
              '<div class="change-preview"><ul class="preview-list" id="change-preview-list"></ul></div>' +
            '</div>' +
            '<div class="form-footer">' +
              '<label class="check-row"><input type="checkbox" id="mcp-rescan" ' + (activeForm.rescan ? 'checked' : '') + '><span><strong>儲存後重新掃描 Registry</strong><small>立即更新工具清單；若暫時不需要工具內容，可稍後再掃描。</small></span></label>' +
              '<div class="form-actions"><button data-command="saveMcpForm">' + submit + '</button><button class="ghost" data-command="cancelMcpForm">取消</button></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
    }

    function option(value, label, selected) {
      return '<option value="' + escapeAttr(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }

    function syncActiveFormFromDom() {
      if (!activeForm) return;
      if (activeForm.kind === 'credential') {
        activeForm.credentialEnvVar = document.getElementById('credential-env')?.value ?? '';
        activeForm.credentialLabel = document.getElementById('credential-label')?.value ?? 'default';
        return;
      }
      activeForm.sourceMode = document.getElementById('mcp-source-mode')?.value ?? activeForm.sourceMode;
      activeForm.source = document.getElementById('mcp-source')?.value ?? activeForm.source;
      activeForm.jsonText = document.getElementById('mcp-json')?.value ?? activeForm.jsonText;
      activeForm.nextName = document.getElementById('mcp-name')?.value ?? activeForm.nextName;
      activeForm.category = document.getElementById('mcp-category')?.value ?? activeForm.category;
      activeForm.command = document.getElementById('mcp-command')?.value ?? activeForm.command;
      activeForm.argsText = document.getElementById('mcp-args')?.value ?? activeForm.argsText;
      activeForm.envVarsText = document.getElementById('mcp-env-vars')?.value ?? activeForm.envVarsText;
      activeForm.credentialLabel = document.getElementById('mcp-credential-label')?.value ?? activeForm.credentialLabel;
      activeForm.saveCredential = document.getElementById('mcp-save-credential')?.checked ?? false;
      activeForm.rescan = document.getElementById('mcp-rescan')?.checked ?? false;
      applySourceDefaults(activeForm);
    }

    function applySourceDefaults(form) {
      if (form.sourceMode === 'npm' && form.source && (!form.command || form.command === 'npx')) {
        form.command = 'npx';
        const packageName = form.source.endsWith('@latest') ? form.source : form.source + '@latest';
        form.argsText = '-y\\n' + packageName;
      }
      if (form.sourceMode === 'remote' && form.source && (!form.command || form.command === 'npx')) {
        form.command = 'npx';
        form.argsText = '-y\\nmcp-remote\\n' + form.source;
      }
      if (!form.nextName && form.sourceMode !== 'json') {
        form.nextName = defaultNameFromSource(form.source);
      }
    }

    function updateSourceModeVisibility() {
      if (!activeForm || activeForm.kind !== 'mcp') return;
      for (const panel of document.querySelectorAll('[data-source-panel]')) {
        const modes = panel.dataset.sourcePanel.split(' ');
        panel.classList.toggle('hidden', !modes.includes(activeForm.sourceMode));
      }
    }

    function updateKeyPanelVisibility() {
      if (!activeForm || activeForm.kind !== 'mcp') return;
      const keyFields = document.querySelector('.key-fields');
      if (!keyFields) return;
      keyFields.classList.toggle('hidden', !activeForm.saveCredential && parseLines(activeForm.envVarsText).length === 0);
    }

    function renderFormPreview() {
      if (!activeForm || activeForm.kind !== 'mcp') return;
      const list = document.getElementById('change-preview-list');
      if (!list) return;
      const name = activeForm.nextName || '(尚未命名)';
      const category = activeForm.category || '(未分類)';
      const items = [];
      items.push((activeForm.mode === 'install' ? '將建立' : '將更新') + ' mcps/' + category + '/' + name + '.json');
      if (activeForm.mode === 'edit' && activeForm.currentName !== activeForm.nextName) items.push('重新命名時會同步搬移認證 key');
      items.push('啟動設定：' + (activeForm.command || '(尚未設定)') + ' ' + parseLines(activeForm.argsText).join(' '));
      if (activeForm.saveCredential) items.push('儲存時會開啟 VS Code 密碼輸入框設定金鑰值');
      if (activeForm.rescan) items.push('儲存後會重新掃描 Registry');
      list.innerHTML = items.map((item) => '<li><span class="preview-code">' + escapeHtml(item) + '</span></li>').join('');
    }

    function readFormPayload() {
      if (!activeForm || activeForm.kind !== 'mcp') return undefined;
      syncActiveFormFromDom();
      const envVars = parseLines(activeForm.envVarsText);
      const payload = {
        mode: activeForm.mode,
        currentName: activeForm.currentName || undefined,
        nextName: activeForm.nextName.trim(),
        category: activeForm.category.trim(),
        sourceMode: activeForm.sourceMode,
        source: activeForm.sourceMode === 'json' ? activeForm.jsonText : activeForm.source.trim(),
        command: activeForm.command.trim(),
        args: parseLines(activeForm.argsText),
        envVars,
        rescan: activeForm.rescan
      };
      if (activeForm.sourceMode !== 'json') {
        payload.config = { command: payload.command, args: payload.args };
      }
      if (activeForm.saveCredential) {
        payload.credential = { envVar: envVars[0] ?? '', label: activeForm.credentialLabel.trim() || 'default' };
      }
      return payload;
    }

    function readCredentialPayload() {
      if (!activeForm || activeForm.kind !== 'credential') return undefined;
      syncActiveFormFromDom();
      return {
        name: activeForm.currentName,
        envVar: activeForm.credentialEnvVar.trim(),
        label: activeForm.credentialLabel.trim() || 'default'
      };
    }

    function parseLines(value) {
      return String(value ?? '').split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
    }

    function defaultNameFromSource(source) {
      if (!source) return '';
      if (source.startsWith('https://')) return source.replace('https://', '').split('/')[0].replace(/\\./g, '-');
      return source.split('/').pop().replace(/@latest$/, '');
    }

    function renderOverview(status, extensionUpdate) {
      return '<section><h2>狀態總覽</h2><div class="cards">' +
        card('Gateway', status.initialized ? '就緒' : '尚未初始化') +
        card('版本', status.packageVersion) +
        card('插件更新', extensionUpdateLabel(extensionUpdate), 'extension-update-card') +
        card('已啟用 MCP', status.enabledServers + '/' + status.totalServers) +
        card('已註冊工具', String(status.totalTools)) +
        card('最後掃描', status.registryGeneratedAt ? new Date(status.registryGeneratedAt).toLocaleString() : '尚未掃描') +
        '</div></section>';
    }

    function extensionUpdateLabel(update) {
      if (!update || update.status === 'idle') return '尚未檢查';
      if (update.status === 'current') return '已是最新版';
      if (update.status === 'updateAvailable') return '可更新 ' + (update.latestVersion ?? '');
      if (update.status === 'assetMissing') return '新版 ' + (update.latestVersion ?? '');
      return '檢查失敗';
    }

    function renderServers(servers) {
      if (servers.length === 0) {
        return '<section><div class="installed-heading"><h2>已安裝 MCP</h2></div><div class="panel empty">尚未安裝 MCP。請使用上方安裝或匯入功能建立設定。</div></section>';
      }
      const groups = groupServersByCategory(servers);
      const totalTools = servers.reduce((sum, server) => sum + Number(server.toolCount ?? 0), 0);
      return '<section>' +
        '<div class="installed-heading"><h2>已安裝 MCP</h2><span class="installed-count">' + servers.length + ' 個 MCP · ' + totalTools + ' 個工具</span></div>' +
        '<div class="category-stack">' + groups.map(([category, entries]) => renderCategory(category, entries)).join('') + '</div>' +
      '</section>';
    }

    function renderCategory(category, servers) {
      const collapsed = collapsedCategories.has(category);
      const enabledCount = servers.filter((server) => server.enabled).length;
      const toolCount = servers.reduce((sum, server) => sum + Number(server.toolCount ?? 0), 0);
      const className = collapsed ? 'category-block collapsed' : 'category-block';
      return '<div class="' + className + '">' +
        '<div class="category-header">' +
          '<div class="category-title"><div class="category-name">' + escapeHtml(category) + '</div><div class="category-summary">' + servers.length + ' 個 MCP · 已啟用 ' + enabledCount + ' · ' + toolCount + ' 個工具</div></div>' +
          '<div class="category-stats"><span class="pill">' + enabledCount + '/' + servers.length + ' 啟用</span></div>' +
          '<button class="ghost icon" data-category-toggle="true" data-category="' + escapeAttr(category) + '" title="' + (collapsed ? '展開分類' : '收合分類') + '">' + (collapsed ? '⌄' : '⌃') + '</button>' +
        '</div>' +
        '<div class="mcp-list">' + servers.map(renderMcpRow).join('') + '</div>' +
      '</div>';
    }

    function renderMcpRow(server) {
      const expanded = expandedServers.has(server.name);
      const authClass = server.requiredEnvVars.length > 0 && !server.credential ? 'warn' : 'ok';
      const auth = server.credential?.active ? server.credential.active + ' · ' + (server.credential.maskedValue ?? '已設定') : (server.requiredEnvVars.length ? '缺少 Token' : '不需要');
      const enabledText = server.enabled ? '已啟用' : '已停用';
      const nextEnabled = server.enabled ? 'false' : 'true';
      const rowClass = expanded ? 'mcp-row expanded' : 'mcp-row';
      return '<article class="' + rowClass + '">' +
        '<div class="mcp-row-head">' +
          '<button class="ghost icon" data-server-toggle="true" data-name="' + escapeAttr(server.name) + '" title="' + (expanded ? '收合 MCP' : '展開 MCP') + '">' + (expanded ? '⌃' : '⌄') + '</button>' +
          '<div class="mcp-title"><div class="mcp-name">' + escapeHtml(server.name) + '</div><div class="mcp-source">' + escapeHtml(server.source) + '</div></div>' +
          '<div class="card-actions">' +
            '<button class="ghost" data-command="setEnabled" data-name="' + escapeAttr(server.name) + '" data-enabled="' + nextEnabled + '">' + (server.enabled ? '停用' : '啟用') + '</button>' +
            '<button class="ghost" data-command="openEditForm" data-name="' + escapeAttr(server.name) + '">編輯</button>' +
            '<button class="ghost" data-command="openCredentialPanel" data-name="' + escapeAttr(server.name) + '">認證</button>' +
            '<button class="danger" data-command="removeServer" data-name="' + escapeAttr(server.name) + '">移除</button>' +
          '</div>' +
        '</div>' +
        '<div class="mcp-badges">' +
          '<span class="pill ' + (server.enabled ? 'ok' : 'warn') + '">' + enabledText + '</span>' +
          '<span class="pill">' + String(server.toolCount) + ' 個工具</span>' +
          '<span class="pill ' + authClass + '">' + escapeHtml(auth) + '</span>' +
        '</div>' +
        renderMcpDetail(server, auth) +
      '</article>';
    }

    function renderMcpDetail(server, auth) {
      const envVars = server.requiredEnvVars.length ? server.requiredEnvVars.join(', ') : '不需要';
      return '<div class="mcp-detail">' +
        '<div class="detail-grid">' +
          detail('設定檔', server.configPath) +
          detail('必要環境變數', envVars) +
          detail('完整來源', server.source) +
          detail('認證摘要', auth) +
          detail('分類', server.category || '未分類') +
        '</div>' +
        renderToolSummary(server) +
      '</div>';
    }

    function renderToolSummary(server) {
      const tools = server.tools ?? [];
      if (!server.enabled) {
        return '<div class="tool-panel"><div class="tool-title">工具內容</div><div class="tool-empty tool-empty-state">此 MCP 已停用，未列入目前工具掃描。</div></div>';
      }
      if (server.toolCount === 0 || tools.length === 0) {
        return '<div class="tool-panel"><div class="tool-title">工具內容</div><div class="tool-empty tool-empty-state">尚未掃描到工具。請使用上方「重新掃描」更新 Registry。</div></div>';
      }
      const hidden = Math.max(0, Number(server.toolCount ?? 0) - tools.length);
      return '<div class="tool-panel tool-summary"><div class="tool-title">工具內容</div><div class="tool-list">' +
        tools.map((tool) => '<div class="tool-item"><div class="tool-name" title="' + escapeAttr(tool.name) + '">' + escapeHtml(tool.name) + '</div><div class="tool-desc" title="' + escapeAttr(tool.description) + '">' + escapeHtml(tool.description || '無描述') + '</div></div>').join('') +
        (hidden > 0 ? '<div class="tool-empty">另有 ' + hidden + ' 個工具，可重新掃描或開啟 Registry 查看完整清單。</div>' : '') +
      '</div></div>';
    }

    function groupServersByCategory(servers) {
      const groups = new Map();
      for (const server of servers) {
        const category = server.category || '未分類';
        const entries = groups.get(category) ?? [];
        entries.push(server);
        groups.set(category, entries);
      }
      return Array.from(groups.entries())
        .map(([category, entries]) => [category, entries.sort((a, b) => a.name.localeCompare(b.name))])
        .sort(([a], [b]) => a.localeCompare(b));
    }

    function detail(label, value) {
      return '<div class="detail-item"><div>' + escapeHtml(label) + '</div><div class="detail-value" title="' + escapeAttr(value) + '">' + escapeHtml(value) + '</div></div>';
    }

    function card(label, value, className) {
      const extraClass = className ? ' ' + className : '';
      return '<div class="card' + extraClass + '"><div class="label">' + escapeHtml(label) + '</div><div class="value" title="' + escapeAttr(value) + '">' + escapeHtml(value) + '</div></div>';
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/"/g, '&quot;');
    }

    render();
  </script>
</body>
</html>`;
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let index = 0; index < 32; index += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => {
    const code = char.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${code}`;
  });
}
