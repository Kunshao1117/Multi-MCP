/**
 * Multi-MCP Gateway — 工具路由引擎單元測試
 * 測試命名空間解析、管理工具分派、認證錯誤降級、集成表熱替換
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRouter } from './tool-router.js';
import type { ToolRegistry, GatewayConfig } from './types.js';
import type { ProcessPool } from './process-pool.js';
import { GATEWAY_TOOL_DEFINITIONS } from './gateway-tools.js';

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

function createRegistryWithCartridgeTools(): ToolRegistry {
  const toolNames = [
    'memory_list',
    'memory_read',
    'memory_status',
    'memory_commit',
    'memory_deps',
    'memory_audit',
    'workspace_brief',
    'commit_preflight',
  ];
  const tools = Object.fromEntries(toolNames.map((name) => [
    `cartridge-system__${name}`,
    {
      original_name: name,
      server_name: 'cartridge-system',
      description: `cartridge-system ${name} tool`,
      inputSchema: {
        type: 'object',
        properties: name === 'memory_deps'
          ? { moduleName: { type: 'string' }, projectRoot: { type: 'string' } }
          : { projectRoot: { type: 'string' } },
      },
    },
  ]));
  return {
    version: '1.0.0',
    generated_at: '2026-01-01T00:00:00+08:00',
    servers: {
      'cartridge-system': {
        tool_count: 7,
        tools,
      },
    },
    all_tools: Object.fromEntries(toolNames.map((name) => [`cartridge-system__${name}`, 'cartridge-system'])),
  } as ToolRegistry;
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

  it('搜尋 call downstream MCP tool 會找到 gateway__call_tool', async () => {
    const result = await router.route('gateway__search_tools', { query: 'call downstream MCP tool' }) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('gateway__call_tool');
    expect(result.content[0].text).toContain('呼叫下游 MCP 工具');
    expect(result.content[0].text).toContain('每次呼叫都要明確傳入');
  });

  it('Gateway 管理工具不再暴露固定 workspace 工具', () => {
    const names = GATEWAY_TOOL_DEFINITIONS.map((tool) => tool.name);
    expect(names).toHaveLength(10);
    expect(names).toContain('gateway__call_tool');
    expect(names).toContain('gateway__search_tools');
    expect(names).not.toContain('gateway__set_workspace');
    expect(names).not.toContain('gateway__get_workspace');
  });

  it('搜尋呼叫 cartridge-system memory_audit 會顯示 call_tool 與下游工具', async () => {
    const cartridgeRouter = new ToolRouter(createRegistryWithCartridgeTools(), pool, createTestConfig());
    const result = await cartridgeRouter.route('gateway__search_tools', { query: '呼叫 cartridge-system memory_audit' }) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('gateway__call_tool');
    expect(result.content[0].text).toContain('cartridge-system__memory_audit');
    expect(result.content[0].text).toContain('真實執行下游 MCP');
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

  it('列出 cartridge-system 工具時使用實際 8 個工具而非 stale tool_count', async () => {
    const cartridgeRouter = new ToolRouter(createRegistryWithCartridgeTools(), pool, createTestConfig());
    const result = await cartridgeRouter.route('gateway__list_server_tools', { server_name: 'cartridge-system' }) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('8 個工具');
    expect(result.content[0].text).toContain('cartridge-system__memory_audit');
    expect(result.content[0].text).toContain('cartridge-system__workspace_brief');
    expect(result.content[0].text).toContain('cartridge-system__commit_preflight');
    expect(result.content[0].text).toContain('moduleName');
  });

  it('不存在的伺服器拋錯', async () => {
    await expect(router.route('gateway__list_server_tools', { server_name: 'xxx' })).rejects.toThrow('server 未註冊');
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
    await expect(router.route('gateway__nonexistent', {})).rejects.toThrow('管理工具不存在');
  });

  it('固定 workspace 管理工具已移除', async () => {
    await expect(router.route('gateway__set_workspace', { path: 'd:\\Project' })).rejects.toThrow('管理工具不存在');
    await expect(router.route('gateway__get_workspace', {})).rejects.toThrow('管理工具不存在');
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
    await expect(router.route('supabase__nonexistent', {})).rejects.toThrow('工具不存在');
  });

  it('未知下游 server 拋出 server 未註冊', async () => {
    await expect(router.route('missing__tool', {})).rejects.toThrow('server 未註冊');
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

  it('參數名稱疑似錯誤時提示相近 schema 參數', async () => {
    const registry = createRegistryWithCartridgeTools();
    router = new ToolRouter(registry, pool, createTestConfig());
    const mockClient = { callTool: vi.fn().mockRejectedValue(new Error('Required')) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    await expect(router.route('cartridge-system__memory_deps', { module: '_system' }))
      .rejects.toThrow(/收到未知參數: module[\s\S]*疑似應改用: module -> moduleName[\s\S]*此工具接受的 arguments: moduleName, projectRoot/);
  });

  it('參數名稱不相近時不亂猜建議', async () => {
    const registry = createRegistryWithCartridgeTools();
    router = new ToolRouter(registry, pool, createTestConfig());
    const mockClient = { callTool: vi.fn().mockRejectedValue(new Error('Validation failed')) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    try {
      await router.route('cartridge-system__memory_status', { abc: 'x' });
      throw new Error('Expected route to fail');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/收到未知參數: abc[\s\S]*此工具接受的 arguments: projectRoot/);
      expect(message).not.toContain('疑似應改用');
    }
  });

  it('缺少 required 參數時提示必要參數', async () => {
    const registry = createTestRegistry();
    registry.servers.supabase.tools['supabase__execute_sql'].inputSchema = {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    };
    router = new ToolRouter(registry, pool, createTestConfig());
    const mockClient = { callTool: vi.fn().mockRejectedValue(new Error('Required')) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    await expect(router.route('supabase__execute_sql', {}))
      .rejects.toThrow(/缺少必要參數: query[\s\S]*此工具接受的 arguments: query/);
  });

  it('schema 沒有 properties 時不產生假參數建議', async () => {
    const registry = createTestRegistry();
    registry.servers.supabase.tools['supabase__list_tables'].inputSchema = { type: 'object' };
    router = new ToolRouter(registry, pool, createTestConfig());
    const mockClient = { callTool: vi.fn().mockRejectedValue(new Error('Validation failed')) };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    try {
      await router.route('supabase__list_tables', { module: '_system' });
      throw new Error('Expected route to fail');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('Gateway 無法從 inputSchema 判斷可用參數');
      expect(message).not.toContain('疑似應改用');
    }
  });

  it('下游以 error content 回傳 validation error 時附加參數診斷', async () => {
    const registry = createRegistryWithCartridgeTools();
    router = new ToolRouter(registry, pool, createTestConfig());
    const mockClient = {
      callTool: vi.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            findings: [{ code: 'validation_error', message: 'Validation Error: moduleName is required' }],
          }),
        }],
      }),
    };
    (pool.getClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockClient);

    const result = await router.route('cartridge-system__memory_deps', { module: '_system' }) as { content: Array<{ text: string }> };
    const text = result.content.map((item) => item.text).join('\n');
    expect(text).toContain('Gateway 參數診斷');
    expect(text).toContain('收到未知參數: module');
    expect(text).toContain('疑似應改用: module -> moduleName');
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

  it('缺少 workspace 時拒絕呼叫，避免使用固定全域路徑', async () => {
    await expect(router.route('gateway__call_tool', {
      name: 'cartridge-system__memory_list',
      arguments: {},
    })).rejects.toThrow('缺少 workspace 參數');

    expect(mockClient.callTool).not.toHaveBeenCalled();
  });

  it('不同呼叫的 workspace 只影響本次 projectRoot 注入', async () => {
    await router.route('gateway__call_tool', {
      name: 'cartridge-system__memory_list',
      arguments: {},
      workspace: 'd:\\ProjectA',
    });
    await router.route('gateway__call_tool', {
      name: 'cartridge-system__memory_list',
      arguments: {},
      workspace: 'd:\\ProjectB',
    });

    expect(mockClient.callTool).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        arguments: expect.objectContaining({ projectRoot: 'd:\\ProjectA' }),
      }),
    );
    expect(mockClient.callTool).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        arguments: expect.objectContaining({ projectRoot: 'd:\\ProjectB' }),
      }),
    );
  });
});
