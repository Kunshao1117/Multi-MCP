import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGatewayPaths } from '../paths.js';
import { getServerEnv } from '../config-loader.js';
import { scanAndGenerateRegistry } from '../registry.js';
import {
  installMcp, updateMcp, removeMcp, setMcpEnabled, listMcpServers,
} from './servers.js';
import { loadCredentialStore, saveCredentialStore, upsertCredential, switchCredential, deleteCredential } from './credentials.js';
import { removeMcpConfigFile, updateMcpConfigFile, saveMcpConfigFile } from './files.js';
import { commitFileChanges } from './storage.js';

vi.mock('../registry.js', () => ({ scanAndGenerateRegistry: vi.fn() }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, renameSync: vi.fn(actual.renameSync), unlinkSync: vi.fn(actual.unlinkSync) };
});
const roots: string[] = [];
const config = { command: 'node', args: ['fixture.js'] };
const emptyRegistry = { version: '1.0.0', generated_at: '', servers: {}, all_tools: {} };
function fixture() {
  const root = fs.mkdtempSync(resolve(tmpdir(), 'multi-mcp-safety-'));
  roots.push(root);
  const paths = getGatewayPaths(root);
  fs.mkdirSync(paths.mcpsDir);
  // Keep each safety fixture independent from default seeding.
  fs.writeFileSync(paths.defaultMcpSeedPath, '{}');
  return paths;
}
function addConfig(paths: ReturnType<typeof fixture>, category = 'A', name = 'demo', suffix = '.json') {
  const path = resolve(paths.mcpsDir, category, name + suffix);
  fs.mkdirSync(dirname(path), { recursive: true });
  fs.writeFileSync(path, JSON.stringify(config));
  return path;
}
function credential(paths: ReturnType<typeof fixture>, label = 'personal', value = 'OLD_FIXTURE') {
  return upsertCredential({ mcpName: 'demo', label, value, envVar: 'FIXTURE_TOKEN' }, { dataDir: paths.dataDir });
}
function tree(path: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(path)) return result;
  for (const item of fs.readdirSync(path, { withFileTypes: true })) {
    const full = resolve(path, item.name);
    if (item.isDirectory()) for (const [key, value] of Object.entries(tree(full))) result[`${item.name}/${key}`] = value;
    else if (item.isSymbolicLink()) result[item.name] = `link:${fs.readlinkSync(full)}`;
    else result[item.name] = fs.readFileSync(full, 'utf-8');
  }
  return result;
}

beforeEach(() => {
  vi.mocked(scanAndGenerateRegistry).mockReset();
  vi.mocked(scanAndGenerateRegistry).mockResolvedValue(emptyRegistry);
});
afterEach(() => {
  vi.mocked(fs.renameSync).mockRestore();
  vi.mocked(fs.unlinkSync).mockRestore();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('management data-loss regressions', () => {
  it.each(['remove', 'move'])('F01 %s keeps all unrelated files and nested directories', (operation) => {
    const paths = fixture(); addConfig(paths);
    fs.writeFileSync(resolve(paths.mcpsDir, 'A', 'notes.txt'), 'keep');
    fs.writeFileSync(resolve(paths.mcpsDir, 'A', '.hidden'), 'keep');
    fs.mkdirSync(resolve(paths.mcpsDir, 'A', 'backups'));
    fs.writeFileSync(resolve(paths.mcpsDir, 'A', 'backups', 'data.txt'), 'keep');
    if (operation === 'remove') removeMcpConfigFile(paths, 'demo');
    else updateMcpConfigFile(paths, { currentName: 'demo', nextName: 'demo', category: 'Z', config });
    expect(tree(resolve(paths.mcpsDir, 'A'))).toEqual({ '.hidden': 'keep', 'notes.txt': 'keep', 'backups/data.txt': 'keep' });
  });
  it('F01 preserves disabled MCP and removes only a truly empty directory', () => {
    const paths = fixture(); addConfig(paths); addConfig(paths, 'A', 'disabled', '.disabled');
    removeMcpConfigFile(paths, 'demo');
    expect(fs.existsSync(resolve(paths.mcpsDir, 'A', 'disabled.disabled'))).toBe(true);
    removeMcpConfigFile(paths, 'disabled');
    expect(fs.existsSync(resolve(paths.mcpsDir, 'A'))).toBe(false);
  });
  it.each(['../escape', '..', '.', '/absolute', 'C:\\escape', 'C:escape', '\\\\server\\share', 'a/b', 'a\\b', 'CON', 'nul.json', 'LPT1', 'name.', '__proto__', 'bad\0name'])('F02 rejects invalid name/category %j without writes', async (bad) => {
    for (const field of ['name', 'category'] as const) {
      const paths = fixture(); const before = tree(paths.dataDir);
      await expect(installMcp({ name: 'demo', category: '安全分類', config, [field]: bad }, { dataDir: paths.dataDir })).rejects.toThrow();
      expect(tree(paths.dataDir)).toEqual(before);
    }
  });
  it.each(['gateway', 'first__second', 'constructor'])('F22 rejects runtime-reserved MCP name %s before initialization', async (name) => {
    const paths = fixture(); const before = tree(paths.dataDir);
    await expect(installMcp({ name, category: 'A', config }, { dataDir: paths.dataDir })).rejects.toThrow();
    expect(tree(paths.dataDir)).toEqual(before);
  });
  it.each(['category', 'mcps', 'file', 'data-parent'])('F02 rejects a symlink %s without modifying either destination', async (kind) => {
    const paths = fixture(); const outside = fixture();
    const sentinel = resolve(outside.dataDir, 'sentinel.txt'); fs.writeFileSync(sentinel, 'keep');
    let dataDir = paths.dataDir;
    if (kind === 'category') fs.symlinkSync(outside.dataDir, resolve(paths.mcpsDir, 'A'), 'dir');
    if (kind === 'mcps') { fs.rmdirSync(paths.mcpsDir); fs.symlinkSync(outside.dataDir, paths.mcpsDir, 'dir'); }
    if (kind === 'file') { fs.mkdirSync(resolve(paths.mcpsDir, 'A')); fs.symlinkSync(sentinel, resolve(paths.mcpsDir, 'A', 'demo.json')); }
    if (kind === 'data-parent') { fs.symlinkSync(outside.dataDir, resolve(paths.dataDir, 'link'), 'dir'); dataDir = resolve(paths.dataDir, 'link', 'new'); }
    const before = tree(paths.dataDir); const outsideBefore = tree(outside.dataDir);
    await expect(installMcp({ name: 'demo', category: 'A', config }, { dataDir })).rejects.toThrow(/連結/);
    expect(tree(paths.dataDir)).toEqual(before); expect(tree(outside.dataDir)).toEqual(outsideBefore);
  });
  it('F02 validates rename/move before creating a destination and accepts Traditional Chinese', async () => {
    const paths = fixture(); addConfig(paths); const before = tree(paths.dataDir);
    await expect(updateMcp({ currentName: 'demo', nextName: '../bad', category: '新分類', config }, { dataDir: paths.dataDir })).rejects.toThrow();
    await expect(updateMcp({ currentName: 'demo', nextName: 'demo', category: '../bad', config }, { dataDir: paths.dataDir })).rejects.toThrow();
    expect(tree(paths.dataDir)).toEqual(before);
    expect((await updateMcp({ currentName: 'demo', nextName: '工具甲', category: '新分類', config }, { dataDir: paths.dataDir })).ok).toBe(true);
  });
  it.each(['.json', '.json.disabled', '.disabled'])('F14 overwrite moves one config and preserves %s enabled state', async (suffix) => {
    const paths = fixture(); const original = addConfig(paths, 'A', 'demo', suffix);
    const result = await installMcp({ name: 'demo', category: 'Z', config: { command: 'node', args: ['new.js'] }, overwrite: true }, { dataDir: paths.dataDir });
    expect(result.ok).toBe(true); expect(fs.existsSync(original)).toBe(false);
    const servers = listMcpServers({ dataDir: paths.dataDir });
    expect(servers).toHaveLength(1); expect(servers[0].enabled).toBe(suffix === '.json');
    expect(servers[0].config.args).toEqual(['new.js']);
  });
  it('F14 same-category overwrite remains unique and case collisions refuse without writes', async () => {
    const paths = fixture(); addConfig(paths);
    expect((await installMcp({ name: 'demo', category: 'A', config, overwrite: true }, { dataDir: paths.dataDir })).ok).toBe(true);
    const before = tree(paths.dataDir);
    expect((await installMcp({ name: 'DEMO', category: 'Z', config, overwrite: true }, { dataDir: paths.dataDir })).ok).toBe(false);
    expect(tree(paths.dataDir)).toEqual(before);
  });
  it('F14 refuses a preexisting duplicate instead of choosing an arbitrary config', async () => {
    const paths = fixture(); addConfig(paths); addConfig(paths, 'Z'); const before = tree(paths.dataDir);
    await expect(installMcp({ name: 'demo', category: 'C', config, overwrite: true }, { dataDir: paths.dataDir })).rejects.toThrow(/重複/);
    expect(tree(paths.dataDir)).toEqual(before);
  });
  it('F14 a publication failure preserves the original config', async () => {
    const paths = fixture(); const original = addConfig(paths); const before = tree(paths.dataDir);
    // Force publication of the replacement to fail after the destination was staged.
    vi.mocked(fs.renameSync).mockImplementationOnce(() => { throw new Error('fixture rename failure'); });
    await expect(installMcp({ name: 'demo', category: 'Z', config, overwrite: true }, { dataDir: paths.dataDir })).rejects.toThrow();
    expect(fs.readFileSync(original, 'utf-8')).toBe(JSON.stringify(config));
    // Initialization can add the normal gateway files; config tree must remain exactly the same.
    expect(tree(paths.mcpsDir)).toEqual(Object.fromEntries(Object.entries(before).filter(([key]) => key.startsWith('mcps/')).map(([key, value]) => [key.slice(5), value])));
  });
  it('F14 a source deletion failure rolls back the new target', async () => {
    const paths = fixture(); const original = addConfig(paths);
    const before = tree(paths.mcpsDir);
    const actualUnlink = vi.mocked(fs.unlinkSync).getMockImplementation()!;
    let failed = false;
    vi.mocked(fs.unlinkSync).mockImplementation((path) => {
      if (!failed && path === original) { failed = true; throw new Error('fixture delete failure'); }
      return actualUnlink(path);
    });
    await expect(installMcp({ name: 'demo', category: 'Z', config, overwrite: true }, { dataDir: paths.dataDir })).rejects.toThrow();
    expect(tree(paths.mcpsDir)).toEqual(before);
  });
  it('file helper supports a fresh data directory but rejects invalid input before creating it', () => {
    const parent = fixture(); const paths = getGatewayPaths(resolve(parent.dataDir, 'fresh'));
    expect(() => saveMcpConfigFile(paths, '../outside', 'demo', config)).toThrow();
    expect(fs.existsSync(paths.dataDir)).toBe(false);
    saveMcpConfigFile(paths, '合法分類', 'demo', config);
    expect(fs.existsSync(resolve(paths.mcpsDir, '合法分類', 'demo.json'))).toBe(true);
  });
  it.each(['{"important":', '[]', 'null', '{"demo":{"accounts":null}}', '{"demo":{"active":"missing","authType":"env_token","envVar":"TOKEN","accounts":{}}}'])('F16 corrupt/schema-invalid credential store fails closed: %s', async (raw) => {
    const paths = fixture(); addConfig(paths);
    fs.writeFileSync(paths.credentialsPath, raw); fs.writeFileSync(paths.envPath, 'EXISTING=keep\n');
    const before = tree(paths.dataDir);
    expect(() => credential(paths)).toThrow();
    await expect(updateMcp({ currentName: 'demo', nextName: 'new', category: 'Z', config }, { dataDir: paths.dataDir })).rejects.toThrow();
    await expect(removeMcp('demo', { dataDir: paths.dataDir })).rejects.toThrow();
    expect(tree(paths.dataDir)).toEqual(before);
  });
  it('F16 credentials and env roll back if the second rename fails; temp files do not remain', () => {
    const paths = fixture(); credential(paths); const before = tree(paths.dataDir);
    const actualRename = vi.mocked(fs.renameSync).getMockImplementation()!;
    let calls = 0;
    vi.mocked(fs.renameSync).mockImplementation((from, to) => {
      if (++calls === 2) throw new Error('fixture second-file failure');
      return actualRename(from, to);
    });
    expect(() => credential(paths, 'personal', 'NEW_FIXTURE')).toThrow(/second-file/);
    expect(tree(paths.dataDir)).toEqual(before);
  });
  it('F16 rejects a stale revision instead of losing the newer credential', () => {
    const paths = fixture(); credential(paths);
    const stale = loadCredentialStore(paths);
    credential(paths, 'work', 'WORK_FIXTURE');
    const before = tree(paths.dataDir);
    stale.demo.accounts.personal.value = 'STALE_FIXTURE';
    expect(() => saveCredentialStore(paths, stale)).toThrow(/其他操作/);
    expect(tree(paths.dataDir)).toEqual(before);
  });
  it('F16 rejects symlink credential/env targets and multiline/env-name injection', () => {
    const paths = fixture(); const outside = fixture();
    fs.writeFileSync(outside.envPath, 'KEEP=old'); fs.symlinkSync(outside.envPath, paths.credentialsPath);
    expect(() => credential(paths)).toThrow(/連結/);
    fs.unlinkSync(paths.credentialsPath); fs.symlinkSync(outside.envPath, paths.envPath);
    expect(() => credential(paths)).toThrow(/連結/);
    expect(fs.readFileSync(outside.envPath, 'utf-8')).toBe('KEEP=old');
    fs.unlinkSync(paths.envPath);
    const before = tree(paths.dataDir);
    expect(() => upsertCredential({ mcpName: 'demo', label: 'default', value: 'x\nINJECT=y', envVar: 'TOKEN' }, { dataDir: paths.dataDir })).toThrow();
    expect(() => upsertCredential({ mcpName: 'demo', label: 'default', value: 'x', envVar: 'A=B' }, { dataDir: paths.dataDir })).toThrow();
    expect(tree(paths.dataDir)).toEqual(before);
  });
  it('F16 creates restrictive credential files atomically on POSIX', () => {
    const paths = fixture(); credential(paths);
    if (process.platform !== 'win32') {
      expect(fs.statSync(paths.credentialsPath).mode & 0o777).toBe(0o600);
      expect(fs.statSync(paths.envPath).mode & 0o777).toBe(0o600);
    }
    expect(fs.readdirSync(paths.dataDir).some((name) => name.endsWith('.tmp') || name === '.management.lock')).toBe(false);
  });
  it('F15 scanner observes committed new name, config and credential snapshot', async () => {
    const paths = fixture(); addConfig(paths); credential(paths);
    vi.mocked(scanAndGenerateRegistry).mockImplementation(async (loaded) => {
      expect(loaded.mcpServers.renamed.env?.FIXTURE_TOKEN).toBe('NEW_FIXTURE');
      expect(getServerEnv(loaded, 'renamed').FIXTURE_TOKEN).toBe('NEW_FIXTURE');
      expect(loaded.mcpServers.demo).toBeUndefined();
      expect(loadCredentialStore(paths)).not.toHaveProperty('demo');
      expect(loadCredentialStore(paths).renamed.accounts.personal.value).toBe('NEW_FIXTURE');
      return emptyRegistry;
    });
    const result = await updateMcp({ currentName: 'demo', nextName: 'renamed', category: 'Z',
      config: { command: 'node', args: ['new.js'], env: { FIXTURE_TOKEN: '${FIXTURE_TOKEN}' } },
      credential: { label: 'personal', value: 'NEW_FIXTURE', envVar: 'FIXTURE_TOKEN' }, rescan: true,
    }, { dataDir: paths.dataDir });
    expect(result).toMatchObject({ ok: true, committed: true, savedName: 'renamed' });
    expect(scanAndGenerateRegistry).toHaveBeenCalledOnce();
  });
  it('F15 scan exceptions and stale results report saved config without claiming scan success', async () => {
    const paths = fixture(); addConfig(paths);
    vi.mocked(scanAndGenerateRegistry).mockRejectedValueOnce(new Error('scanner failed'));
    expect(await updateMcp({ currentName: 'demo', nextName: 'new', category: 'A', config, rescan: true }, { dataDir: paths.dataDir }))
      .toMatchObject({ ok: false, changed: true, committed: true, savedName: 'new' });
    vi.mocked(scanAndGenerateRegistry).mockResolvedValueOnce({ ...emptyRegistry, servers: { new: { tool_count: 0, tools: {}, stale: true } } });
    expect(await updateMcp({ currentName: 'new', nextName: 'new', category: 'A', config, rescan: true }, { dataDir: paths.dataDir }))
      .toMatchObject({ ok: false, committed: true, failedServers: ['new'] });
  });
  it('F17 adding a label does not silently switch; explicit switching and active deletion are consistent', () => {
    const paths = fixture(); addConfig(paths); credential(paths); credential(paths, 'work', 'WORK_FIXTURE');
    expect(loadCredentialStore(paths).demo.active).toBe('personal');
    expect(listMcpServers({ dataDir: paths.dataDir })[0].credential?.accountLabels).toEqual(['personal', 'work']);
    expect(switchCredential('demo', 'work', { dataDir: paths.dataDir }).ok).toBe(true);
    expect(fs.readFileSync(paths.envPath, 'utf-8')).toContain('FIXTURE_TOKEN=WORK_FIXTURE');
    expect(deleteCredential('demo', 'work', { dataDir: paths.dataDir }).ok).toBe(true);
    expect(loadCredentialStore(paths).demo.active).toBe('personal');
    expect(fs.readFileSync(paths.envPath, 'utf-8')).toContain('FIXTURE_TOKEN=OLD_FIXTURE');
  });
  it('F29 refuses to replace an existing single-key mapping and preserves all bytes', () => {
    const paths = fixture(); credential(paths); const before = tree(paths.dataDir);
    expect(() => upsertCredential({ mcpName: 'demo', label: 'personal', value: 'NEW_FIXTURE', envVar: 'SECOND_TOKEN' }, { dataDir: paths.dataDir })).toThrow(/一個/);
    expect(tree(paths.dataDir)).toEqual(before);
  });
  it.each(['plain@1.6.5', 'plain@next', 'plain@^2.0.0', '@scope/pkg@1.2.3', '@scope/pkg@beta', '@scope/pkg@~3.1.0'])('F04 preserves npm spec %s', async (source) => {
    const paths = fixture();
    expect((await installMcp({ name: 'demo', category: 'A', source }, { dataDir: paths.dataDir })).ok).toBe(true);
    expect(listMcpServers({ dataDir: paths.dataDir })[0].config.args).toEqual(['-y', source]);
  });
  it.each([null, [], { command: '', args: [] }, { command: 'node', args: [1] }, { command: 'node', args: [], env: { A: 1 } }, { command: 'node', args: [], preload: 'true' }])('F22 management rejects invalid configuration without writes', async (bad) => {
    const paths = fixture(); const before = tree(paths.dataDir);
    await expect(installMcp({ name: 'demo', category: 'A', config: bad as typeof config }, { dataDir: paths.dataDir })).rejects.toThrow();
    expect(tree(paths.dataDir)).toEqual(before);
  });
  it('F16 atomic helper detects a non-file target before modifying another target', () => {
    const paths = fixture(); fs.writeFileSync(paths.envPath, 'KEEP'); fs.mkdirSync(paths.credentialsPath);
    expect(() => commitFileChanges(paths.dataDir, [{ path: paths.envPath, data: 'NEW' }, { path: paths.credentialsPath, data: '{}' }])).toThrow();
    expect(fs.readFileSync(paths.envPath, 'utf-8')).toBe('KEEP');
  });
  it('F20 source entry points and export cannot initialize or emit raw settings', () => {
    const cli = fs.readFileSync(resolve('src/cli.ts'), 'utf-8');
    const ps = fs.readFileSync(resolve('console.ps1'), 'utf-8');
    const exporter = fs.readFileSync(resolve('src/cli/import-export.ts'), 'utf-8');
    expect(cli).not.toMatch(/mainMenu|import |ensureUserData/);
    expect(ps).not.toMatch(/npm install|npx|Set-Location/);
    expect(exporter).not.toMatch(/writeFileSync|readFileSync|cleanCategories|不含密鑰/);
    expect(cli).toContain('已停用'); expect(ps).toContain('已停用'); expect(exporter).toContain('已停用');
  });
});
