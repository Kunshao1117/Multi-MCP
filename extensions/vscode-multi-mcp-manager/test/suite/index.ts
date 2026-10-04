import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('kunshao.vscode-multi-mcp-manager');
  assert.ok(extension, 'extension should be installed in the test host');
  await extension.activate();
  const corePackage = JSON.parse(readFileSync(resolve(extension.extensionPath, '..', '..', 'package.json'), 'utf8')) as { version: string };
  const commands = await vscode.commands.getCommands(true);
  for (const command of [
    'multiMcp.refresh',
    'multiMcp.installAdvanced',
    'multiMcp.installManual',
    'multiMcp.removePick',
    'multiMcp.remove',
    'multiMcp.enable',
    'multiMcp.disable',
    'multiMcp.addCredentialPick',
    'multiMcp.addCredential',
    'multiMcp.rescan',
    'multiMcp.checkVersions',
    'multiMcp.checkExtensionUpdate',
    'multiMcp.openDataDir',
    'multiMcp.openRegistry',
    'multiMcp.openMarketplace',
  ]) {
    assert.ok(commands.includes(command), `${command} should be registered`);
  }

  assert.ok(!commands.includes('multiMcp.installCatalog'), 'catalog install command should not be registered');
  assert.ok(!commands.includes('multiMcp.installCatalogItem'), 'catalog item command should not be registered');

  const state = await vscode.commands.executeCommand<{
    status: { packageVersion: string; totalServers: number };
    servers: Array<{ tools?: unknown[] }>;
    extensionVersion?: string;
    extensionUpdate?: { status: string; currentVersion: string };
  }>('multiMcp.internal.getDashboardStateForTest');
  assert.strictEqual(state.status.packageVersion, corePackage.version, 'bundled dashboard must report the core version, not the extension version');
  assert.strictEqual(state.extensionVersion, extension.packageJSON.version, 'dashboard must report the extension version separately');
  assert.ok(Array.isArray(state.servers), 'dashboard state should include servers');
  assert.ok(state.extensionUpdate?.currentVersion, 'dashboard state should include extension update status');
  if (state.servers.length > 0) {
    assert.ok(Array.isArray(state.servers[0].tools), 'server summary should include tool summaries');
  }

  const markers = await vscode.commands.executeCommand<string[]>('multiMcp.internal.getDashboardStructureMarkersForTest');
  assert.ok(markers.includes('category-section'), 'dashboard should render category sections');
  assert.ok(markers.includes('data-category-toggle'), 'dashboard should include category collapse controls');
  assert.ok(markers.includes('mcp-row'), 'dashboard should render MCP rows');
  assert.ok(markers.includes('mcp-form-panel'), 'dashboard should render the shared MCP form shell');
  assert.ok(markers.includes('credential-panel'), 'dashboard should render credential settings');
  assert.ok(markers.includes('key-status'), 'dashboard should explain key status');
  assert.ok(markers.includes('credential-help'), 'dashboard should explain key handling');
  assert.ok(markers.includes('check-row'), 'dashboard should render readable checkbox rows');
  assert.ok(markers.includes('form-footer'), 'dashboard should keep form actions aligned');
  assert.ok(markers.includes('change-preview'), 'dashboard should render change previews');
  assert.ok(markers.includes('tool-summary'), 'dashboard should render tool summaries');
  assert.ok(markers.includes('tool-empty-state'), 'dashboard should render tool empty states');
  assert.ok(markers.includes('extension-update-card'), 'dashboard should render extension update status');
  assert.ok(markers.includes('探索 MCP'), 'dashboard should label marketplace as exploration');
}
