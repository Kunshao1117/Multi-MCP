import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, watch, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GatewayConfig, ToolRegistry } from './types.js';

// These are true process-isolation tests: each worker imports production sources
// with tsx and the real MCP SDK. Only the downstream JSON-RPC peer is a fixture.
const runner = fileURLToPath(new URL('../tests/fixtures/registry-concurrent-runner.mjs', import.meta.url));
const downstream = fileURLToPath(new URL('../tests/fixtures/registry-concurrent-downstream.mjs', import.meta.url));
const roots: string[] = [];
const workers: Worker[] = [];
const DEADLINE = 8000;
interface Outcome { ok: boolean; registry?: ToolRegistry; error?: string; pid: number }
interface Command { action?: 'scan' | 'prune'; reload?: boolean; failRename?: boolean; failRead?: boolean; ioCode?: 'EIO' | 'EACCES' }

function bounded<T>(promise: Promise<T>, message: string, timeout = DEADLINE): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeout);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}
function alive(pid: number): boolean { try { process.kill(pid, 0); return true; } catch { return false; } }
function cleanEnv(): NodeJS.ProcessEnv {
  // Do not pass the developer's credentials, NODE_OPTIONS or real MCP settings to fixtures.
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR', 'HOME']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}
function publish(path: string, value: unknown): void {
  const temporary = `${path}.test.tmp`;
  writeFileSync(temporary, JSON.stringify(value));
  renameSync(temporary, path);
}
function seed(tool = 'cached'): ToolRegistry {
  const name = `fixture__${tool}`;
  return { version: '1.0.0', generated_at: '2000-01-01T00:00:00.000Z',
    servers: { fixture: { tool_count: 1, tools: { [name]: {
      original_name: tool, server_name: 'fixture', description: tool, inputSchema: { type: 'object' },
    } } } }, all_tools: { [name]: 'fixture' } };
}
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'multi-mcp-registry-concurrent-')); roots.push(root);
  const state = join(root, 'state'); mkdirSync(state);
  const configPath = join(root, 'gateway.config.json');
  const registryPath = join(root, 'registry.json');
  const lock = join(root, '.management.lock');
  const config: GatewayConfig = {
    gateway: { idle_timeout_ms: 0, startup_timeout_ms: 20000, max_retries: 0, log_level: 'error' },
    mcpServers: { fixture: { command: process.execPath, args: [downstream],
      env: { REGISTRY_CONCURRENT_STATE: state } } },
  };
  publish(configPath, config); publish(registryPath, seed());
  return { root, state, configPath, registryPath, lock, config };
}
type Fixture = ReturnType<typeof setup>;

class Worker {
  readonly child: ChildProcess;
  readonly ready: Promise<void>;
  readonly exit: Promise<void>;
  private stderr = '';
  private nextId = 0;
  private waiting = new Map<number, { resolve: (result: Outcome) => void; reject: (error: Error) => void }>();
  constructor(readonly fixture: Fixture, readonly name: string) {
    this.child = spawn(process.execPath, ['--import', 'tsx', runner, fixture.configPath, fixture.registryPath, name], {
      env: cleanEnv(), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    this.child.stdout!.resume();
    this.child.stderr!.on('data', (chunk) => { this.stderr = (this.stderr + chunk.toString()).slice(-12000); });
    this.exit = new Promise((resolve) => this.child.once('close', () => resolve()));
    this.ready = bounded(new Promise<void>((resolve, reject) => {
      this.child.once('error', reject);
      this.child.once('exit', (code, signal) => {
        const error = new Error(`Worker ${name} exited (${code ?? signal}): ${this.stderr}`);
        reject(error);
        for (const waiter of this.waiting.values()) waiter.reject(error);
        this.waiting.clear();
      });
      this.child.on('message', (message: { type: string; id: number } & Outcome) => {
        if (message.type === 'ready') resolve();
        if (message.type === 'result') {
          this.waiting.get(message.id)?.resolve(message);
          this.waiting.delete(message.id);
        }
      });
    }), `Worker ${name} did not initialize`);
    // Keep failures observed even when an assertion fails before awaiting readiness.
    void this.ready.catch(() => {});
    workers.push(this);
  }
  async command(options: Command = {}): Promise<Outcome> {
    await this.ready;
    const id = ++this.nextId;
    const result = new Promise<Outcome>((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.child.send({ id, action: 'scan', ...options }, (error) => { if (error) reject(error); });
    });
    return bounded(result, `Worker ${this.name} operation did not settle: ${this.stderr}`)
      .finally(() => this.waiting.delete(id));
  }
  abort(): void { this.child.send({ action: 'abort' }); }
  async close(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) { await this.exit; return; }
    this.child.kill('SIGTERM');
    try { await bounded(this.exit, 'worker did not exit', 1500); }
    catch { this.child.kill('SIGKILL'); await bounded(this.exit, 'worker survived SIGKILL', 1500); }
  }
}
// fs.watch plus a check after registration avoids lost wakeups and busy waiting.
async function readyForTools(worker: Worker): Promise<{ pid: number }> {
  await worker.ready;
  const target = join(worker.fixture.state, `${worker.name}.ready.json`);
  return new Promise((resolve, reject) => {
    let watcher: ReturnType<typeof watch> | undefined;
    let settled = false;
    const finish = (error?: Error, value?: { pid: number }) => {
      if (settled) return;
      settled = true; clearTimeout(timer); watcher?.close();
      if (error) reject(error); else resolve(value!);
    };
    const check = () => {
      if (!existsSync(target)) return;
      try { finish(undefined, JSON.parse(readFileSync(target, 'utf8'))); }
      catch (error) { finish(error as Error); }
    };
    const timer = setTimeout(() => finish(new Error(`Worker ${worker.name} did not reach tools/list`)), DEADLINE);
    watcher = watch(worker.fixture.state, check);
    watcher.once('error', (error) => finish(error));
    void worker.exit.then(() => finish(new Error(`Worker ${worker.name} exited before tools/list`)));
    check();
  });
}
async function beginScan(worker: Worker, options: Command = {}) {
  for (const suffix of ['gate.json', 'ready.json']) rmSync(join(worker.fixture.state, `${worker.name}.${suffix}`), { force: true });
  const result = worker.command(options);
  void result.catch(() => {});
  const { pid } = await readyForTools(worker);
  expect(pid).not.toBe(worker.child.pid);
  // The cross-process lock must never cover downstream network/discovery waits.
  expect(existsSync(worker.fixture.lock)).toBe(false);
  expect(existsSync(join(dirname(worker.fixture.configPath), '.management.lock'))).toBe(false);
  return { result, pid };
}
function release(worker: Worker, gate: { tools?: string[]; pages?: string[][]; fail?: boolean }): void {
  publish(join(worker.fixture.state, `${worker.name}.gate.json`), gate);
}
function bytes(fixture: Fixture): string { return readFileSync(fixture.registryPath, 'utf8'); }
function disk(fixture: Fixture): ToolRegistry { return JSON.parse(bytes(fixture)); }
function assertClean(fixture: Fixture): void {
  for (const root of new Set([fixture.root, dirname(fixture.configPath), dirname(fixture.registryPath)])) {
    expect(existsSync(join(root, '.management.lock'))).toBe(false);
    expect(readdirSync(root).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  }
}
async function assertRecovered(worker: Worker) {
  const scan = await beginScan(worker, { reload: true });
  release(worker, { tools: ['recovered'] });
  expect((await scan.result).ok).toBe(true);
  expect(Object.keys(disk(worker.fixture).all_tools)).toEqual(['fixture__recovered']);
  expect(alive(scan.pid)).toBe(false);
  assertClean(worker.fixture);
}

afterEach(async () => {
  await Promise.all(workers.splice(0).map((worker) => worker.close()));
  for (const root of roots.splice(0)) {
    const state = join(root, 'state');
    if (existsSync(state)) {
      for (const name of readdirSync(state).filter((name) => name.endsWith('.started'))) {
        const pid = Number(name.split('.')[0]);
        if (alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch {} }
      }
    }
    rmSync(root, { recursive: true, force: true });
  }
});

describe('registry publication across independent Node processes (real MCP SDK)', () => {
  it('a slow old successful scan cannot overwrite a newer complete paginated scan', async () => {
    const fixture = setup(); const a = new Worker(fixture, 'a'); const b = new Worker(fixture, 'b');
    await Promise.all([a.ready, b.ready]); expect(a.child.pid).not.toBe(b.child.pid);
    const old = await beginScan(a); const fresh = await beginScan(b);
    release(b, { pages: [['new'], ['new_second_page']] });
    expect((await fresh.result).ok).toBe(true);
    expect(Object.keys(disk(fixture).all_tools)).toEqual(['fixture__new', 'fixture__new_second_page']);
    const published = bytes(fixture);
    release(a, { tools: ['old'] });
    expect((await old.result).ok).toBe(false);
    expect(bytes(fixture)).toBe(published);
    expect(alive(old.pid)).toBe(false); expect(alive(fresh.pid)).toBe(false);
    assertClean(fixture);
    await assertRecovered(a);
  }, 30000);

  it('a failed old scan cannot replace another process\'s new cache with its stale LKG', async () => {
    const fixture = setup(); const a = new Worker(fixture, 'a'); const b = new Worker(fixture, 'b');
    const old = await beginScan(a); const fresh = await beginScan(b);
    release(b, { tools: ['fresh'] }); expect((await fresh.result).ok).toBe(true);
    const published = bytes(fixture);
    release(a, { fail: true }); expect((await old.result).ok).toBe(false);
    expect(bytes(fixture)).toBe(published);
    expect(disk(fixture).servers.fixture.stale).not.toBe(true);
    expect(Object.keys(disk(fixture).all_tools)).toEqual(['fixture__fresh']);
    assertClean(fixture); await assertRecovered(a);
  }, 30000);

  it('disk disable plus another process\'s prune cannot be undone by an in-flight scan', async () => {
    const fixture = setup(); const a = new Worker(fixture, 'a'); const b = new Worker(fixture, 'b');
    await b.ready;
    const old = await beginScan(a);
    publish(fixture.configPath, { ...fixture.config, mcpServers: {} });
    expect((await b.command({ action: 'prune', reload: true })).ok).toBe(true);
    expect(disk(fixture).servers).toEqual({}); expect(disk(fixture).all_tools).toEqual({});
    const pruned = bytes(fixture);
    release(a, { tools: ['must_not_return'] }); expect((await old.result).ok).toBe(false);
    expect(bytes(fixture)).toBe(pruned); assertClean(fixture);
    expect((await a.command({ reload: true })).ok).toBe(true);
    expect(disk(fixture).servers).toEqual({}); assertClean(fixture);
  }, 30000);

  it('a no-op prune preserves bytes and lets a valid in-flight scan publish', async () => {
    const fixture = setup(); const a = new Worker(fixture, 'a'); const b = new Worker(fixture, 'b');
    const old = await beginScan(a); const initial = bytes(fixture);
    expect((await b.command({ action: 'prune' })).ok).toBe(true);
    expect(Object.keys(disk(fixture).all_tools)).toEqual(['fixture__cached']);
    expect(bytes(fixture)).toBe(initial);
    release(a, { tools: ['valid'] }); expect((await old.result).ok).toBe(true);
    expect(Object.keys(disk(fixture).all_tools)).toEqual(['fixture__valid']); assertClean(fixture);
  }, 30000);

  it('changed disk credentials reject a stale scan even if registry bytes never changed', async () => {
    const fixture = setup();
    fixture.config.gateway.env_file = 'gateway.env';
    fixture.config.mcpServers.fixture.env!.REGISTRY_FIXTURE_VERSION = '${REGISTRY_FIXTURE_VERSION}';
    publish(fixture.configPath, fixture.config);
    writeFileSync(join(fixture.root, 'gateway.env'), 'REGISTRY_FIXTURE_VERSION=OLD_TEST_VALUE\n');
    const a = new Worker(fixture, 'a'); const initial = bytes(fixture);
    const old = await beginScan(a);
    writeFileSync(join(fixture.root, 'gateway.env'), 'REGISTRY_FIXTURE_VERSION=NEW_TEST_VALUE\n');
    release(a, { tools: ['old_environment'] }); expect((await old.result).ok).toBe(false);
    expect(bytes(fixture)).toBe(initial); assertClean(fixture);
    await assertRecovered(a);
  }, 30000);

  it('a lock conflict settles without stealing the other owner\'s lock and can retry', async () => {
    const fixture = setup(); const a = new Worker(fixture, 'a');
    const scan = await beginScan(a); const initial = bytes(fixture);
    writeFileSync(fixture.lock, 'another process owns this lock', { flag: 'wx' });
    release(a, { tools: ['not_published'] });
    // A bounded result while the lock still exists rules out waiting/spinning for it.
    expect((await bounded(scan.result, 'publication waited for a held lock', 3000)).ok).toBe(false);
    expect(readFileSync(fixture.lock, 'utf8')).toBe('another process owns this lock');
    expect(bytes(fixture)).toBe(initial);
    rmSync(fixture.lock); await assertRecovered(a);
  }, 30000);

  for (const ioCode of ['EIO', 'EACCES'] as const) {
    it(`publication ${ioCode} preserves bytes, removes temporary files and releases its lock`, async () => {
      const fixture = setup(); const a = new Worker(fixture, 'a'); const initial = bytes(fixture);
      const scan = await beginScan(a, { failRename: true, ioCode });
      release(a, { tools: ['cannot_commit'] }); expect((await scan.result).ok).toBe(false);
      expect(bytes(fixture)).toBe(initial); assertClean(fixture);
      await assertRecovered(a);
    }, 30000);

    it(`registry read ${ioCode} is not mistaken for a missing file`, async () => {
      const fixture = setup(); const a = new Worker(fixture, 'a'); const initial = bytes(fixture);
      expect((await a.command({ failRead: true, ioCode })).ok).toBe(false);
      expect(bytes(fixture)).toBe(initial); assertClean(fixture);
      expect(readdirSync(fixture.state).filter((name) => name.endsWith('.started'))).toEqual([]);
      await assertRecovered(a);
    }, 30000);

  }

  it('cancelling a blocked discovery preserves bytes and frees the process for a retry', async () => {
    const fixture = setup(); const a = new Worker(fixture, 'a'); const initial = bytes(fixture);
    const scan = await beginScan(a); a.abort();
    expect((await scan.result).ok).toBe(false);
    expect(bytes(fixture)).toBe(initial); expect(alive(scan.pid)).toBe(false);
    assertClean(fixture); await assertRecovered(a);
  }, 30000);

  it('a discovery timeout keeps the LKG without holding a publication lock', async () => {
    const fixture = setup(); fixture.config.gateway.startup_timeout_ms = 1500;
    publish(fixture.configPath, fixture.config);
    const a = new Worker(fixture, 'a'); const scan = await beginScan(a);
    // No gate release: the scanner's real deadline, not a test-side failure, fires.
    const result = await scan.result; expect(result.ok).toBe(true);
    expect(Object.keys(disk(fixture).all_tools)).toEqual(['fixture__cached']);
    expect(disk(fixture).servers.fixture.stale).toBe(true);
    expect(alive(scan.pid)).toBe(false); assertClean(fixture);
    await assertRecovered(a);
  }, 30000);

  it('a foreign second-root lock releases the first root and permits a retry', async () => {
    const fixture = setup();
    const registryRoot = join(fixture.root, 'a-registry'); mkdirSync(registryRoot);
    const configRoot = join(fixture.root, 'z-config'); mkdirSync(configRoot);
    fixture.configPath = join(configRoot, 'gateway.config.json');
    fixture.registryPath = join(registryRoot, 'registry.json');
    fixture.lock = join(registryRoot, '.management.lock');
    publish(fixture.configPath, fixture.config); publish(fixture.registryPath, seed());
    const a = new Worker(fixture, 'a'); const scan = await beginScan(a); const initial = bytes(fixture);
    const foreignLock = join(configRoot, '.management.lock');
    writeFileSync(foreignLock, 'foreign config mutation', { flag: 'wx' });
    release(a, { tools: ['cannot_commit'] });
    expect((await bounded(scan.result, 'second-root conflict did not settle', 3000)).ok).toBe(false);
    expect(bytes(fixture)).toBe(initial);
    expect(existsSync(fixture.lock)).toBe(false);
    expect(readFileSync(foreignLock, 'utf8')).toBe('foreign config mutation');
    rmSync(foreignLock); assertClean(fixture); await assertRecovered(a);
  }, 30000);

  it('prune rejects stale loaded config rather than deleting a newly enabled server', async () => {
    const fixture = setup(); publish(fixture.configPath, { ...fixture.config, mcpServers: {} });
    const stale = new Worker(fixture, 'stale'); await stale.ready;
    publish(fixture.configPath, fixture.config); const initial = bytes(fixture);
    expect((await stale.command({ action: 'prune' })).ok).toBe(false);
    expect(bytes(fixture)).toBe(initial); assertClean(fixture);
    expect((await stale.command({ action: 'prune', reload: true })).ok).toBe(true);
    expect(bytes(fixture)).toBe(initial); assertClean(fixture);
  }, 30000);

  it('an uncontended failed scan still publishes the last known good tools as stale', async () => {
    const fixture = setup(); const a = new Worker(fixture, 'a');
    const scan = await beginScan(a); release(a, { fail: true });
    const result = await scan.result; expect(result.ok).toBe(true);
    expect(Object.keys(disk(fixture).all_tools)).toEqual(['fixture__cached']);
    expect(disk(fixture).servers.fixture.stale).toBe(true);
    expect(disk(fixture).servers.fixture.tool_count).toBe(1);
    expect(alive(scan.pid)).toBe(false); assertClean(fixture);
  }, 30000);
});
