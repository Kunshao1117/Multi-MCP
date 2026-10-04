import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GatewayConfig } from './types.js';

const mocks = vi.hoisted(() => ({ clients: [] as any[], transports: [] as any[], connect: vi.fn(), call: vi.fn(), close: vi.fn(), transportClose: vi.fn() }));
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => {
    const client: any = { connect: (...args: unknown[]) => mocks.connect(...args), callTool: (...args: unknown[]) => mocks.call(...args), close: () => mocks.close(), onclose: undefined, onerror: undefined };
    mocks.clients.push(client);
    return client;
  }),
}));
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation((options) => {
    const transport = { options, close: () => mocks.transportClose() };
    mocks.transports.push(transport);
    return transport;
  }),
}));
import { ProcessPool } from './process-pool.js';
const deferred = <T = void>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const config = (settings: Partial<GatewayConfig['gateway']> = {}): GatewayConfig => ({
  gateway: { idle_timeout_ms: 0, startup_timeout_ms: 100, max_retries: 0, log_level: 'error', ...settings },
  mcpServers: { a: { command: 'node', args: ['a.mjs'] }, b: { command: 'node', args: ['b.mjs'] } },
});
const pools: ProcessPool[] = [];
const poolFor = (settings: Partial<GatewayConfig['gateway']> = {}) => { const pool = new ProcessPool(config(settings)); pools.push(pool); return pool; };
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

beforeEach(() => {
  vi.useFakeTimers();
  mocks.clients.length = 0; mocks.transports.length = 0;
  mocks.connect.mockReset().mockResolvedValue(undefined);
  mocks.call.mockReset().mockResolvedValue({ content: [] });
  mocks.close.mockReset().mockResolvedValue(undefined);
  mocks.transportClose.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => { await Promise.allSettled(pools.splice(0).map((pool) => pool.shutdownAll())); vi.useRealTimers(); });

describe('generation and single-flight lifecycle', () => {
  it('50 callers share the entire retry/backoff flight; startup timers are cleared', async () => {
    mocks.connect.mockRejectedValueOnce(new Error('offline'));
    const pool = poolFor({ max_retries: 1 });
    const first = pool.getClient('a');
    await flush();
    const waiting = Array.from({ length: 49 }, () => pool.getClient('a'));
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const clients = await Promise.all([first, ...waiting]);
    expect(new Set(clients).size).toBe(1);
    expect(mocks.connect).toHaveBeenCalledTimes(2);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.transportClose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop during initialize closes registered resources and cannot resurrect on late success', async () => {
    const connection = deferred();
    mocks.connect.mockReturnValueOnce(connection.promise);
    const pool = poolFor();
    const result = pool.getClient('a').catch((error) => error);
    await flush();
    await pool.stopServer('a');
    expect(await result).toBeInstanceOf(Error);
    connection.resolve();
    await flush();
    expect(pool.getHealthInfo().find((health) => health.serverName === 'a')?.state).toBe('dormant');
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.transportClose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('timeout closes an initializing child; late success does not make it ready', async () => {
    const connection = deferred();
    mocks.connect.mockReturnValueOnce(connection.promise);
    const pool = poolFor();
    const result = pool.getClient('a').catch((error) => error);
    await flush();
    await vi.advanceTimersByTimeAsync(100);
    expect((await result).message).toContain('啟動超時');
    connection.resolve(); await flush();
    expect(pool.getHealthInfo()[0].state).toBe('dormant');
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.transportClose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop cancels backoff without a retry or later resurrection', async () => {
    mocks.connect.mockRejectedValue(new Error('offline'));
    const pool = poolFor({ max_retries: 3 });
    const result = pool.getClient('a').catch((error) => error);
    await flush();
    await pool.stopServer('a');
    await vi.advanceTimersByTimeAsync(20000);
    expect(await result).toBeInstanceOf(Error);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('normal close creates a new client; an old callback cannot kill that generation', async () => {
    const pool = poolFor();
    const old = await pool.getClient('a');
    const closeOld = mocks.clients[0].onclose;
    closeOld(); await flush();
    const current = await pool.getClient('a');
    expect(current).not.toBe(old);
    closeOld(); await flush();
    expect(await pool.getClient('a')).toBe(current);
    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });

  it('shutdown rejects new clients immediately and waits for every deferred close', async () => {
    const pool = poolFor();
    await pool.getClient('a'); await pool.getClient('b');
    const a = deferred(); const b = deferred();
    mocks.close.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    let done = false;
    const shutdown = pool.shutdownAll().then(() => { done = true; });
    await flush();
    await expect(pool.getClient('a')).rejects.toThrow('關閉');
    expect(done).toBe(false);
    a.resolve(); await flush(); expect(done).toBe(false);
    b.resolve(); await shutdown;
    expect(done).toBe(true);
    await pool.shutdownAll();
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });

  it('reconcile removes enabled membership and only restarts changed services', async () => {
    const pool = poolFor();
    await pool.getClient('a'); const b = await pool.getClient('b');
    const next = config(); delete next.mcpServers.a;
    await pool.reconcile(next);
    expect(pool.hasServer('a')).toBe(false);
    await expect(pool.getClient('a')).rejects.toThrow('未知');
    expect(pool.getHealthInfo().map((health) => health.serverName)).toEqual(['b']);
    expect(await pool.getClient('b')).toBe(b);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });
});

describe('tool leases, cancellation and workspace isolation', () => {
  it('a 100ms active request survives a 20ms idle limit and gets a full idle window after completion', async () => {
    const result = deferred<any>(); mocks.call.mockReturnValue(result.promise);
    const pool = poolFor({ idle_timeout_ms: 20 });
    const call = pool.callTool('a', { name: 'write', arguments: {} }, { workspace: '/project-a' });
    await flush();
    await vi.advanceTimersByTimeAsync(100);
    expect(mocks.close).not.toHaveBeenCalled();
    result.resolve({ content: [] }); await call;
    await vi.advanceTimersByTimeAsync(19); expect(mocks.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('upstream abort reaches the SDK request and never retries a possibly applied write', async () => {
    mocks.call.mockReturnValue(new Promise(() => {}));
    const pool = poolFor(); const controller = new AbortController();
    const call = pool.callTool('a', { name: 'write' }, { signal: controller.signal, workspace: '/project-a' }).catch((error) => error);
    await flush();
    const signal = mocks.call.mock.calls[0][2].signal;
    controller.abort(new Error('user cancelled'));
    expect((await call).message).toBe('user cancelled');
    expect(signal.aborted).toBe(true);
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it('a caller abort during shared initialize does not cancel the other caller', async () => {
    const connection = deferred(); mocks.connect.mockReturnValue(connection.promise);
    const pool = poolFor(); const controller = new AbortController();
    const cancelled = pool.getClient('a', { signal: controller.signal }).catch((error) => error);
    const other = pool.getClient('a'); await flush();
    controller.abort(new Error('user cancelled'));
    expect(await cancelled).toBeInstanceOf(Error);
    connection.resolve(); expect(await other).toBe(mocks.clients[0]);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });

  it('aborting the only tool waiter closes its orphan initializing generation', async () => {
    mocks.connect.mockReturnValue(new Promise(() => {}));
    const pool = poolFor(); const controller = new AbortController();
    const call = pool.callTool('a', { name: 'write' }, { workspace: '/project-a', signal: controller.signal }).catch((error) => error);
    await flush(); controller.abort(); await call; await flush();
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.transportClose).toHaveBeenCalledTimes(1);
    expect(mocks.call).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('different workspaces use distinct child cwd while repeated calls reuse their own client', async () => {
    const pool = poolFor();
    await pool.callTool('a', { name: 'cwd' }, { workspace: '/project-a' });
    await pool.callTool('a', { name: 'cwd' }, { workspace: '/project-b' });
    await pool.callTool('a', { name: 'cwd' }, { workspace: '/project-a' });
    expect(mocks.transports.map((transport) => transport.options.cwd)).toEqual(['/project-a', '/project-b']);
    expect(mocks.call).toHaveBeenCalledTimes(3);
    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });

  it('a failed dispatched write is not reconnected or repeated', async () => {
    mocks.call.mockRejectedValue(new Error('Disconnected after dispatch'));
    const pool = poolFor({ max_retries: 3 });
    await expect(pool.callTool('a', { name: 'write' }, { workspace: '/project-a' })).rejects.toThrow('Disconnected');
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });
});
