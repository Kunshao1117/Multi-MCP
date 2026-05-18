/**
 * Multi-MCP Gateway — 設定載入器單元測試
 * 測試設定檔驗證、環境變數解析、MCP 目錄掃描
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 用 vi.hoisted 宣告 mock 函式（確保 vi.mock 工廠可引用）
const { mockReadFileSync, mockExistsSync, mockReaddirSync, mockStatSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockExistsSync: vi.fn().mockReturnValue(false),
  mockReaddirSync: vi.fn().mockReturnValue([]),
  mockStatSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
  writeFileSync: vi.fn(),
}));

import { loadConfig } from './config-loader.js';

/** 產生最小合法設定 JSON 字串 */
function validJSON(overrides?: Record<string, unknown>): string {
  const base = {
    gateway: {
      idle_timeout_ms: 300000,
      startup_timeout_ms: 30000,
      max_retries: 3,
      log_level: 'info',
    },
    mcpServers: {
      test: { command: 'node', args: ['test.js'] },
    },
  };
  return JSON.stringify({ ...base, ...overrides });
}

/** 產生帶自訂 gateway 欄位的 JSON */
function gatewayJSON(gw: Record<string, unknown>): string {
  return JSON.stringify({
    gateway: { idle_timeout_ms: 300000, startup_timeout_ms: 30000, max_retries: 3, log_level: 'info', ...gw },
    mcpServers: { test: { command: 'node', args: ['test.js'] } },
  });
}

// ═══════════════════════════════════
// 驗證器測試
// ═══════════════════════════════════

describe('loadConfig — 驗證器', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => { process.env = originalEnv; });

  it('合法設定正常載入', () => {
    mockReadFileSync.mockReturnValue(validJSON());
    const config = loadConfig();
    expect(config.gateway.idle_timeout_ms).toBe(300000);
    expect(config.mcpServers.test.command).toBe('node');
  });

  it('設定檔不存在拋錯', () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    expect(() => loadConfig()).toThrow('無法讀取設定檔');
  });

  it('JSON 語法錯誤拋錯', () => {
    mockReadFileSync.mockReturnValue('{ bad json }');
    expect(() => loadConfig()).toThrow('JSON');
  });

  it('缺少 gateway 區段拋錯', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ mcpServers: {} }));
    expect(() => loadConfig()).toThrow('gateway');
  });

  it('日誌等級錯誤拋錯', () => {
    mockReadFileSync.mockReturnValue(gatewayJSON({ log_level: 'verbose' }));
    expect(() => loadConfig()).toThrow('log_level');
  });

  it('超時值為負數拋錯', () => {
    mockReadFileSync.mockReturnValue(gatewayJSON({ idle_timeout_ms: -1 }));
    expect(() => loadConfig()).toThrow('idle_timeout_ms');
  });

  it('MCP 缺少 command 拋錯', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: { idle_timeout_ms: 1, startup_timeout_ms: 1, max_retries: 0, log_level: 'info' },
      mcpServers: { broken: { args: ['x'] } },
    }));
    expect(() => loadConfig()).toThrow('command');
  });

  it('MCP 的 args 非陣列拋錯', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: { idle_timeout_ms: 1, startup_timeout_ms: 1, max_retries: 0, log_level: 'info' },
      mcpServers: { broken: { command: 'node', args: 'not-array' } },
    }));
    expect(() => loadConfig()).toThrow('args');
  });
});

// ═══════════════════════════════════
// 環境變數解析
// ═══════════════════════════════════

describe('loadConfig — 環境變數解析', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => { process.env = originalEnv; });

  it('${VAR} 模板替換為 process.env 值', () => {
    process.env.MY_TEST_TOKEN = 'secret123';
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: { idle_timeout_ms: 1, startup_timeout_ms: 1, max_retries: 0, log_level: 'info' },
      mcpServers: { test: { command: 'node', args: ['--token', '${MY_TEST_TOKEN}'] } },
    }));
    const config = loadConfig();
    expect(config.mcpServers.test.args).toContain('secret123');
  });

  it('未定義的環境變數保留原文', () => {
    delete process.env.__UNDEFINED_TEST_VAR__;
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: { idle_timeout_ms: 1, startup_timeout_ms: 1, max_retries: 0, log_level: 'info' },
      mcpServers: { test: { command: 'node', args: ['${__UNDEFINED_TEST_VAR__}'] } },
    }));
    const config = loadConfig();
    expect(config.mcpServers.test.args).toContain('${__UNDEFINED_TEST_VAR__}');
  });

  it('巢狀物件中的環境變數被遞迴替換', () => {
    process.env.__NESTED_TEST__ = 'nested_val';
    mockReadFileSync.mockReturnValue(JSON.stringify({
      gateway: { idle_timeout_ms: 1, startup_timeout_ms: 1, max_retries: 0, log_level: 'info' },
      mcpServers: { test: { command: 'node', args: ['x'], env: { T: '${__NESTED_TEST__}' } } },
    }));
    const config = loadConfig();
    expect(config.mcpServers.test.env?.T).toBe('nested_val');
  });

  it('gateway.env 檔案注入環境變數', () => {
    mockReadFileSync.mockImplementation(((path: string) => {
      const p = String(path);
      if (p.includes('gateway.config')) return gatewayJSON({ env_file: 'gateway.env' });
      if (p.includes('gateway.env')) return '__FROM_ENV_FILE__=injected_value\n';
      throw new Error(`Unexpected: ${p}`);
    }) as typeof mockReadFileSync);
    mockExistsSync.mockReturnValue(true);

    const config = loadConfig();
    expect(process.env.__FROM_ENV_FILE__).toBe('injected_value');
  });

  it('系統環境變數優先於 gateway.env', () => {
    process.env.__PRIORITY_TEST__ = 'from_system';
    mockReadFileSync.mockImplementation(((path: string) => {
      const p = String(path);
      if (p.includes('gateway.config')) {
        return JSON.stringify({
          gateway: { idle_timeout_ms: 1, startup_timeout_ms: 1, max_retries: 0, log_level: 'info', env_file: 'gateway.env' },
          mcpServers: { test: { command: 'node', args: ['${__PRIORITY_TEST__}'] } },
        });
      }
      if (p.includes('gateway.env')) return '__PRIORITY_TEST__=from_file\n';
      throw new Error(`Unexpected: ${p}`);
    }) as typeof mockReadFileSync);
    mockExistsSync.mockReturnValue(true);

    const config = loadConfig();
    expect(config.mcpServers.test.args).toContain('from_system');
  });

  it('相對 env_file 以設定檔所在資料夾解析', () => {
    const readPaths: string[] = [];
    mockReadFileSync.mockImplementation(((path: string) => {
      const p = String(path);
      readPaths.push(p);
      if (p.includes('gateway.config')) return gatewayJSON({ env_file: 'nested/gateway.env' });
      if (p.includes('nested') && p.includes('gateway.env')) return '__RELATIVE_ENV__=ok\n';
      throw new Error(`Unexpected: ${p}`);
    }) as typeof mockReadFileSync);
    mockExistsSync.mockReturnValue(true);

    loadConfig('D:/portable/gateway.config.json');

    expect(process.env.__RELATIVE_ENV__).toBe('ok');
    expect(readPaths.some((p) => p.endsWith('portable\\nested\\gateway.env'))).toBe(true);
  });
});

// ═══════════════════════════════════
// MCP 目錄掃描
// ═══════════════════════════════════

describe('loadConfig — MCP 目錄掃描', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => { process.env = originalEnv; });

  it('從 mcps/ 目錄掃描分類和 MCP 設定', () => {
    mockReadFileSync.mockImplementation(((path: string) => {
      const p = String(path);
      if (p.includes('gateway.config')) return gatewayJSON({ mcps_dir: 'mcps' });
      if (p.endsWith('.json') && p.includes('mcps')) {
        return JSON.stringify({ command: 'node', args: ['server.js'] });
      }
      throw new Error(`Unexpected: ${p}`);
    }) as typeof mockReadFileSync);

    mockExistsSync.mockImplementation(((path: string) =>
      String(path).includes('mcps')
    ) as typeof mockExistsSync);

    mockReaddirSync.mockImplementation(((path: string) => {
      if (String(path).endsWith('mcps')) return ['測試分類'] as unknown as ReturnType<typeof mockReaddirSync>;
      if (String(path).includes('測試分類')) return ['my-mcp.json'] as unknown as ReturnType<typeof mockReaddirSync>;
      return [] as unknown as ReturnType<typeof mockReaddirSync>;
    }) as typeof mockReaddirSync);

    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof mockStatSync>);

    const config = loadConfig();
    expect(config.mcpServers).toHaveProperty('my-mcp');
    expect(config.mcpServers['my-mcp'].command).toBe('node');
    expect(config.categories).toHaveProperty('測試分類');
  });

  it('相對 mcps_dir 以設定檔所在資料夾解析', () => {
    const readdirPaths: string[] = [];
    mockReadFileSync.mockImplementation(((path: string) => {
      const p = String(path);
      if (p.includes('gateway.config')) return gatewayJSON({ mcps_dir: 'custom-mcps' });
      if (p.endsWith('.json') && p.includes('custom-mcps')) {
        return JSON.stringify({ command: 'node', args: ['server.js'] });
      }
      throw new Error(`Unexpected: ${p}`);
    }) as typeof mockReadFileSync);

    mockExistsSync.mockImplementation(((path: string) =>
      String(path).includes('custom-mcps')
    ) as typeof mockExistsSync);

    mockReaddirSync.mockImplementation(((path: string) => {
      const p = String(path);
      readdirPaths.push(p);
      if (p.endsWith('custom-mcps')) return ['分類'] as unknown as ReturnType<typeof mockReaddirSync>;
      if (p.includes('分類')) return ['tool.json'] as unknown as ReturnType<typeof mockReaddirSync>;
      return [] as unknown as ReturnType<typeof mockReaddirSync>;
    }) as typeof mockReaddirSync);

    mockStatSync.mockReturnValue({ isDirectory: () => true } as ReturnType<typeof mockStatSync>);

    const config = loadConfig('D:/portable/gateway.config.json');

    expect(config.mcpServers).toHaveProperty('tool');
    expect(readdirPaths.some((p) => p.endsWith('portable\\custom-mcps'))).toBe(true);
  });
});
