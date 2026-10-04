import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = mkdtempSync(path.join(tmpdir(), 'multi-mcp-runtime-'));
const workspaceA = path.join(root, 'project-a');
const workspaceB = path.join(root, 'project-b');
const home = path.join(root, 'isolated-data');
for (const dir of [workspaceA, workspaceB, home]) mkdirSync(dir);
// An explicit config avoids default third-party MCP seeding, network access and real credentials.
const configPath = path.join(home, 'config=fixture.json');
writeFileSync(configPath, JSON.stringify({
  gateway: { idle_timeout_ms: 1000, startup_timeout_ms: 5000, max_retries: 0, log_level: 'error' },
  mcpServers: { fixture: { command: process.execPath, args: [path.join(packageRoot, 'scripts/fixtures/stdio-server.mjs')] } },
}));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(packageRoot, 'dist/index.js'), `--config=${path.relative(packageRoot, configPath)}`],
  cwd: packageRoot,
  env: { ...process.env, MULTI_MCP_HOME: path.join(root, 'unused-default') },
  stderr: 'pipe',
});
const client = new Client({ name: 'gateway-runtime-verifier', version: '1.0.0' }, { capabilities: {} });
const text = (result) => result.content?.filter((item) => item.type === 'text').map((item) => item.text).join('\n') ?? '';
const invoke = (name, args = {}) => client.callTool({ name: `gateway__${name}`, arguments: args });
try {
  await client.connect(transport);
  const gatewayTools = await client.listTools();
  assert.equal(gatewayTools.tools.length, 10);
  assert.match(gatewayTools.tools.find((tool) => tool.name === 'gateway__call_tool').description, /每次呼叫都要明確傳入/);
  const scan = await invoke('rescan');
  assert.notEqual(scan.isError, true, text(scan));
  assert.match(text(await invoke('list_server_tools', { server_name: 'fixture' })), /共有 2 個工具/);
  assert.match(text(await invoke('search_tools', { query: 'echo' })), /fixture__echo/);
  assert.equal(text(await invoke('call_tool', { name: 'fixture__echo', arguments: { text: 'ok' }, workspace: workspaceA })), 'ok');
  for (const workspace of [workspaceA, workspaceB, workspaceA]) {
    const result = await invoke('call_tool', { name: 'fixture__workspace', arguments: {}, workspace });
    assert.deepEqual(JSON.parse(text(result)), { cwd: workspace, projectRoot: workspace });
  }
  const conflict = await invoke('call_tool', { name: 'fixture__workspace', arguments: { projectRoot: workspaceB }, workspace: workspaceA });
  assert.equal(conflict.isError, true);
  const relative = await invoke('call_tool', { name: 'fixture__echo', arguments: { text: 'bad' }, workspace: 'relative' });
  assert.equal(relative.isError, true);
  assert.match(text(await invoke('auth_test', { server_name: 'fixture' })), /尚未驗證/);
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.mcpServers = {};
  writeFileSync(configPath, JSON.stringify(config));
  await invoke('rescan');
  assert.deepEqual(JSON.parse(text(await invoke('list_servers'))).servers, []);
  assert.equal((await invoke('auth_test', { server_name: 'fixture' })).isError, true);
  const failingConfig = { gateway: config.gateway, mcpServers: { broken: { command: process.execPath, args: ['-e', 'process.exit(1)'] } } };
  writeFileSync(configPath, JSON.stringify(failingConfig));
  const failedScan = spawnSync(process.execPath, [path.join(packageRoot, 'dist/index.js'), '--scan', `--config=${configPath}`], { encoding: 'utf8', timeout: 15000, env: { ...process.env, MULTI_MCP_HOME: path.join(root, 'unused-default') } });
  assert.equal(failedScan.status, 1, failedScan.stderr);
  assert.match(failedScan.stderr, /部分掃描失敗/);
  assert.doesNotMatch(failedScan.stderr, /掃描完成:/);
  console.log('Hermetic Gateway stdio verification passed (no third-party MCPs or user data).');
} finally {
  await client.close();
  await transport.close();
  rmSync(root, { recursive: true, force: true });
}
