import { readFileSync } from 'node:fs';

// Replaced at extension bundle time from the root package.json; never from extensionPath.
declare const __MULTI_MCP_CORE_VERSION__: string | undefined;

export function getCoreVersion(): string {
  if (typeof __MULTI_MCP_CORE_VERSION__ !== 'undefined') return __MULTI_MCP_CORE_VERSION__;
  try {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: unknown };
    return typeof manifest.version === 'string' ? manifest.version : 'unknown';
  } catch { return 'unknown'; }
}
