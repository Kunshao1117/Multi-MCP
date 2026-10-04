// A hermetic, dependency-free JSON-RPC peer. The production SDK is the client.
// Every tools/list waits for an explicit file gate, so tests never depend on sleeps
// to produce a race. All files live in a test-created temporary directory.
import { existsSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const state = process.env.REGISTRY_CONCURRENT_STATE;
const worker = process.env.REGISTRY_CONCURRENT_WORKER;
if (!state || !worker || !/^[a-z0-9-]+$/i.test(worker)) throw new Error('Missing fixture context');
const pending = new Set();
let stopped = false;
function mark(name, value) {
  const target = join(state, name);
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value));
  renameSync(temporary, target);
}
mark(`${process.pid}.started`, { pid: process.pid, worker });
function stop() {
  if (stopped) return;
  stopped = true;
  for (const close of pending) close();
  mark(`${process.pid}.closed`, { pid: process.pid });
  process.exit(process.exitCode ?? 0);
}
process.once('SIGTERM', stop);
process.stdin.once('end', stop);
function gate() {
  const path = join(state, `${worker}.gate.json`);
  return new Promise((resolve, reject) => {
    let watcher;
    const close = () => { watcher?.close(); pending.delete(close); };
    const check = () => {
      if (!existsSync(path)) return;
      try { const value = JSON.parse(readFileSync(path, 'utf8')); close(); resolve(value); }
      catch (error) { close(); reject(error); }
    };
    watcher = watch(state, check);
    watcher.once('error', (error) => { close(); reject(error); });
    pending.add(close);
    check();
  });
}
function send(id, result) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`); }
async function dispatch(message) {
  if (message.id === undefined) return;
  if (message.method === 'initialize') {
    send(message.id, { protocolVersion: message.params.protocolVersion,
      capabilities: { tools: {} }, serverInfo: { name: 'registry-concurrency-fixture', version: '1.0.0' } });
    return;
  }
  if (message.method === 'ping') { send(message.id, {}); return; }
  if (message.method !== 'tools/list') throw new Error('Unexpected method');
  const page = Number(message.params?.cursor ?? 0);
  mark(`${worker}.ready.json`, { pid: process.pid, worker, page });
  const reply = await gate();
  if (reply.fail) {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id,
      error: { code: -32603, message: 'Controlled discovery failure' } })}\n`);
    return;
  }
  const pages = reply.pages ?? [reply.tools ?? []];
  send(message.id, { tools: (pages[page] ?? []).map((name) => ({ name,
    description: `Controlled ${name}`, inputSchema: { type: 'object', properties: {} } })),
    ...(page + 1 < pages.length ? { nextCursor: String(page + 1) } : {}) });
}
const input = createInterface({ input: process.stdin });
input.on('line', (line) => {
  try { void dispatch(JSON.parse(line)).catch(() => { process.exitCode = 1; stop(); }); }
  catch { process.exitCode = 1; stop(); }
});
