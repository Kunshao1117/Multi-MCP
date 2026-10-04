/**
 * One close flight, including closes started internally by MCP Client.connect().
 * SDK 1.29 clears its process reference before awaiting exit and does not await
 * the final SIGKILL close event. Never infer OS cleanup from a second close().
 */
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface ManagedTransportClose {
  /** Closes both protocol client and transport; waits for their original close flights. */
  close(): Promise<void>;
  /** Must be the FIRST statement of client.onclose, before any generation checks. */
  onClientClose(): void;
}

export function manageTransportClose(
  client: Pick<Client, 'close'>,
  transport: Pick<StdioClientTransport, 'close' | 'pid'>,
  options: { timeoutMs?: number } = {},
): ManagedTransportClose {
  const timeoutMs = options.timeoutMs ?? 5000;
  const originalTransportClose = transport.close.bind(transport);
  const originalClientClose = client.close.bind(client);
  let transportClose: Promise<void> | undefined;
  let clientClose: Promise<void> | undefined;
  let cleanup: Promise<void> | undefined;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });

  transport.close = () => {
    if (!transportClose) {
      // Capture synchronously BEFORE the SDK clears its _process reference.
      const pid = transport.pid;
      const hadChild = typeof pid === 'number' && pid > 0;
      transportClose = Promise.resolve().then(async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('MCP transport cleanup timed out; child closure is unconfirmed')), timeoutMs);
        });
        try {
          await Promise.race([
            Promise.all([originalTransportClose(), ...(hadChild ? [closed] : [])]),
            deadline,
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      });
      // An SDK-owned fire-and-forget close is observed again by close() below.
      void transportClose.catch(() => {});
    }
    return transportClose;
  };

  client.close = () => {
    if (!clientClose) {
      clientClose = Promise.resolve().then(() => originalClientClose());
      // Client.connect uses `void this.close()` on failure. Keep that same promise
      // handled while still propagating its rejection to explicit cleanup callers.
      void clientClose.catch(() => {});
    }
    return clientClose;
  };

  return {
    onClientClose: () => resolveClosed(),
    close: () => {
      if (!cleanup) {
        cleanup = Promise.resolve().then(async () => {
          const results = await Promise.allSettled([client.close(), transport.close()]);
          const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
          if (failures.length) throw new AggregateError(failures.map((result) => result.reason), 'MCP 資源清理失敗，子程序關閉未確認');
        });
        void cleanup.catch(() => {});
      }
      return cleanup;
    },
  };
}
