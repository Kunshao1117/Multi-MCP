/**
 * Multi-MCP Gateway CLI — 健康檢查
 * 逐一試啟動每個 MCP，測試連線與認證狀態。
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createDownstreamEnv } from '../subprocess-env.js';
import { pause, header, c, loadMcpsByCategory, type McpServerDef } from './shared.js';

interface CheckResult {
  name: string;
  status: 'ok' | 'fail';
  toolCount?: number;
  error?: string;
}

/** 解析 ${VAR} 佔位符為環境變數值 */
function resolveEnvVar(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName: string) => {
    return process.env[varName] ?? match;
  });
}

/** 健康檢查主流程 */
export async function healthCheckMenu(): Promise<void> {
  header('🏥 健康檢查');

  const categories = loadMcpsByCategory();
  const results: CheckResult[] = [];

  const allMcps: Array<{ name: string; config: McpServerDef; category: string }> = [];
  for (const [cat, mcps] of Object.entries(categories)) {
    for (const [name, config] of Object.entries(mcps)) {
      allMcps.push({ name, config, category: cat });
    }
  }

  if (allMcps.length === 0) {
    console.log('  (尚無安裝的 MCP)');
    await pause();
    return;
  }

  console.log(`  🔍 正在檢查 ${allMcps.length} 個 MCP...\n`);

  for (const { name, config } of allMcps) {
    process.stdout.write(`  ⏳ ${name}...`);
    let transport: StdioClientTransport | null = null;

    try {
      // 解析環境變數佔位符
      const resolvedArgs = config.args.map((a) => resolveEnvVar(a));
      const resolvedEnv: Record<string, string> = {};
      if (config.env) {
        for (const [k, v] of Object.entries(config.env)) {
          resolvedEnv[k] = resolveEnvVar(v);
        }
      }

      transport = new StdioClientTransport({
        command: config.command,
        args: resolvedArgs,
        env: createDownstreamEnv(resolvedEnv),
      });

      const client = new Client(
        { name: 'health-checker', version: '0.1.0' },
        { capabilities: {} },
      );

      // 30 秒逾時（遠端 MCP 的 OAuth 握手較慢）
      const connectPromise = client.connect(transport);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('連線逾時 (30s)')), 30_000),
      );
      await Promise.race([connectPromise, timeoutPromise]);

      const toolsResult = await client.listTools();
      const toolCount = toolsResult.tools?.length ?? 0;
      await client.close();

      results.push({ name, status: 'ok', toolCount });
      console.log(`\r  ${c.green}✅ ${name}${c.reset} — ${toolCount} 個工具`);
    } catch (err) {
      const msg = (err as Error).message;
      results.push({ name, status: 'fail', error: msg });
      console.log(`\r  ${c.red}❌ ${name}${c.reset} — ${msg}`);
    } finally {
      try { if (transport) await transport.close(); } catch { /* 忽略 */ }
    }
  }

  // 摘要
  const ok = results.filter((r) => r.status === 'ok').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  console.log(`\n  ─────────────────────────`);
  console.log(`  ${c.bold}結果：${c.green}通過 ${ok}${c.reset} / ${c.red}失敗 ${fail}${c.reset} / 共 ${results.length} 個`);

  await pause();
}
