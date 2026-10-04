import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertDistFresh } from './runtime-guard.js';

const tempRoots: string[] = [];

function createProject(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'gateway-runtime-'));
  tempRoots.push(root);
  mkdirSync(path.join(root, 'src'), { recursive: true });
  mkdirSync(path.join(root, 'dist'), { recursive: true });
  return root;
}

function writeWithMtime(filePath: string, mtimeMs: number): void {
  writeFileSync(filePath, '// test\n');
  const date = new Date(mtimeMs);
  utimesSync(filePath, date, date);
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('assertDistFresh', () => {
  it('阻擋 dist/index.js 啟動過期 runtime', () => {
    const root = createProject();
    writeWithMtime(path.join(root, 'src', 'index.ts'), 2_000);
    writeWithMtime(path.join(root, 'dist', 'index.js'), 1_000);

    expect(() => assertDistFresh({
      entryFile: path.join(root, 'dist', 'index.js'),
      projectRoot: root,
    })).toThrow(/dist is stale/);
  });

  it('dist 與 src 同步時允許啟動', () => {
    const root = createProject();
    writeWithMtime(path.join(root, 'src', 'index.ts'), 1_000);
    writeWithMtime(path.join(root, 'dist', 'index.js'), 2_000);

    expect(() => assertDistFresh({
      entryFile: path.join(root, 'dist', 'index.js'),
      projectRoot: root,
    })).not.toThrow();
  });

  it('tsx src/index.ts 開發模式不阻擋', () => {
    const root = createProject();
    writeWithMtime(path.join(root, 'src', 'index.ts'), 2_000);
    writeWithMtime(path.join(root, 'dist', 'index.js'), 1_000);

    expect(() => assertDistFresh({
      entryFile: path.join(root, 'src', 'index.ts'),
      projectRoot: root,
    })).not.toThrow();
  });

  it('只改測試檔不阻擋 dist runtime', () => {
    const root = createProject();
    writeWithMtime(path.join(root, 'src', 'index.ts'), 1_000);
    writeWithMtime(path.join(root, 'src', 'runtime-guard.test.ts'), 3_000);
    writeWithMtime(path.join(root, 'dist', 'index.js'), 2_000);

    expect(() => assertDistFresh({
      entryFile: path.join(root, 'dist', 'index.js'),
      projectRoot: root,
    })).not.toThrow();
  });
});

describe('per-module freshness regression', () => {
  it('does not allow a newer unrelated output to hide a stale entry', () => {
    const root = createProject();
    writeWithMtime(path.join(root, 'src/index.ts'), 2000);
    writeWithMtime(path.join(root, 'dist/index.js'), 1000);
    writeWithMtime(path.join(root, 'dist/unrelated.js'), 9000);
    expect(() => assertDistFresh({ entryFile: path.join(root, 'dist/index.js'), projectRoot: root })).toThrow(/dist is stale/);
  });
  it('rejects an outdated or missing imported module despite a fresh entry', () => {
    const root = createProject();
    writeWithMtime(path.join(root, 'src/index.ts'), 1000);
    writeWithMtime(path.join(root, 'dist/index.js'), 9000);
    writeWithMtime(path.join(root, 'src/dependency.ts'), 2000);
    expect(() => assertDistFresh({ entryFile: path.join(root, 'dist/index.js'), projectRoot: root })).toThrow(/dependency/);
    writeWithMtime(path.join(root, 'dist/dependency.js'), 1000);
    expect(() => assertDistFresh({ entryFile: path.join(root, 'dist/index.js'), projectRoot: root })).toThrow(/dependency/);
    writeWithMtime(path.join(root, 'dist/dependency.js'), 3000);
    expect(() => assertDistFresh({ entryFile: path.join(root, 'dist/index.js'), projectRoot: root })).not.toThrow();
  });
});
