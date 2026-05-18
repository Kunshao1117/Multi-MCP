import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const projectRoot = process.cwd();

function firstText(result) {
  return result?.content?.find((item) => item.type === 'text')?.text ?? '';
}

function allText(result) {
  return result?.content
    ?.filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n') ?? '';
}

function assertContains(text, expected, context) {
  if (!text.includes(expected)) {
    throw new Error(`${context}: expected output to contain "${expected}"`);
  }
}

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  cwd: projectRoot,
  env: { ...process.env, MULTI_MCP_HOME: projectRoot },
});

const client = new Client(
  { name: 'gateway-runtime-verifier', version: '1.0.0' },
  { capabilities: {} },
);

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const callTool = tools.tools.find((tool) => tool.name === 'gateway__call_tool');
  if (!callTool) {
    throw new Error('tools/list did not expose gateway__call_tool');
  }
  assertContains(callTool.description ?? '', '呼叫下游 MCP 工具的 Gateway 真實執行入口', 'gateway__call_tool description');
  assertContains(callTool.description ?? '', 'call downstream MCP tool', 'gateway__call_tool discovery terms');

  const englishSearch = await client.callTool({
    name: 'gateway__search_tools',
    arguments: { query: 'call downstream MCP tool', limit: 5 },
  });
  assertContains(firstText(englishSearch), 'gateway__call_tool', 'English gateway search');

  const cartridgeSearch = await client.callTool({
    name: 'gateway__search_tools',
    arguments: { query: '呼叫 cartridge-system memory_audit', limit: 10 },
  });
  const cartridgeSearchText = firstText(cartridgeSearch);
  assertContains(cartridgeSearchText, 'gateway__call_tool', 'cartridge-system gateway search');
  assertContains(cartridgeSearchText, 'cartridge-system__memory_audit', 'cartridge-system gateway search');

  const cartridgeList = await client.callTool({
    name: 'gateway__list_server_tools',
    arguments: { server_name: 'cartridge-system' },
  });
  const cartridgeListText = firstText(cartridgeList);
  assertContains(cartridgeListText, 'cartridge-system 共有 12 個工具', 'cartridge-system tool count');
  assertContains(cartridgeListText, 'cartridge-system__commit_preflight', 'cartridge-system tool list');

  const badMemoryDepsCall = await client.callTool({
    name: 'gateway__call_tool',
    arguments: {
      name: 'cartridge-system__memory_deps',
      arguments: { module: '_system', projectRoot },
      workspace: projectRoot,
    },
  });
  const badMemoryDepsText = allText(badMemoryDepsCall);
  assertContains(badMemoryDepsText, 'Gateway 參數診斷', 'cartridge-system memory_deps argument diagnostics');
  assertContains(badMemoryDepsText, '收到未知參數: module', 'cartridge-system memory_deps argument diagnostics');
  assertContains(badMemoryDepsText, '疑似應改用: module -> moduleName', 'cartridge-system memory_deps argument diagnostics');

  console.log('Gateway runtime verification passed.');
} finally {
  await client.close();
}
