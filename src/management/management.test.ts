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
  updateMcp,
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

  it('編輯 MCP 會搬移設定檔並同步認證 key', async () => {
    await withTempDir(async (dir) => {
      const options = { dataDir: dir };
      await installMcp({ name: 'old-name', category: '舊分類', source: 'old-mcp' }, options);
      upsertCredential({
        mcpName: 'old-name',
        label: 'default',
        value: '1234567890abcdef',
        envVar: 'OLD_TOKEN',
      }, options);

      const result = await updateMcp({
        currentName: 'old-name',
        nextName: 'new-name',
        category: '新分類',
        config: { command: 'npx', args: ['-y', 'new-mcp@latest'] },
      }, options);

      expect(result).toMatchObject({ ok: true, changed: true });
      const paths = getGatewayPaths(dir);
      expect(existsSync(resolve(paths.mcpsDir, '舊分類', 'old-name.json'))).toBe(false);
      expect(existsSync(resolve(paths.mcpsDir, '新分類', 'new-name.json'))).toBe(true);
      const servers = listMcpServers(options);
      expect(servers.some((server) => server.name === 'old-name')).toBe(false);
      expect(servers.find((server) => server.name === 'new-name')).toMatchObject({
        category: '新分類',
        packageName: 'new-mcp',
      });

      const creds = JSON.parse(readFileSync(paths.credentialsPath, 'utf-8')) as Record<string, unknown>;
      expect(creds).not.toHaveProperty('old-name');
      expect(creds).toHaveProperty('new-name');
      expect(readFileSync(paths.envPath, 'utf-8')).toContain('# --- new-name (default) ---');
    });
  });

  it('編輯 MCP 遇到目標名稱衝突時會拒絕', async () => {
    await withTempDir(async (dir) => {
      const options = { dataDir: dir };
      await installMcp({ name: 'first', category: '工具', source: 'first-mcp' }, options);
      await installMcp({ name: 'second', category: '工具', source: 'second-mcp' }, options);

      const result = await updateMcp({
        currentName: 'first',
        nextName: 'second',
        category: '工具',
        config: { command: 'npx', args: ['-y', 'first-mcp@latest'] },
      }, options);

      expect(result.ok).toBe(false);
      expect(result.message).toContain('已存在');
    });
  });

  it('編輯 MCP 遇到孤兒認證 key 衝突時不會先搬移設定檔', async () => {
    await withTempDir(async (dir) => {
      const options = { dataDir: dir };
      await installMcp({ name: 'first', category: '工具', source: 'first-mcp' }, options);
      upsertCredential({
        mcpName: 'orphan',
        label: 'default',
        value: '1234567890abcdef',
        envVar: 'ORPHAN_TOKEN',
      }, options);

      const result = await updateMcp({
        currentName: 'first',
        nextName: 'orphan',
        category: '新分類',
        config: { command: 'npx', args: ['-y', 'first-mcp@latest'] },
      }, options);

      expect(result.ok).toBe(false);
      expect(result.message).toContain('認證已存在');
      const paths = getGatewayPaths(dir);
      expect(existsSync(resolve(paths.mcpsDir, '工具', 'first.json'))).toBe(true);
      expect(existsSync(resolve(paths.mcpsDir, '新分類', 'orphan.json'))).toBe(false);
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
