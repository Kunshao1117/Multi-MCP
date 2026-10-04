// An independent Node process importing the actual registry implementation via
// --import tsx. No SDK mocks: scans use the installed SDK and real OS children.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';
import { loadConfig } from '../../src/config-loader.ts';
import { scanAndGenerateRegistry, pruneRegistry } from '../../src/registry.ts';

const [configPath, registryPath, worker] = process.argv.slice(2);
const initialEnv = { ...process.env, REGISTRY_CONCURRENT_WORKER: worker };
let config = loadConfig(configPath, initialEnv);
let operation;
let controller;
const send = (value) => new Promise((done) => process.send(value, done));
async function run(message) {
  if (message.action === 'stop') { process.disconnect(); return; }
  if (message.action === 'abort') { controller?.abort(); return; }
  if (operation) throw new Error('Only one operation per fixture worker is allowed');
  const originalRename = fs.renameSync;
  const originalRead = fs.readFileSync;
  controller = new AbortController();
  operation = message.id;
  let outcome;
  try {
    if (message.reload) config = loadConfig(configPath, initialEnv);
    if (message.failRename) {
      let injected = false;
      fs.renameSync = (from, to) => {
        if (!injected && resolve(String(to)) === resolve(registryPath)) {
          injected = true; // Fail only the publication rename, never a possible rollback.
          throw Object.assign(new Error('Controlled publication IO failure'), { code: message.ioCode ?? 'EIO' });
        }
        return originalRename(from, to);
      };
    }
    if (message.failRead) {
      fs.readFileSync = (path, ...args) => {
        if (typeof path === 'string' && resolve(path) === resolve(registryPath)) {
          throw Object.assign(new Error('Controlled registry read IO failure'), { code: message.ioCode ?? 'EIO' });
        }
        return originalRead(path, ...args);
      };
    }
    syncBuiltinESMExports();
    const registry = message.action === 'prune'
      ? pruneRegistry(config, registryPath)
      : await scanAndGenerateRegistry(config, registryPath, { signal: controller.signal });
    outcome = { type: 'result', id: message.id, ok: true, registry, pid: process.pid };
  } catch (error) {
    outcome = { type: 'result', id: message.id, ok: false,
      error: error instanceof Error ? error.message : String(error), pid: process.pid };
  } finally {
    fs.renameSync = originalRename;
    fs.readFileSync = originalRead;
    syncBuiltinESMExports();
    operation = undefined;
    controller = undefined;
  }
  await send(outcome);
}
process.on('message', (message) => { void run(message).catch((error) => {
  console.error(error); process.exitCode = 1; process.disconnect();
}); });
await send({ type: 'ready', pid: process.pid });
