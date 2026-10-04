import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ensureUserDataDir, getGatewayPaths } from './paths.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, existsSync: vi.fn(actual.existsSync), writeFileSync: vi.fn(actual.writeFileSync) };
});
let actual: typeof import('node:fs');
const roots: string[] = [];
beforeEach(async () => {
  actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  vi.mocked(fs.existsSync).mockReset().mockImplementation(actual.existsSync);
  vi.mocked(fs.writeFileSync).mockReset().mockImplementation(actual.writeFileSync);
});
afterEach(() => { for (const root of roots.splice(0)) actual.rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = actual.mkdtempSync(resolve(tmpdir(), 'multi-mcp-registry-init-')); roots.push(root);
  const paths = ensureUserDataDir(getGatewayPaths(root));
  actual.unlinkSync(paths.registryPath);
  return paths;
}
it('never overwrites a scanner publication between the existence check and initial creation', () => {
  const paths = fixture();
  const published = JSON.stringify({ version: '1', generated_at: '', revision: 'concurrent-writer', servers: {}, all_tools: { preserve: 'server' } });
  let raced = false;
  vi.mocked(fs.existsSync).mockImplementation((path) => {
    if (path === paths.registryPath && !raced) {
      raced = true;
      // Deterministic schedule: the other process wins immediately after the missing-file check.
      actual.writeFileSync(paths.registryPath, published);
      return false;
    }
    return actual.existsSync(path);
  });
  ensureUserDataDir(paths);
  expect(raced).toBe(true);
  expect(actual.readFileSync(paths.registryPath, 'utf8')).toBe(published);
});
it('propagates registry creation permission errors instead of swallowing them as a race', () => {
  const paths = fixture();
  vi.mocked(fs.writeFileSync).mockImplementation((file, data, options) => {
    if (file === paths.registryPath) throw Object.assign(new Error('permission denied fixture'), { code: 'EACCES' });
    return actual.writeFileSync(file, data, options);
  });
  expect(() => ensureUserDataDir(paths)).toThrow(/permission denied/);
  expect(actual.existsSync(paths.registryPath)).toBe(false);
});
