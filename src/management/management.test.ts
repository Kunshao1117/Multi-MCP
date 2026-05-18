import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGatewayPaths } from '../paths.js';
import {
  deleteCredential,
  getGatewayStatus,
  installMcp,
  listCatalogEntries,
  listMcpServers,
  removeMcp,
  setMcpEnabled,
  switchCredential,
  upsertCredential,
} from './index.js';

describe('management API', () => {
  it('讀取狀態時不初始化使用者資料夾', async () => {
    await withTempDir((dir) => {
      const status = getGatewayStatus({ dataDir: dir });

      expect(status.initialized).toBe(false);
      expect(status.totalServers).toBe(0);
      expect(existsSync(resolve(dir, 'gateway.config.json'))).toBe(false);
    });
  });

  it('安裝、停用、啟用與移除 MCP 設定', async () => {
    await withTempDir(async (dir) => {
      const options = { dataDir: dir };
      const install = await installMcp({
        name: 'demo',
        category: '測試工具',
        source: '@example/demo-mcp',
      }, options);

      expect(install.ok).toBe(true);
      const demo = listMcpServers(options).find((server) => server.name === 'demo');
      expect(demo).toMatchObject({
        name: 'demo',
        enabled: true,
        packageName: '@example/demo-mcp',
      });

      expect(setMcpEnabled('demo', false, options).changed).toBe(true);
      expect(listMcpServers(options).find((server) => server.name === 'demo')?.enabled).toBe(false);

      expect(setMcpEnabled('demo', true, options).changed).toBe(true);
      expect(await removeMcp('demo', options)).toMatchObject({ ok: true, changed: true });
      expect(listMcpServers(options).some((server) => server.name === 'demo')).toBe(false);
    });
  });

  it('認證管理會同步 credentials.json 與 gateway.env', async () => {
    await withTempDir(async (dir) => {
      const options = { dataDir: dir };
      await installMcp({ name: 'secure-mcp', category: '安全', source: 'secure-mcp' }, options);

      expect(upsertCredential({
        mcpName: 'secure-mcp',
        label: 'default',
        value: '1234567890abcdef',
        envVar: 'SECURE_TOKEN',
      }, options).ok).toBe(true);

      expect(upsertCredential({
        mcpName: 'secure-mcp',
        label: 'work',
        value: 'fedcba0987654321',
        envVar: 'SECURE_TOKEN',
      }, options).ok).toBe(true);
      expect(switchCredential('secure-mcp', 'work', options).ok).toBe(true);

      const paths = getGatewayPaths(dir);
      const env = readFileSync(paths.envPath, 'utf-8');
      const creds = JSON.parse(readFileSync(paths.credentialsPath, 'utf-8')) as Record<string, unknown>;
      expect(env).toContain('SECURE_TOKEN=fedcba0987654321');
      expect(creds).toHaveProperty('secure-mcp');
      const secure = listMcpServers(options).find((server) => server.name === 'secure-mcp');
      expect(secure?.credential?.maskedValue).toBe('fedc...4321');

      expect(deleteCredential('secure-mcp', undefined, options).ok).toBe(true);
      expect(readFileSync(paths.envPath, 'utf-8')).not.toContain('SECURE_TOKEN=');
    });
  });

  it('可讀取內建 catalog', () => {
    const entries = listCatalogEntries();
    expect(entries.some((entry) => entry.name === 'cartridge-system')).toBe(true);
  });
});

async function withTempDir(run: (dir: string) => void | Promise<void>): Promise<void> {
  const dir = resolve(tmpdir(), `multi-mcp-management-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    await run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
