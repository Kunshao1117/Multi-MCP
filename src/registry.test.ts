/**
 * Multi-MCP Gateway — 集成表引擎單元測試
 * 測試搜尋功能與分類總表生成
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { searchTools, generateCategorySummary, formatCategorySummaryText, loadRegistry } from './registry.js';
import type { ToolRegistry } from './types.js';

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

/** 建立測試用集成表 */
function createTestRegistry(): ToolRegistry {
  return {
    version: '1.0.0',
    servers: {
      supabase: {
        tool_count: 3,
        tools: {
          'supabase__list_tables': {
            original_name: 'list_tables',
            server_name: 'supabase',
            description: 'Lists all tables in one or more schemas.',
            inputSchema: { type: 'object', properties: { project_id: { type: 'string' } } },
          },
          'supabase__execute_sql': {
            original_name: 'execute_sql',
            server_name: 'supabase',
            description: 'Executes raw SQL in the Postgres database.',
            inputSchema: { type: 'object', properties: { project_id: { type: 'string' }, query: { type: 'string' } } },
          },
          'supabase__list_projects': {
            original_name: 'list_projects',
            server_name: 'supabase',
            description: 'Lists all Supabase projects for the user.',
            inputSchema: { type: 'object', properties: {} },
          },
        },
      },
      stitch: {
        tool_count: 2,
        tools: {
          'stitch__create_project': {
            original_name: 'create_project',
            server_name: 'stitch',
            description: 'Creates a new Stitch project for UI designs.',
            inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
          },
          'stitch__generate_screen_from_text': {
            original_name: 'generate_screen_from_text',
            server_name: 'stitch',
            description: 'Generates a new screen within a project from a text prompt.',
            inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, prompt: { type: 'string' } } },
          },
        },
      },
      'cloudflare-bindings': {
        tool_count: 1,
        tools: {
          'cloudflare-bindings__workers_list': {
            original_name: 'workers_list',
            server_name: 'cloudflare-bindings',
            description: 'List all Workers in your Cloudflare account.',
            inputSchema: { type: 'object', properties: {} },
          },
        },
      },
    },
    all_tools: {
      'supabase__list_tables': 'supabase',
      'supabase__execute_sql': 'supabase',
      'supabase__list_projects': 'supabase',
      'stitch__create_project': 'stitch',
      'stitch__generate_screen_from_text': 'stitch',
      'cloudflare-bindings__workers_list': 'cloudflare-bindings',
    },
    generated_at: '2026-03-24T00:00:00+08:00',
  };
}

describe('searchTools', () => {
  const registry = createTestRegistry();

  it('精確匹配工具名稱', () => {
    const results = searchTools(registry, 'list_tables');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('supabase__list_tables');
  });

  it('模糊匹配描述', () => {
    const results = searchTools(registry, 'SQL database');
    expect(results.some((r) => r.name === 'supabase__execute_sql')).toBe(true);
  });

  it('伺服器篩選', () => {
    const results = searchTools(registry, 'list', { server: 'stitch' });
    expect(results.every((r) => r.server === 'stitch')).toBe(true);
  });

  it('空結果', () => {
    const results = searchTools(registry, 'nonexistent_tool_xyz');
    expect(results).toHaveLength(0);
  });

  it('結果上限', () => {
    const results = searchTools(registry, 'list', { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('空查詢回傳空陣列', () => {
    const results = searchTools(registry, '');
    expect(results).toHaveLength(0);
  });

  it('搜尋結果含完整參數結構', () => {
    const results = searchTools(registry, 'execute_sql');
    const sqlTool = results.find((r) => r.name === 'supabase__execute_sql');
    expect(sqlTool).toBeDefined();
    expect(sqlTool!.inputSchema).toBeDefined();
    expect(sqlTool!.server).toBe('supabase');
  });
});

describe('generateCategorySummary', () => {
  const registry = createTestRegistry();

  it('正確分組', () => {
    const categories = {
      '資料庫管理': ['supabase'],
      'UI設計': ['stitch'],
    };
    const summaries = generateCategorySummary(registry, categories);
    expect(summaries.length).toBe(3); // 含未分類（cloudflare-bindings）
    const dbCat = summaries.find((s) => s.category === '資料庫管理');
    expect(dbCat).toBeDefined();
    expect(dbCat!.toolCount).toBe(3);
    expect(dbCat!.servers).toEqual(['supabase']);
  });

  it('未分類伺服器', () => {
    const categories = { '資料庫管理': ['supabase'] };
    const summaries = generateCategorySummary(registry, categories);
    const uncat = summaries.find((s) => s.category === '未分類');
    expect(uncat).toBeDefined();
    expect(uncat!.servers).toContain('stitch');
    expect(uncat!.servers).toContain('cloudflare-bindings');
  });

  it('空分類不會產生條目', () => {
    const categories = { '空分類': ['nonexistent'] };
    const summaries = generateCategorySummary(registry, categories);
    expect(summaries.find((s) => s.category === '空分類')).toBeUndefined();
  });

  it('分類摘要使用實際 tools 數量避免 stale tool_count', () => {
    const staleRegistry = createTestRegistry();
    staleRegistry.servers.supabase.tool_count = 2;
    const summaries = generateCategorySummary(staleRegistry, { '資料庫管理': ['supabase'] });
    const dbCat = summaries.find((s) => s.category === '資料庫管理');
    expect(dbCat).toBeDefined();
    expect(dbCat!.toolCount).toBe(3);
  });
});

describe('formatCategorySummaryText', () => {
  it('產生可讀的格式化文字', () => {
    const summaries = [
      { category: '資料庫管理', servers: ['supabase'], toolCount: 3, highlights: ['list_tables', 'execute_sql'] },
    ];
    const text = formatCategorySummaryText(summaries);
    expect(text).toContain('📦');
    expect(text).toContain('資料庫管理');
    expect(text).toContain('3 個工具');
  });
});

describe('loadRegistry', () => {
  it('可從自訂 registry 路徑載入集成表', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gateway-registry-'));
    tempRoots.push(root);
    const registryPath = path.join(root, 'registry.json');
    writeFileSync(registryPath, JSON.stringify(createTestRegistry()), 'utf-8');

    const registry = loadRegistry(registryPath);

    expect(registry.servers).toHaveProperty('supabase');
    expect(registry.all_tools).toHaveProperty('supabase__list_tables');
  });
});
