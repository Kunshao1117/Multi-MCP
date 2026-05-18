import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveGatewayPaths } from './files.js';
import type { CatalogEntry, ManagementOptions } from './types.js';

interface CatalogFile {
  categories?: Record<string, Array<Omit<CatalogEntry, 'category'>>>;
}

export function listCatalogEntries(options: ManagementOptions = {}): CatalogEntry[] {
  const paths = resolveGatewayPaths(options);
  const catalogPath = existsSync(paths.catalogPath) ? paths.catalogPath : resolve('mcp-catalog.json');
  if (!existsSync(catalogPath)) return [];
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8')) as CatalogFile;
  const entries: CatalogEntry[] = [];
  for (const [category, categoryEntries] of Object.entries(catalog.categories ?? {})) {
    for (const entry of categoryEntries) entries.push({ ...entry, category });
  }
  return entries;
}
