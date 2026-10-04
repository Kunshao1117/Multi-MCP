import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { GatewayConfig } from './types.js';

const mock = vi.hoisted(() => ({ connect: vi.fn(), list: vi.fn(), close: vi.fn(), transportClose: vi.fn() }));
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({ Client: class {
  connect = mock.connect; listTools = mock.list; close = mock.close;
} }));
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({ StdioClientTransport: class {
  close = mock.transportClose;
} }));
import { scanAndGenerateRegistry } from './registry.js';

let root: string;
const config = (): GatewayConfig => ({
  gateway: { idle_timeout_ms: 1000, startup_timeout_ms: 1000, max_retries: 0, log_level: 'error' },
  mcpServers: { demo: { command: 'fixture', args: [] } },
});
const tool = (name: string) => ({ name, inputSchema: { type: 'object' } });
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'multi-mcp-scan-'));
  vi.resetAllMocks();
  mock.connect.mockResolvedValue(undefined);
  mock.close.mockResolvedValue(undefined);
  mock.transportClose.mockResolvedValue(undefined);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it('follows nextCursor and deduplicates tools by name', async () => {
  mock.list.mockResolvedValueOnce({ tools: [tool('one')], nextCursor: 'two' })
    .mockResolvedValueOnce({ tools: [tool('one'), tool('two')] });
  const result = await scanAndGenerateRegistry(config(), path.join(root, 'registry.json'));
  expect(Object.keys(result.all_tools)).toEqual(['demo__one', 'demo__two']);
  expect(result.servers.demo.tool_count).toBe(2);
  expect(mock.list.mock.calls[1][0]).toEqual({ cursor: 'two' });
  expect(mock.close).toHaveBeenCalledTimes(1);
  expect(mock.transportClose).toHaveBeenCalledTimes(1);
});

it('marks failed scans stale and preserves last-known-good tools, but drops removed servers', async () => {
  const registryPath = path.join(root, 'registry.json');
  mock.list.mockResolvedValueOnce({ tools: [tool('one')] });
  await scanAndGenerateRegistry(config(), registryPath);
  mock.list.mockRejectedValueOnce(new Error('temporary outage'));
  const stale = await scanAndGenerateRegistry(config(), registryPath);
  expect(stale.servers.demo.stale).toBe(true);
  expect(stale.all_tools).toEqual({ demo__one: 'demo' });
  expect(JSON.parse(readFileSync(registryPath, 'utf8'))).toEqual(stale);
  const empty = config(); empty.mcpServers = {};
  const result = await scanAndGenerateRegistry(empty, registryPath);
  expect(result.servers).toEqual({});
  expect(result.all_tools).toEqual({});
});

it('stops repeated cursor loops without publishing partial tools', async () => {
  mock.list.mockResolvedValue({ tools: [tool('one')], nextCursor: 'loop' });
  const result = await scanAndGenerateRegistry(config(), path.join(root, 'registry.json'));
  expect(mock.list).toHaveBeenCalledTimes(2);
  expect(result.servers.demo.stale).toBe(true);
  expect(result.all_tools).toEqual({});
});

it('coalesces identical in-flight scans without interleaved writes', async () => {
  let resolveList!: (value: unknown) => void;
  mock.list.mockImplementationOnce(() => new Promise((resolve) => { resolveList = resolve; }));
  const registryPath = path.join(root, 'registry.json');
  const first = scanAndGenerateRegistry(config(), registryPath);
  const second = scanAndGenerateRegistry(config(), registryPath);
  expect(first).toBe(second);
  await vi.waitFor(() => expect(resolveList).toBeDefined());
  resolveList({ tools: [tool('one')] });
  await Promise.all([first, second]);
  expect(mock.connect).toHaveBeenCalledTimes(1);
});

it('fails closed on a corrupt previous cache instead of overwriting it', async () => {
  const registryPath = path.join(root, 'registry.json');
  writeFileSync(registryPath, '{unrecoverable');
  await expect(scanAndGenerateRegistry(config(), registryPath)).rejects.toThrow();
  expect(readFileSync(registryPath, 'utf8')).toBe('{unrecoverable');
  expect(mock.connect).not.toHaveBeenCalled();
});

it('aborts an in-flight scanner and keeps the prior snapshot unchanged', async () => {
  const registryPath = path.join(root, 'registry.json');
  mock.list.mockResolvedValueOnce({ tools: [tool('known')] });
  await scanAndGenerateRegistry(config(), registryPath);
  const before = readFileSync(registryPath, 'utf8');
  mock.connect.mockImplementationOnce(() => new Promise(() => {}));
  const controller = new AbortController();
  const pending = scanAndGenerateRegistry(config(), registryPath, { signal: controller.signal });
  const rejection = expect(pending).rejects.toThrow(/cancelled/);
  await vi.waitFor(() => expect(mock.connect).toHaveBeenCalledTimes(2));
  controller.abort();
  await rejection;
  expect(readFileSync(registryPath, 'utf8')).toBe(before);
  expect(mock.transportClose).toHaveBeenCalledTimes(2);
});

it('serializes rescan and reload so removed membership stays removed on disk and in memory', async () => {
  const { loadConfig } = await import('./config-loader.js');
  const { ProcessPool } = await import('./process-pool.js');
  const { ToolRouter } = await import('./tool-router.js');
  const configPath = path.join(root, 'source.json');
  const registryPath = path.join(root, 'registry.json');
  writeFileSync(configPath, JSON.stringify(config()));
  mock.list.mockResolvedValueOnce({ tools: [tool('known')] });
  const loaded = loadConfig(configPath);
  const original = await scanAndGenerateRegistry(loaded, registryPath);
  const pool = new ProcessPool(loaded);
  const router = new ToolRouter(original, pool, loaded, { configPath, registryPath });
  let release!: (value: unknown) => void;
  mock.list.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const scan = router.route('gateway__rescan', {});
  const scanRejected = expect(scan).rejects.toThrow(/已變更/);
  await vi.waitFor(() => expect(release).toBeDefined());
  writeFileSync(configPath, JSON.stringify({ ...config(), mcpServers: {} }));
  const reload = expect(router.route('gateway__reload_server', { server_name: 'demo' })).rejects.toThrow(/已移除/);
  release({ tools: [tool('known')] });
  await Promise.all([scanRejected, reload]);
  expect(Object.keys(router.getRegistry().servers)).toEqual([]);
  expect(Object.keys(pool.getConfig().mcpServers)).toEqual([]);
  expect(Object.keys(JSON.parse(readFileSync(registryPath, 'utf8')).servers)).toEqual([]);
  await pool.shutdownAll();
});


it('does not publish or start a replacement scanner after unconfirmed cleanup', async () => {
  const registryPath = path.join(root, 'registry.json');
  mock.list.mockResolvedValue({ tools: [tool('known')] });
  await scanAndGenerateRegistry(config(), registryPath);
  const before = readFileSync(registryPath, 'utf8');
  mock.transportClose.mockRejectedValueOnce(new Error('close unconfirmed'));
  await expect(scanAndGenerateRegistry(config(), registryPath)).rejects.toThrow(/清理失敗/);
  expect(readFileSync(registryPath, 'utf8')).toBe(before);
  const count = mock.connect.mock.calls.length;
  await expect(scanAndGenerateRegistry(config(), registryPath)).rejects.toThrow(/清理未確認/);
  expect(mock.connect).toHaveBeenCalledTimes(count);
});
