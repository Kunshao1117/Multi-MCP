// Hermetic MCP fixture. Its only writes are inside the test's dedicated temporary directory.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
const state = process.env.FIXTURE_STATE_DIR;
if (state) {
  mkdirSync(state, { recursive: true });
  writeFileSync(join(state, `${process.pid}.started`), JSON.stringify({ pid: process.pid, cwd: process.cwd() }));
}
let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  setTimeout(() => {
    if (state) writeFileSync(join(state, `${process.pid}.closed`), 'closed');
    process.exit(0);
  }, 25);
};
process.stdin.once('end', shutdown);
process.once('SIGTERM', shutdown);
if (process.env.FIXTURE_SILENT === '1') {
  process.stdin.resume();
} else {
  const server = new Server({ name: 'hermetic-runtime-fixture', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [
    { name: 'inspect', inputSchema: { type: 'object' } },
    { name: 'wait', inputSchema: { type: 'object' } },
    { name: 'protected', inputSchema: { type: 'object' } },
  ] }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    if (request.params.name === 'protected') throw new McpError(-32001, 'Unauthorized', { status: 401 });
    if (request.params.name === 'wait') {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, Number(request.params.arguments?.milliseconds ?? 100));
        extra.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          if (state) writeFileSync(join(state, `${process.pid}.aborted`), 'aborted');
          resolve();
        }, { once: true });
      });
    }
    return { content: [{ type: 'text', text: JSON.stringify({ pid: process.pid, cwd: process.cwd(), token: process.env.FIXTURE_TOKEN ?? null }) }] };
  });
  await server.connect(new StdioServerTransport());
}
