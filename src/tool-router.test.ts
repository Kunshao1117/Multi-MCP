/**
 * Multi-MCP Gateway — 工具路由引擎單元測試
 * 測試命名空間解析、管理工具分派、認證錯誤降級、集成表熱替換
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRouter } from './tool-router.js';
import type { ToolRegistry, GatewayConfig } from './types.js';
import type { ProcessPool } from './process-pool.js';

/** 建立測試用集成表 */
function createTestRegistry(): ToolRegistry {
  return {
    version: '1.0.0',
    generated_at: '2026-01-01T00:00:00+08:00',
    servers: {
      supabase: {
        tool_count: 2,
        tools: {
          'supabase__list_tables': {
            original_name: 'list_tables', server_name: 'supabase',
            description: 'Lists all tables.', inputSchema: { type: 'object', properties: {} },
          },
          'supabase__execute_sql': {
            original_name: 'execute_sql', server_name: 'supabase',
            description: 'Executes SQL queries.',
            inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
          },
        },
      },
    },
    all_tools: {
      'supabase__list_tables': 'supabase',
      'supabase__execute_sql': 'supabase',
    },
  };
}

/** 建立最小設定 */
function createTestConfig(): GatewayConfig {
  return {
    gateway: { idle_timeout_ms: 300000, startup_timeout_ms: 30000, max_retries: 3, log_level: 'info' },
    mcpServers: {
      supabase: { command: 'npx', args: ['-y', '@supabase/mcp-server-supabase'], env: { SUPABASE_ACCESS_TOKEN: '${SUPABASE_ACCESS_TOKEN}' } },
    },
  };
}

/** 建立模擬程序池 */
function createMockPool() {
  return {
    getClient: vi.fn(),
    getHealthInfo: vi.fn().mockReturnValue([
      { serverName: 'supabase', state: 'ready', authStatus: 'valid', lastChecked: Date.now() },
    ]),
    reloadServer: vi.fn().mockResolvedValue(undefined),
    addServer: vi.fn(),
  } as unknown as ProcessPool;
}

// ═══════════════════════════════════
// 命名空間解析
// ═══════════════════════════════════

describe('parseToolName — 命名空間解析', () => {
  const router = new ToolRouter(createTestRegistry(), createMockPool(), createTestConfig());

  it('解析標準命名空間工具名', () => {
    const r = router.parseToolName('supabase__list_tables');
    expect(r.serverName).toBe('supabase');
    expect(r.originalToolName).toBe('list_tables');
  });

  it('解析閘道器管理工具名', () => {
    const r = router.parseToolName('gateway__search_tools');
    expect(r.serverName).toBe('gateway');
    expect(r.originalToolName).toBe('search_tools');
  });

  it('缺少命名空間拋錯', () => {
    expect(() => router.parseToolName('list_tables')).toThrow('命名空間');
  });
});

// ═══════════════════════════════════
// 閘道器管理工具
// ═══════════════════════════════════

describe('route — 管理工具', () => {
  let pool: ReturnType<typeof createMockPool>;
  let router: ToolRouter;

  beforeEach(() => {
    pool = createMockPool();
    router = new ToolRouter(createTestRegistry(), pool, createTestConfig());
  });

  it('列出伺服器', async () => {
    const result = await router.route('gateway__list_servers', {}) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.servers).toContain('supabase');
    expect(parsed.total_tools).toBe(2);
  });

  it('搜尋工具', async () => {
    const result = await router.route('gateway__search_tools', { query: 'list' }) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('list_tables');
  });

  it('搜尋工具缺少 query 拋錯', async () => {
    await expect(router.route('gateway__search_tools', {})).rejects.toThrow('query');
  });

  it('搜尋無結果', async () => {
    const result = await router.route('gateway__search_tools', { query: 'zzz_nonexistent' }) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('沒有找到');
  });

  it('列出伺服器工具', async () => {
    const result = await router.route('gateway__list_server_tools', { server_name: 'supabase' }) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('list_tables');
    expect(result.content[0].text).toContain('2 個工具');
  });

  it('不存在的伺服器拋錯', async () => {
    await expect(router.route('gateway__list_server_tools', { server_name: 'xxx' })).rejects.toThrow('找不到伺服器');
  });

  it('認證狀態查詢', async () => {
    const result = await router.route('gateway__auth_status', {}) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('supabase');
    expect(result.content[0].text).toContain('✅');
  });

  it('伺服器狀態查詢', async () => {
    const result = await router.route('gateway__server_status', {}) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].serverName).toBe('supabase');
  });

  it('認證指南查詢', async () => {
    const result = await router.route('gateway__auth_guide', { server_name: 'supabase' }) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('授權指南');
    expect(result.content[0].text).toContain('SUPABASE_ACCESS_TOKEN');
  });

  it('認證指南缺少參數拋錯', async () => {
    await expect(router.route('gateway__auth_guide', {})).rejects.toThrow('server_name');
  });

  it('重新載入伺服器', async () => {
    const result = await router.route('gateway__reload_server', { server_name: 'supabase' }) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('已重新載入');
    expect((pool as unknown as { reloadServer: ReturnType<typeof vi.fn> }).reloadServer).toHaveBeenCalledWith('supabase');
  });

  it('未知管理工具拋錯', async () => {
    await expect(router.route('gateway__nonexistent', {})).rejects.toThrow('未知的管理工具');
  });
});

// ═══════════════════════════════════
// 下游 MCP 呼叫
// ═══════════════════════════════════

describe('route — 下游 MCP 呼叫', () => {
  let pool: ReturnType<typeof createMockPool>;
  let router: ToolRouter;

  beforeEach(() => {
    pool = createMockPool();
    router = new ToolRouter(createTestRegistry(), pool, createTestConfig());
  });

  it('正確路由到下游 MCP', async () => {
    const mockClient = { callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    await router.route('supabase__list_tables', { project_id: 'test' });
    expect(mockClient.callTool).toHaveBeenCalledWith({ name: 'list_tables', arguments: { project_id: 'test' } });
  });

  it('未知工具拋錯', async () => {
    await expect(router.route('supabase__nonexistent', {})).rejects.toThrow('未知的工具');
  });

  it('認證錯誤降級為操作指引', async () => {
    const mockClient = { callTool: vi.fn().mockRejectedValue(new Error('401 Unauthorized')) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    const result = await router.route('supabase__list_tables', {}) as { content: Array<{ text: string }>; isError: boolean };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('認證失敗');
    expect(result.content[0].text).toContain('修復步驟');
  });

  it('非認證錯誤直接拋出', async () => {
    const mockClient = { callTool: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    await expect(router.route('supabase__list_tables', {})).rejects.toThrow('ECONNREFUSED');
  });
});

// ═══════════════════════════════════
// 集成表熱替換
// ═══════════════════════════════════

describe('updateRegistry — 集成表熱替換', () => {
  it('替換後搜尋使用新資料', async () => {
    const router = new ToolRouter(createTestRegistry(), createMockPool(), createTestConfig());

    const r1 = await router.route('gateway__search_tools', { query: 'list_tables' }) as { content: Array<{ text: string }> };
    expect(r1.content[0].text).toContain('supabase');

    router.updateRegistry({ version: '1.0.0', generated_at: '', servers: {}, all_tools: {} });

    const r2 = await router.route('gateway__search_tools', { query: 'list_tables' }) as { content: Array<{ text: string }> };
    expect(r2.content[0].text).toContain('沒有找到');
  });
});

// ═══════════════════════════════════
// 參數型別容錯強轉
// ═══════════════════════════════════

describe('coerceArgs — 參數型別容錯強轉', () => {
  let pool: ReturnType<typeof createMockPool>;
  let router: ToolRouter;

  beforeEach(() => {
    const registry = createTestRegistry();
    // 為 execute_sql 加入多種型別的參數定義
    registry.servers.supabase.tools['supabase__execute_sql'].inputSchema = {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'integer' },
        verbose: { type: 'boolean' },
      },
    };
    pool = createMockPool();
    router = new ToolRouter(registry, pool, createTestConfig());
  });

  it('字串數字自動轉為 number', async () => {
    const mockClient = { callTool: vi.fn().mockResolvedValue({ content: [] }) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);
    await router.route('supabase__execute_sql', { query: 'SELECT 1', limit: '10', offset: '5' });
    expect(mockClient.callTool).toHaveBeenCalledWith({
      name: 'execute_sql',
      arguments: expect.objectContaining({ limit: 10, offset: 5 }),
    });
  });

  it('字串布林自動轉為 boolean', async () => {
    const mockClient = { callTool: vi.fn().mockResolvedValue({ content: [] }) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);
    await router.route('supabase__execute_sql', { query: 'SELECT 1', verbose: 'true' });
    expect(mockClient.callTool).toHaveBeenCalledWith({
      name: 'execute_sql',
      arguments: expect.objectContaining({ verbose: true }),
    });
  });

  it('無法轉換的值保持原樣', async () => {
    const mockClient = { callTool: vi.fn().mockResolvedValue({ content: [] }) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);
    await router.route('supabase__execute_sql', { query: 'SELECT 1', limit: 'abc' });
    expect(mockClient.callTool).toHaveBeenCalledWith({
      name: 'execute_sql',
      arguments: expect.objectContaining({ limit: 'abc' }),
    });
  });
});

// ═══════════════════════════════════
// 工作目錄管理
// ═══════════════════════════════════

describe('route — 工作目錄管理', () => {
  let pool: ReturnType<typeof createMockPool>;
  let router: ToolRouter;

  beforeEach(() => {
    pool = createMockPool();
    router = new ToolRouter(createTestRegistry(), pool, createTestConfig());
  });

  it('未設定時 get_workspace 回傳提示訊息', async () => {
    const result = await router.route('gateway__get_workspace', {}) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('尚未設定');
  });

  it('設定工作目錄成功', async () => {
    const result = await router.route('gateway__set_workspace', { path: 'd:\\BartenderMap' }) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('工作目錄已設定');
    expect(result.content[0].text).toContain('d:\\BartenderMap');
  });

  it('設定後 get_workspace 回傳正確路徑', async () => {
    await router.route('gateway__set_workspace', { path: 'd:\\BartenderMap' });
    const result = await router.route('gateway__get_workspace', {}) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('d:\\BartenderMap');
  });

  it('缺少 path 參數時拋錯', async () => {
    await expect(router.route('gateway__set_workspace', {})).rejects.toThrow('path');
  });
});

// ═══════════════════════════════════
// call_tool — projectRoot 智慧填充
// ═══════════════════════════════════

// 模擬 node:fs 以控制 .agents 目錄的存在判斷
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
  },
}));

import fs from 'node:fs';

describe('call_tool — projectRoot 智慧填充', () => {
  let pool: ReturnType<typeof createMockPool>;
  let router: ToolRouter;
  let mockClient: { callTool: ReturnType<typeof vi.fn> };

  // 集成表需包含一個接受 projectRoot 的下游工具
  function createRegistryWithCartridge(): ToolRegistry {
    return {
      version: '1.0.0',
      generated_at: '2026-01-01T00:00:00+08:00',
      servers: {
        'cartridge-system': {
          tool_count: 1,
          tools: {
            'cartridge-system__memory_list': {
              original_name: 'memory_list', server_name: 'cartridge-system',
              description: 'List memory cards.',
              inputSchema: { type: 'object', properties: { projectRoot: { type: 'string' } } },
            },
          },
        },
      },
      all_tools: {
        'cartridge-system__memory_list': 'cartridge-system',
      },
    };
  }

  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    pool = createMockPool();
    mockClient = { callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);
    router = new ToolRouter(createRegistryWithCartridge(), pool, createTestConfig());
  });

  it('AI 填了正確的 projectRoot（底下有 .agents）→ 保持不變', async () => {
    // 目標路徑下有 .agents → 不修正
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith('d:\\Project\\.agents') ? true : false,
    );

    await router.route('gateway__call_tool', {
      name: 'cartridge-system__memory_list',
      arguments: { projectRoot: 'd:\\Project' },
      workspace: 'd:\\Workspace',
    });

    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: expect.objectContaining({ projectRoot: 'd:\\Project' }),
      }),
    );
  });

  it('AI 填了錯誤的 projectRoot 且 workspace 正確 → 自動修正', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p);
      // 錯誤路徑下無 .agents，workspace 下有
      if (s.endsWith('d:\\Wrong\\.agents')) return false;
      if (s.endsWith('d:\\Workspace\\.agents')) return true;
      return false;
    });

    await router.route('gateway__call_tool', {
      name: 'cartridge-system__memory_list',
      arguments: { projectRoot: 'd:\\Wrong' },
      workspace: 'd:\\Workspace',
    });

    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: expect.objectContaining({ projectRoot: 'd:\\Workspace' }),
      }),
    );
  });

  it('AI 沒填 projectRoot 但 workspace 存在 → 自動注入', async () => {
    await router.route('gateway__call_tool', {
      name: 'cartridge-system__memory_list',
      arguments: {},
      workspace: 'd:\\Workspace',
    });

    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: expect.objectContaining({ projectRoot: 'd:\\Workspace' }),
      }),
    );
  });

  it('workspace 為 null（未設定）→ 不做任何填充', async () => {
    // 未設定 workspace，也不提供 callWorkspace
    await router.route('gateway__call_tool', {
      name: 'cartridge-system__memory_list',
      arguments: {},
    });

    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: expect.not.objectContaining({ projectRoot: expect.anything() }),
      }),
    );
  });
});

