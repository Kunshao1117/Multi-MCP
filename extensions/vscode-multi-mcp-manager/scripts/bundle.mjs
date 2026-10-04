import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const extensionRoot = fileURLToPath(new URL('../', import.meta.url));
const corePackage = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
if (typeof corePackage.version !== 'string' || !corePackage.version) throw new Error('Root package version is required');
await build({
  absWorkingDir: extensionRoot,
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  outfile: 'out/src/extension.cjs',
  sourcemap: true,
  // The webview embeds createFormModel.toString(); keep readable function-local identifiers.
  minify: false,
  define: { __MULTI_MCP_CORE_VERSION__: JSON.stringify(corePackage.version) },
  logOverride: { 'empty-import-meta': 'silent' },
});
