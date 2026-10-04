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

  if (!existsSync(srcDir)) return; // Published npm artifacts intentionally omit sources.
  const stack = [srcDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const source = path.join(current, entry.name);
      if (entry.isDirectory()) { stack.push(source); continue; }
      if (!entry.isFile() || !source.endsWith('.ts') || source.endsWith('.d.ts') || TEST_FILE_RE.test(source)) continue;
      const output = path.join(distDir, path.relative(srcDir, source).replace(/\.ts$/, '.js'));
      const src = { path: source, mtimeMs: statSync(source).mtimeMs };
      const dist = existsSync(output) ? { path: output, mtimeMs: statSync(output).mtimeMs } : null;
      if (!dist || src.mtimeMs > dist.mtimeMs) throw new Error(formatStaleDistError(projectRoot, src, dist));
    }
  }
}

function isDistRuntime(entryFile: string, distDir: string): boolean {
  const relative = path.relative(distDir, entryFile);
  return relative === 'index.js';
}

function formatStaleDistError(
  projectRoot: string,
  latestSrc: LatestFile,
  latestDist: LatestFile | null,
): string {
  const distLine = latestDist
    ? `Corresponding dist file: ${path.relative(projectRoot, latestDist.path)}`
    : 'Corresponding dist file: <none>';

  return [
    'dist is stale: Gateway was started from dist/index.js, but src contains newer runtime files.',
    `Source file: ${path.relative(projectRoot, latestSrc.path)}`,
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
