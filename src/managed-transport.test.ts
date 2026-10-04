import { afterEach, describe, expect, it, vi } from 'vitest';
import { manageTransportClose } from './managed-transport.js';
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => { resolve = yes; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
afterEach(() => vi.useRealTimers());

describe('SDK-initiated close ownership', () => {
  it('waits for the first SDK fire-and-forget close after pid has already been cleared', async () => {
    const original = deferred();
    const transport = { pid: 123 as number | null, close: async () => {} };
    const rawClose = vi.fn(async () => { transport.pid = null; await original.promise; managed.onClientClose(); });
    transport.close = rawClose;
    const client = { close: async () => { await transport.close(); } };
    const managed = manageTransportClose(client, transport);
    // SDK Client.connect's catch path invokes this without awaiting it.
    void client.close(); await flush();
    expect(transport.pid).toBeNull();
    let done = false;
    const cleanup = managed.close().then(() => { done = true; });
    await flush(); expect(done).toBe(false); expect(rawClose).toHaveBeenCalledTimes(1);
    original.resolve(); await cleanup;
    expect(done).toBe(true); expect(rawClose).toHaveBeenCalledTimes(1);
    expect(transport.close()).toBe(transport.close());
    expect(client.close()).toBe(client.close());
  });

  it('does not equate transport.close return after SIGKILL with the child close event', async () => {
    const transport = { pid: 123 as number | null, close: async () => { transport.pid = null; } };
    const client = { close: async () => { await transport.close(); } };
    const managed = manageTransportClose(client, transport);
    let done = false;
    const cleanup = managed.close().then(() => { done = true; });
    await flush(); expect(transport.pid).toBeNull(); expect(done).toBe(false);
    managed.onClientClose(); await cleanup; expect(done).toBe(true);
  });

  it('surfaces bounded cleanup failure if a spawned child never reports closed', async () => {
    vi.useFakeTimers();
    const transport = { pid: 123 as number | null, close: async () => { transport.pid = null; } };
    const client = { close: async () => { await transport.close(); } };
    const managed = manageTransportClose(client, transport, { timeoutMs: 30 });
    void client.close(); // This SDK-owned promise must have a rejection observer.
    const cleanup = managed.close();
    const failure = expect(cleanup).rejects.toThrow('子程序關閉未確認');
    await flush(); await vi.advanceTimersByTimeAsync(30); await failure;
    expect(vi.getTimerCount()).toBe(0);
    managed.onClientClose();
    expect(managed.close()).toBe(cleanup);
    await expect(cleanup).rejects.toThrow();
  });

  it('does not wait for an impossible close event when spawning never produced a pid', async () => {
    const rawClose = vi.fn(async () => {});
    const transport = { pid: null, close: rawClose };
    const client = { close: async () => { await transport.close(); } };
    await manageTransportClose(client, transport).close();
    expect(rawClose).toHaveBeenCalledTimes(1);
  });
});
