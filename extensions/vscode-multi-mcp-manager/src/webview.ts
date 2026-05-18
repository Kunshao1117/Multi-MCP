import * as vscode from 'vscode';
import type { GatewayStatus, McpServerSummary } from '../../../src/management/index.js';

export interface DashboardState {
  status: GatewayStatus;
  servers: McpServerSummary[];
}

export type WebviewMessage =
  | { command: 'refreshState' }
  | { command: 'installSource' }
  | { command: 'installJson' }
  | { command: 'removeServer'; name: string }
  | { command: 'setEnabled'; name: string; enabled: boolean }
  | { command: 'upsertCredential'; name: string }
  | { command: 'rescan' }
  | { command: 'checkVersions' }
  | { command: 'openDataDir' }
  | { command: 'openRegistry' }
  | { command: 'openMarketplace' };

export function getDashboardStructureMarkers(): string[] {
  return ['category-section', 'data-category-toggle', 'mcp-row', 'tool-summary', 'tool-empty-state', '探索 MCP'];
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
        <button data-command="installSource">安裝 MCP</button>
        <button class="secondary" data-command="installJson">匯入 JSON</button>
        <button class="ghost" data-command="openMarketplace">探索 MCP</button>
        <button class="ghost" data-command="rescan">重新掃描</button>
        <button class="ghost" data-command="checkVersions">檢查版本</button>
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
      vscode.postMessage({ command, name, enabled });
    });

    function render() {
      const root = document.getElementById('root');
      const status = state.status;
      const servers = state.servers ?? [];
      root.innerHTML = [
        renderOverview(status),
        renderServers(servers)
      ].join('');
    }

    function renderOverview(status) {
      return '<section><h2>狀態總覽</h2><div class="cards">' +
        card('Gateway', status.initialized ? '就緒' : '尚未初始化') +
        card('版本', status.packageVersion) +
        card('已啟用 MCP', status.enabledServers + '/' + status.totalServers) +
        card('已註冊工具', String(status.totalTools)) +
        card('最後掃描', status.registryGeneratedAt ? new Date(status.registryGeneratedAt).toLocaleString() : '尚未掃描') +
        '</div></section>';
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
            '<button class="ghost" data-command="upsertCredential" data-name="' + escapeAttr(server.name) + '">Token</button>' +
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

    function card(label, value) {
      return '<div class="card"><div class="label">' + escapeHtml(label) + '</div><div class="value" title="' + escapeAttr(value) + '">' + escapeHtml(value) + '</div></div>';
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
