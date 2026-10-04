import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, reloadConfig, getConfigContext, getServerEnv, validateMcpServerConfig } from './config-loader.js';
const roots: string[] = [];
const gateway = { idle_timeout_ms: 0, startup_timeout_ms: 100, max_retries: 0, log_level: 'error' };
const root = () => { const dir = mkdtempSync(join(tmpdir(), 'multi-mcp-snapshot-')); roots.push(dir); return dir; };
afterEach(() => roots.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('credential snapshots', () => {
  it('OLD → NEW → removed loads actual current values without changing process.env or old snapshots', () => {
    const dir = root(); const path = join(dir, 'gateway.config.json'); const envPath = join(dir, 'gateway.env');
    const key = '__MCP_SNAPSHOT_FIXTURE__'; const original = process.env[key];
    writeFileSync(path, JSON.stringify({ gateway: { ...gateway, env_file: 'gateway.env' }, mcpServers: { a: { command: 'node', args: ['${' + key + '}'], env: { TOKEN: '${' + key + '}' } } } }));
    writeFileSync(envPath, `${key}=OLD\n`);
    const old = loadConfig(path, {});
    expect(old.mcpServers.a.args).toEqual(['OLD']);
    expect(getConfigContext(old)?.rawConfig.mcpServers.a.args).toEqual(['${' + key + '}']);
    writeFileSync(envPath, `${key}=NEW\n`);
    const fresh = reloadConfig(old);
    expect(fresh.mcpServers.a.env?.TOKEN).toBe('NEW');
    expect(getServerEnv(fresh, 'a')[key]).toBe('NEW');
    expect(old.mcpServers.a.env?.TOKEN).toBe('OLD');
    writeFileSync(envPath, '');
    const removed = reloadConfig(fresh);
    expect(removed.mcpServers.a.env?.TOKEN).toBe('${' + key + '}');
    expect(getServerEnv(removed, 'a')[key]).toBeUndefined();
    expect(process.env[key]).toBe(original);
    expect(Object.isFrozen(fresh.mcpServers.a.env)).toBe(true);
    expect(Object.isFrozen(getConfigContext(fresh)?.rawConfig)).toBe(true);
  });

  it('two data directories and genuine initial OS overrides remain isolated', () => {
    const a = root(); const b = root();
    for (const [dir, value] of [[a, 'ONE'], [b, 'TWO']]) {
      writeFileSync(join(dir, 'gateway.config.json'), JSON.stringify({ gateway: { ...gateway, env_file: 'gateway.env' }, mcpServers: { a: { command: 'node', args: ['${KEY}'] } } }));
      writeFileSync(join(dir, 'gateway.env'), `KEY=${value}\n`);
    }
    const one = loadConfig(join(a, 'gateway.config.json'), {});
    const two = loadConfig(join(b, 'gateway.config.json'), {});
    const os = loadConfig(join(a, 'gateway.config.json'), { KEY: 'OS' });
    expect(one.mcpServers.a.args).toEqual(['ONE']); expect(two.mcpServers.a.args).toEqual(['TWO']);
    writeFileSync(join(a, 'gateway.env'), 'KEY=NEW\n');
    expect(reloadConfig(os).mcpServers.a.args).toEqual(['OS']);
    expect(reloadConfig(two).mcpServers.a.args).toEqual(['TWO']);
  });
});

const invalidServers: unknown[] = [null, [], {}, { command: '', args: [] }, { command: '  ', args: [] },
  { command: 'node', args: 'no' }, { command: 'node', args: [1] }, { command: 'node', args: [], env: [] },
  { command: 'node', args: [], env: { TOKEN: 42 } }, { command: 'node', args: [], preload: 'true' },
  JSON.parse('{"command":"node","args":[],"__proto__":{"x":1}}')];
describe('same inline/directory schema', () => {
  it.each(invalidServers)('rejects invalid inline server %# and skips only the invalid directory file', (server) => {
    const dir = root(); const path = join(dir, 'gateway.config.json');
    writeFileSync(path, JSON.stringify({ gateway, mcpServers: { broken: server } }));
    expect(() => loadConfig(path)).toThrow();
    mkdirSync(join(dir, 'mcps', 'test'), { recursive: true });
    writeFileSync(path, JSON.stringify({ gateway: { ...gateway, mcps_dir: 'mcps' } }));
    writeFileSync(join(dir, 'mcps', 'test', 'bad.json'), JSON.stringify(server));
    writeFileSync(join(dir, 'mcps', 'test', 'good.json'), JSON.stringify({ command: 'node', args: [] }));
    const config = loadConfig(path);
    expect(Object.keys(config.mcpServers)).toEqual(['good']);
    expect(getConfigContext(config)?.diagnostics[0]).toContain('test/bad.json');
  });
  it('rejects null/array roots, arrays as server maps, fractional retries and overflowing timeouts', () => {
    const dir = root(); const path = join(dir, 'gateway.config.json');
    for (const value of [null, [], { gateway, mcpServers: [] }, { gateway: { ...gateway, max_retries: 0.5 }, mcpServers: {} },
      { gateway: { ...gateway, startup_timeout_ms: 1e100 }, mcpServers: {} }]) {
      writeFileSync(path, JSON.stringify(value)); expect(() => loadConfig(path)).toThrow();
    }
  });
  it('rejects reserved names and does not pollute prototypes', () => {
    const dir = root(); const path = join(dir, 'gateway.config.json');
    for (const name of ['__proto__', 'constructor', 'prototype', 'gateway', 'ambiguous__name']) {
      writeFileSync(path, JSON.stringify({ gateway, mcpServers: Object.fromEntries([[name, { command: 'node', args: [] }]]) }));
      expect(() => loadConfig(path)).toThrow();
    }
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
  it('reports duplicate names deterministically instead of overwriting an earlier server silently', () => {
    const dir = root(); const path = join(dir, 'gateway.config.json');
    writeFileSync(path, JSON.stringify({ gateway: { ...gateway, mcps_dir: 'mcps' } }));
    for (const category of ['a', 'b']) {
      mkdirSync(join(dir, 'mcps', category), { recursive: true });
      writeFileSync(join(dir, 'mcps', category, 'duplicate.json'), JSON.stringify({ command: 'node', args: [category] }));
    }
    const config = loadConfig(path);
    expect(config.mcpServers.duplicate.args).toEqual(['a']);
    expect(getConfigContext(config)?.diagnostics).toEqual(['b/duplicate.json: MCP 名稱重複']);
  });
  it('validation never includes credential values in errors', () => {
    expect(() => validateMcpServerConfig({ command: 'node', args: [], env: { TOKEN: { secret: 'DO-NOT-LOG' } } })).toThrow('env');
    try { validateMcpServerConfig({ command: 'node', args: [], env: { TOKEN: { secret: 'DO-NOT-LOG' } } }); }
    catch (error) { expect(String(error)).not.toContain('DO-NOT-LOG'); }
  });
});
