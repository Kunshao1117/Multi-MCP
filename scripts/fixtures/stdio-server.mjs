// Hermetic MCP fixture. Never accesses the network or a user's account.
import readline from 'node:readline';
const input = readline.createInterface({ input: process.stdin });
const tools = [
  { name: 'echo', description: 'Return text without undeclared arguments', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } },
  { name: 'workspace', description: 'Return the child process working directory', inputSchema: { type: 'object', properties: { projectRoot: { type: 'string' } }, required: ['projectRoot'], additionalProperties: false } },
];
input.on('line', (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  let result;
  if (request.method === 'initialize') result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'hermetic-fixture', version: '1.0.0' } };
  else if (request.method === 'tools/list') result = request.params?.cursor ? { tools: tools.slice(1) } : { tools: tools.slice(0, 1), nextCursor: 'second' };
  else if (request.method === 'tools/call') {
    const { name, arguments: args = {} } = request.params;
    const tool = tools.find((entry) => entry.name === name);
    const valid = tool && Object.keys(args).every((key) => key in tool.inputSchema.properties) && tool.inputSchema.required.every((key) => typeof args[key] === 'string');
    result = valid
      ? { content: [{ type: 'text', text: name === 'workspace' ? JSON.stringify({ cwd: process.cwd(), projectRoot: args.projectRoot }) : args.text }] }
      : { isError: true, content: [{ type: 'text', text: 'Schema validation error' }] };
  } else if (request.method === 'ping') result = {};
  else { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } }) + '\n'); return; }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
});
