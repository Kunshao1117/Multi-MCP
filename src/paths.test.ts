import { describe, expect, it } from 'vitest';
import { getGatewayPaths, getUserDataDir } from './paths.js';

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
  });
});
