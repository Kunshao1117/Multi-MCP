import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { resolveSessionPaths } from './session-paths.js';

describe('explicit configuration session', () => {
  it('retains equals characters and resolves before changing directory', () => {
    const startup = resolve('startup');
    const paths = resolveSessionPaths(['--config=profiles/a=b/custom.json'], startup);
    expect(paths.configPath).toBe(resolve(startup, 'profiles/a=b/custom.json'));
    expect(paths.registryPath).toBe(resolve(startup, 'profiles/a=b/registry.json'));
    expect(paths.dataDir).toBe(resolve(startup, 'profiles/a=b'));
  });
  it('rejects an empty explicit source instead of using the default', () => {
    expect(() => resolveSessionPaths(['--config='], process.cwd())).toThrow(/requires/);
  });
});
