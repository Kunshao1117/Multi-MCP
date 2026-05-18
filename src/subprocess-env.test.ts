import { describe, expect, it } from 'vitest';
import { createDownstreamEnv } from './subprocess-env.js';

describe('createDownstreamEnv', () => {
  it('移除外層 npm lifecycle 變數但保留一般環境變數', () => {
    const env = createDownstreamEnv({}, {
      PATH: 'C:/bin',
      CUSTOM_TOKEN: 'secret',
      npm_config_script_shell: 'C:/Windows/System32/cmd.exe',
      npm_execpath: 'C:/npm-cli.js',
      npm_lifecycle_event: 'start',
      npm_package_name: 'multi-mcp-gateway',
    }, 'linux');

    expect(env.PATH).toBe('C:/bin');
    expect(env.CUSTOM_TOKEN).toBe('secret');
    expect(env.npm_config_script_shell).toBeUndefined();
    expect(env.npm_execpath).toBeUndefined();
    expect(env.npm_lifecycle_event).toBeUndefined();
    expect(env.npm_package_name).toBeUndefined();
  });

  it('Windows 子程序強制使用 cmd.exe COMSPEC 並移除 SHELL', () => {
    const env = createDownstreamEnv({}, {
      SystemRoot: 'C:\\Windows',
      SHELL: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    }, 'win32');

    expect(env.COMSPEC).toBe('C:\\Windows\\System32\\cmd.exe');
    expect(env.SHELL).toBeUndefined();
  });

  it('額外環境變數可覆寫清理後的基礎環境', () => {
    const env = createDownstreamEnv({ TOKEN: 'override' }, { TOKEN: 'base' }, 'linux');

    expect(env.TOKEN).toBe('override');
  });
});
