import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { ProcessPool } from './process-pool.js';
import { loadConfig } from './config-loader.js';
import type { GatewayConfig } from './types.js';
const fixture = fileURLToPath(new URL('../tests/fixtures/runtime-downstream.mjs', import.meta.url));
const runner = fileURLToPath(new URL('../tests/fixtures/gateway-runner.mjs', import.meta.url));
const dirs: string[] = [];
const pools: ProcessPool[] = [];
const pids = new Set<number>();
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function until(predicate: () => boolean, message: string, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) { if (Date.now() > deadline) throw new Error(message); await sleep(10); }
}
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'multi-mcp-runtime-')); dirs.push(dir);
  const state = join(dir, 'state'); mkdirSync(state);
  const a = join(dir, 'a'); const b = join(dir, 'b'); mkdirSync(a); mkdirSync(b);
  const config: GatewayConfig = {
    gateway: { idle_timeout_ms: 0, startup_timeout_ms: 2000, max_retries: 0, log_level: 'error' },
    mcpServers: { fixture: { command: process.execPath, args: [fixture], env: { FIXTURE_STATE_DIR: state } } },
  };
  return { dir, state, a, b, config };
}
function body(result: unknown): { pid: number; cwd: string; token: string | null } {
  return JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);
}
function rememberChildren(state: string): number[] {
  const children = readdirSync(state).filter((file) => file.endsWith('.started')).map((file) => Number(file.split('.')[0]));
  children.forEach((pid) => pids.add(pid)); return children;
}
afterEach(async () => {
  await Promise.allSettled(pools.splice(0).map((pool) => pool.shutdownAll()));
  for (const dir of dirs) {
    if (existsSync(join(dir, 'state'))) rememberChildren(join(dir, 'state'));
  }
  for (const pid of pids) { if (alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch {} } }
  pids.clear(); dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('real SDK and controlled OS children', () => {
  it('isolates cwd, tracks active calls and waits for child exit on shutdown', async () => {
    const { config, state, a, b } = setup(); config.gateway.idle_timeout_ms = 30;
    const pool = new ProcessPool(config); pools.push(pool);
    const [one, two] = await Promise.all([
      pool.callTool('fixture', { name: 'wait', arguments: { milliseconds: 100 } }, { workspace: a }),
      pool.callTool('fixture', { name: 'wait', arguments: { milliseconds: 100 } }, { workspace: b }),
    ]);
    const A = body(one); const B = body(two); pids.add(A.pid); pids.add(B.pid);
    expect(A.cwd).toBe(a); expect(B.cwd).toBe(b); expect(A.pid).not.toBe(B.pid);
    await pool.shutdownAll();
    await until(() => !alive(A.pid) && !alive(B.pid), 'child processes survived shutdown');
    expect(existsSync(join(state, `${A.pid}.closed`))).toBe(true);
    expect(existsSync(join(state, `${B.pid}.closed`))).toBe(true);
  }, 15000);

  it('reload reads NEW and deletion from the original file without retaining OLD', async () => {
    const { config, dir, a } = setup(); const configPath = join(dir, 'gateway.config.json');
    config.gateway.env_file = 'gateway.env'; config.mcpServers.fixture.env!.FIXTURE_TOKEN = '${FIXTURE_CREDENTIAL}';
    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(join(dir, 'gateway.env'), 'FIXTURE_CREDENTIAL=OLD\n');
    const before = process.env.FIXTURE_CREDENTIAL;
    const pool = new ProcessPool(loadConfig(configPath)); pools.push(pool);
    const first = body(await pool.callTool('fixture', { name: 'inspect' }, { workspace: a })); pids.add(first.pid);
    expect(first.token).toBe('OLD');
    writeFileSync(join(dir, 'gateway.env'), 'FIXTURE_CREDENTIAL=NEW\n'); await pool.reloadServer('fixture');
    const second = body(await pool.callTool('fixture', { name: 'inspect' }, { workspace: a })); pids.add(second.pid);
    expect(second.token).toBe('NEW'); expect(second.pid).not.toBe(first.pid); expect(alive(first.pid)).toBe(false);
    writeFileSync(join(dir, 'gateway.env'), ''); await pool.reloadServer('fixture');
    const third = body(await pool.callTool('fixture', { name: 'inspect' }, { workspace: a })); pids.add(third.pid);
    expect(third.token).toBe('${FIXTURE_CREDENTIAL}'); expect(alive(second.pid)).toBe(false);
    expect(process.env.FIXTURE_CREDENTIAL).toBe(before);
  }, 15000);

  it('successful initialize remains unverified and a protected 401 is distinct', async () => {
    const { config, a } = setup(); const pool = new ProcessPool(config); pools.push(pool);
    await pool.getClient('fixture', { workspace: a });
    expect(pool.getHealthInfo().find((health) => health.workspace === a)?.authStatus).toBe('unknown');
    await expect(pool.callTool('fixture', { name: 'protected' }, { workspace: a })).rejects.toThrow('Unauthorized');
    expect(pool.getHealthInfo().find((health) => health.workspace === a)?.authStatus).toBe('expired');
  }, 15000);

  it('SDK cancellation notification reaches the downstream request without replay', async () => {
    const { config, a, state } = setup(); const pool = new ProcessPool(config); pools.push(pool);
    const controller = new AbortController();
    const call = pool.callTool('fixture', { name: 'wait', arguments: { milliseconds: 3000 } }, { workspace: a, signal: controller.signal });
    const rejected = call.catch((error) => error);
    await until(() => readdirSync(state).some((name) => name.endsWith('.started')), 'downstream did not start');
    // Wait until the request has passed initialize and been dispatched.
    await until(() => pool.getHealthInfo().some((health) => health.workspace === a && health.state === 'ready'), 'downstream did not initialize');
    await sleep(20); controller.abort(new Error('cancel fixture request'));
    expect(await rejected).toBeInstanceOf(Error);
    const children = rememberChildren(state);
    expect(children).toHaveLength(1);
    await until(() => existsSync(join(state, `${children[0]}.aborted`)), 'SDK cancellation did not reach child');
  }, 15000);

  it('startup timeout closes a real silent child and leaves no surviving process', async () => {
    const { config, state } = setup(); config.gateway.startup_timeout_ms = 500;
    config.mcpServers.fixture.env!.FIXTURE_SILENT = '1';
    const pool = new ProcessPool(config); pools.push(pool);
    await expect(pool.getClient('fixture')).rejects.toThrow('啟動超時');
    const children = rememberChildren(state); expect(children).toHaveLength(1);
    await until(() => children.every((pid) => !alive(pid)), 'silent child survived timeout');
  }, 15000);

  it('closing only Gateway stdin shuts down its preloaded child and Gateway process', async () => {
    const { config, dir, state } = setup(); config.mcpServers.fixture.preload = true;
    const configPath = join(dir, 'gateway.config.json'); writeFileSync(configPath, JSON.stringify(config));
    const gateway = spawn(process.execPath, ['--import', 'tsx', runner, configPath], { cwd: resolve('.'), stdio: ['pipe', 'pipe', 'pipe'] });
    pids.add(gateway.pid!);
    let stderr = ''; gateway.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    gateway.stdout.resume();
    const exited = new Promise<number | null>((resolve) => gateway.once('exit', resolve));
    await until(() => readdirSync(state).some((file) => file.endsWith('.started')), `Gateway did not preload: ${stderr}`);
    const children = rememberChildren(state);
    gateway.stdin.end();
    await until(() => gateway.exitCode !== null, `Gateway survived EOF: ${stderr}`);
    expect(await exited).toBe(0);
    await until(() => children.every((pid) => !alive(pid)), 'Gateway children survived host EOF');
    expect(children.every((pid) => existsSync(join(state, `${pid}.closed`)))).toBe(true);
  }, 15000);
});
