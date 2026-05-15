/**
 * Runtime freshness guard for compiled Gateway entrypoints.
 *
 * Codex/Gemini run the Gateway through dist/index.js. If src changes without
 * rebuilding dist, the MCP runtime exposes stale tool metadata. This guard
 * fails fast instead of silently serving an old build.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export interface RuntimeFreshnessOptions {
  entryFile: string;
  projectRoot: string;
}

interface LatestFile {
  path: string;
  mtimeMs: number;
}

const TEST_FILE_RE = /\.test\.[cm]?[tj]s$/i;

export function assertDistFresh(options: RuntimeFreshnessOptions): void {
  const projectRoot = path.resolve(options.projectRoot);
  const entryFile = path.resolve(options.entryFile);
  const distDir = path.resolve(projectRoot, 'dist');
  const srcDir = path.resolve(projectRoot, 'src');

  if (!isDistRuntime(entryFile, distDir)) return;

  const latestSrc = findLatestFile(srcDir, (file) =>
    file.endsWith('.ts') && !file.endsWith('.d.ts') && !TEST_FILE_RE.test(file),
  );
  if (!latestSrc) return;

  const latestDist = findLatestFile(distDir, (file) =>
    file.endsWith('.js') && !TEST_FILE_RE.test(file),
  );

  if (!latestDist || latestSrc.mtimeMs > latestDist.mtimeMs) {
    throw new Error(formatStaleDistError(projectRoot, latestSrc, latestDist));
  }
}

function isDistRuntime(entryFile: string, distDir: string): boolean {
  const relative = path.relative(distDir, entryFile);
  return relative === 'index.js';
}

function findLatestFile(
  root: string,
  include: (filePath: string) => boolean,
): LatestFile | null {
  if (!existsSync(root)) return null;

  let latest: LatestFile | null = null;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile() || !include(fullPath)) continue;
      const mtimeMs = statSync(fullPath).mtimeMs;
      if (!latest || mtimeMs > latest.mtimeMs) {
        latest = { path: fullPath, mtimeMs };
      }
    }
  }
  return latest;
}

function formatStaleDistError(
  projectRoot: string,
  latestSrc: LatestFile,
  latestDist: LatestFile | null,
): string {
  const distLine = latestDist
    ? `Latest dist file: ${path.relative(projectRoot, latestDist.path)}`
    : 'Latest dist file: <none>';

  return [
    'dist is stale: Gateway was started from dist/index.js, but src contains newer runtime files.',
    `Latest src file: ${path.relative(projectRoot, latestSrc.path)}`,
    distLine,
    '',
    'Build before starting Gateway:',
    '  npx tsc',
    '',
    'If using npm on Windows fails, ensure:',
    '  ComSpec=C:\\Windows\\System32\\cmd.exe',
    '',
    'After building, restart the Codex/Gemini MCP connection.',
  ].join('\n');
}
