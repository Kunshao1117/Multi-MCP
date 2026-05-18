import { listMcpServers } from './servers.js';
import type { ManagementOptions, VersionCheckResult } from './types.js';

export async function checkVersions(options: ManagementOptions = {}): Promise<VersionCheckResult[]> {
  const results: VersionCheckResult[] = [];
  for (const server of listMcpServers(options)) {
    if (!server.enabled) {
      results.push({ name: server.name, enabled: false, packageName: server.packageName, status: 'skip', error: 'disabled' });
      continue;
    }
    if (!server.packageName) {
      results.push({ name: server.name, enabled: true, status: 'skip', error: 'not npm based' });
      continue;
    }
    try {
      const latestVersion = await fetchLatestVersion(server.packageName);
      results.push({ name: server.name, enabled: true, packageName: server.packageName, latestVersion, status: 'latest' });
    } catch (error) {
      results.push({
        name: server.name,
        enabled: true,
        packageName: server.packageName,
        status: 'error',
        error: (error as Error).message,
      });
    }
  }
  return results;
}

async function fetchLatestVersion(packageName: string): Promise<string> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json() as { version?: string };
  if (!data.version) throw new Error('missing version');
  return data.version;
}
