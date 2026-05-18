import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureUserDataDir, getGatewayPaths, getUserDataDir } from './paths.js';

describe('getUserDataDir', () => {
  it('MULTI_MCP_HOME 優先於平台預設路徑', () => {
    expect(getUserDataDir({ MULTI_MCP_HOME: 'D:/custom-mcp-home' }, 'win32'))
      .toMatch(/custom-mcp-home$/);
  });

  it('Windows 使用 APPDATA 底下的 multi-mcp-gateway', () => {
    expect(getUserDataDir({ APPDATA: 'C:/Users/test/AppData/Roaming' }, 'win32'))
      .toBe('C:\\Users\\test\\AppData\\Roaming\\multi-mcp-gateway');
  });

  it('Linux 使用 XDG_CONFIG_HOME 底下的 multi-mcp-gateway', () => {
    expect(getUserDataDir({ XDG_CONFIG_HOME: '/home/test/.config' }, 'linux'))
      .toMatch(/[\\/]home[\\/]test[\\/]\.config[\\/]multi-mcp-gateway$/);
  });
});

describe('getGatewayPaths', () => {
  it('集中產生使用者資料路徑', () => {
    const paths = getGatewayPaths('D:/mcp-home');
    expect(paths.dataDir).toMatch(/D:[\\/]mcp-home$/);
    expect(paths.configPath).toMatch(/D:[\\/]mcp-home[\\/]gateway\.config\.json$/);
    expect(paths.envPath).toMatch(/D:[\\/]mcp-home[\\/]gateway\.env$/);
    expect(paths.credentialsPath).toMatch(/D:[\\/]mcp-home[\\/]credentials\.json$/);
    expect(paths.registryPath).toMatch(/D:[\\/]mcp-home[\\/]registry\.json$/);
    expect(paths.mcpsDir).toMatch(/D:[\\/]mcp-home[\\/]mcps$/);
    expect(paths.catalogPath).toMatch(/mcp-catalog\.json$/);
    expect(paths.defaultMcpSeedPath).toMatch(/D:[\\/]mcp-home[\\/]default-mcps\.seed\.json$/);
  });
});

describe('ensureUserDataDir default MCP seed', () => {
  it('fresh user-data 會建立預設 MCP 設定與 seed 狀態檔', () => {
    withTempDir((dir) => {
      const paths = ensureUserDataDir(getGatewayPaths(dir));
      const cartridgePath = resolve(paths.mcpsDir, '記憶管理', 'cartridge-system.json');
      const gitnexusPath = resolve(paths.mcpsDir, '開發工具', 'gitnexus.json');

      expect(existsSync(paths.defaultMcpSeedPath)).toBe(true);
      expect(JSON.parse(readFileSync(cartridgePath, 'utf-8'))).toEqual({
        command: 'npx',
        args: ['-y', '--package', 'cartridge-system@latest', '--', 'cartridge-system'],
      });
      expect(JSON.parse(readFileSync(gitnexusPath, 'utf-8'))).toEqual({
        command: 'npx',
        args: ['-y', '--package', 'gitnexus@1.6.5', '--', 'gitnexus', 'mcp'],
      });
    });
  });

  it('同名 MCP 已存在時不覆蓋使用者設定', () => {
    withTempDir((dir) => {
      const paths = getGatewayPaths(dir);
      const categoryDir = resolve(paths.mcpsDir, '自訂');
      const customPath = resolve(categoryDir, 'cartridge-system.json');
      mkdirSync(categoryDir, { recursive: true });
      writeFileSync(customPath, '{"command":"custom","args":[]}\n', 'utf-8');

      ensureUserDataDir(paths);

      expect(JSON.parse(readFileSync(customPath, 'utf-8'))).toEqual({
        command: 'custom',
        args: [],
      });
      expect(existsSync(resolve(paths.mcpsDir, '記憶管理', 'cartridge-system.json'))).toBe(false);
    });
  });

  it('seed 狀態檔存在時不重建已刪除的預設 MCP', () => {
    withTempDir((dir) => {
      const paths = ensureUserDataDir(getGatewayPaths(dir));
      const cartridgePath = resolve(paths.mcpsDir, '記憶管理', 'cartridge-system.json');
      unlinkSync(cartridgePath);

      ensureUserDataDir(paths);

      expect(existsSync(cartridgePath)).toBe(false);
    });
  });

  it('MULTI_MCP_HOME 指向的資料夾也會取得 seed 狀態檔路徑', () => {
    withTempDir((dir) => {
      const dataDir = getUserDataDir({ MULTI_MCP_HOME: dir }, process.platform);
      const paths = ensureUserDataDir(getGatewayPaths(dataDir));

      expect(paths.defaultMcpSeedPath).toBe(resolve(dir, 'default-mcps.seed.json'));
      expect(existsSync(paths.defaultMcpSeedPath)).toBe(true);
    });
  });
});

function withTempDir(run: (dir: string) => void): void {
  const dir = resolve(tmpdir(), `multi-mcp-paths-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
