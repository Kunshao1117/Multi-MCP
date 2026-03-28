/**
 * Multi-MCP Gateway — 程序池管理員單元測試
 * 測試初始化狀態、健康報告、懶啟動、停止與重載
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GatewayConfig } from './types.js';

// 模擬 MCP SDK
const { mockConnect, mockClientClose, mockTransportClose } = vi.hoisted(() => ({
  mockConnect: vi.fn().mockResolvedValue(undefined),
  mockClientClose: vi.fn().mockResolvedValue(undefined),
  mockTransportClose: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    close: mockClientClose,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({
    onerror: null,
    close: mockTransportClose,
  })),
}));

import { ProcessPool } from './process-pool.js';

/** 建立測試設定（禁用閒置回收和重試以加速測試） */
function testConfig(servers?: Record<string, { command: string; args: string[]; env?: Record<string, string> }>): GatewayConfig {
  return {
    gateway: {
      idle_timeout_ms: 0,
      startup_timeout_ms: 5000,
      max_retries: 0,
      log_level: 'error',
    },
    mcpServers: servers ?? {
      'test-server': { command: 'node', args: ['test.js'] },
    },
  };
}

// ═══════════════════════════════════
// 初始化
// ═══════════════════════════════════

describe('ProcessPool — 初始化', () => {
  it('所有伺服器初始為休眠狀態', () => {
    const pool = new ProcessPool(testConfig());
    const health = pool.getHealthInfo();
    expect(health).toHaveLength(1);
    expect(health[0].state).toBe('dormant');
  });

  it('無認證需求時標記為未知', () => {
    const pool = new ProcessPool(testConfig({
      'no-auth': { command: 'node', args: ['test.js'] },
    }));
    expect(pool.getHealthInfo()[0].authStatus).toBe('unknown');
  });

  it('多個伺服器全部初始化', () => {
    const pool = new ProcessPool(testConfig({
      s1: { command: 'node', args: ['a.js'] },
      s2: { command: 'node', args: ['b.js'] },
      s3: { command: 'node', args: ['c.js'] },
    }));
    expect(pool.getHealthInfo()).toHaveLength(3);
  });
});

// ═══════════════════════════════════
// 伺服器查詢
// ═══════════════════════════════════

describe('ProcessPool — 伺服器查詢', () => {
  it('hasServer 判斷存在的伺服器', () => {
    const pool = new ProcessPool(testConfig());
    expect(pool.hasServer('test-server')).toBe(true);
  });

  it('hasServer 判斷不存在的伺服器', () => {
    const pool = new ProcessPool(testConfig());
    expect(pool.hasServer('nonexistent')).toBe(false);
  });

  it('getClient 對未知伺服器拋錯', async () => {
    const pool = new ProcessPool(testConfig());
    await expect(pool.getClient('nonexistent')).rejects.toThrow('未知的 MCP 伺服器');
  });
});

// ═══════════════════════════════════
// 動態管理
// ═══════════════════════════════════

describe('ProcessPool — 動態管理', () => {
  it('addServer 新增伺服器', () => {
    const pool = new ProcessPool(testConfig());
    expect(pool.hasServer('new-server')).toBe(false);
    pool.addServer('new-server', { command: 'node', args: ['new.js'] });
    expect(pool.hasServer('new-server')).toBe(true);
  });

  it('addServer 更新已有伺服器重置為休眠', () => {
    const pool = new ProcessPool(testConfig());
    pool.addServer('test-server', { command: 'python', args: ['new.py'] });
    expect(pool.getHealthInfo().find((h) => h.serverName === 'test-server')?.state).toBe('dormant');
  });
});

// ═══════════════════════════════════
// 懶啟動
// ═══════════════════════════════════

describe('ProcessPool — 懶啟動', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it('getClient 成功啟動並回傳 client', async () => {
    const pool = new ProcessPool(testConfig());
    const client = await pool.getClient('test-server');
    expect(client).toBeDefined();
    expect(mockConnect).toHaveBeenCalled();
    expect(pool.getHealthInfo()[0].state).toBe('ready');
    expect(pool.getHealthInfo()[0].authStatus).toBe('valid');
  });

  it('啟動失敗後狀態回到休眠', async () => {
    mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));
    const pool = new ProcessPool(testConfig());
    await expect(pool.getClient('test-server')).rejects.toThrow('啟動失敗');
    expect(pool.getHealthInfo()[0].state).toBe('dormant');
    expect(pool.getHealthInfo()[0].lastError).toContain('ECONNREFUSED');
  });

  it('認證錯誤標記為過期', async () => {
    mockConnect.mockRejectedValue(new Error('401 Unauthorized'));
    const pool = new ProcessPool(testConfig());
    await expect(pool.getClient('test-server')).rejects.toThrow();
    expect(pool.getHealthInfo()[0].authStatus).toBe('expired');
  });

  it('重複呼叫 getClient 不重複啟動', async () => {
    const pool = new ProcessPool(testConfig());
    const c1 = await pool.getClient('test-server');
    const c2 = await pool.getClient('test-server');
    expect(c1).toBe(c2);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════
// 停止與重載
// ═══════════════════════════════════

describe('ProcessPool — 停止與重載', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it('stopServer 重置為休眠', async () => {
    const pool = new ProcessPool(testConfig());
    await pool.getClient('test-server');
    expect(pool.getHealthInfo()[0].state).toBe('ready');
    await pool.stopServer('test-server');
    expect(pool.getHealthInfo()[0].state).toBe('dormant');
  });

  it('reloadServer 重置狀態', async () => {
    const pool = new ProcessPool(testConfig());
    await pool.getClient('test-server');
    await pool.reloadServer('test-server');
    expect(pool.getHealthInfo()[0].state).toBe('dormant');
  });

  it('shutdownAll 關閉所有伺服器', async () => {
    const pool = new ProcessPool(testConfig({
      s1: { command: 'node', args: ['a.js'] },
      s2: { command: 'node', args: ['b.js'] },
    }));
    await pool.getClient('s1');
    await pool.getClient('s2');
    await pool.shutdownAll();
    expect(pool.getHealthInfo().every((h) => h.state === 'dormant')).toBe(true);
  });
});
