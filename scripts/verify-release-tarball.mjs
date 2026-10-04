import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const [pack] = JSON.parse(readFileSync(process.argv[2] ?? 'pack.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(pack.name, 'multi-mcp-gateway');
assert.equal(pack.version, pkg.version);
assert.equal(pack.filename, `multi-mcp-gateway-${pkg.version}.tgz`);
for (const file of pack.files) {
  assert.ok(file.path.startsWith('dist/') || ['package.json', 'README.md', 'CHANGELOG.md', 'mcp-catalog.json'].includes(file.path), `Unexpected public file: ${file.path}`);
}
const temp = mkdtempSync(path.join(tmpdir(), 'multi-mcp-release-'));
let client;
let stderr = '';
try {
  writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--prefix', temp, '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', path.resolve(pack.filename)], { stdio: 'inherit', timeout: 120000 });
  const root = path.join(temp, 'node_modules', 'multi-mcp-gateway');
  const installed = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(installed.version, pkg.version);
  assert.equal(execFileSync(process.execPath, [path.join(root, 'dist/index.js'), '--version'], { encoding: 'utf8', timeout: 10000 }).trim(), pkg.version);
  const management = await import(pathToFileURL(path.join(root, 'dist/management/index.js')).href);
  assert.equal(typeof management.getGatewayStatus, 'function');
  const config = path.join(temp, 'isolated-config.json');
  writeFileSync(config, JSON.stringify({ gateway: { idle_timeout_ms: 1000, startup_timeout_ms: 5000, max_retries: 0, log_level: 'error' }, mcpServers: {} }));
  client = new Client({ name: 'release-tarball-verifier', version: '1.0.0' }, { capabilities: {} });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'dist/index.js'), `--config=${config}`], cwd: temp, env: { ...process.env, MULTI_MCP_HOME: path.join(temp, 'isolated-home') }, stderr: 'pipe' });
  transport.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
  await client.connect(transport);
  assert.equal(client.getServerVersion()?.version, pkg.version);
  assert.equal((await client.listTools()).tools.length, 10);
  console.log(`Verified installable ${pack.filename}: public file allowlist, version, management import and real SDK stdio handshake`);
} catch (error) {
  if (stderr) console.error(stderr);
  throw error;
} finally {
  if (client) await client.close();
  rmSync(temp, { recursive: true, force: true });
}
