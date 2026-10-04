import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';

const methods = ['checkVersions', 'deleteCredential', 'getGatewayStatus', 'installMcp', 'listMcpServers', 'removeMcp', 'rescanRegistry', 'setMcpEnabled', 'switchCredential', 'updateMcp', 'upsertCredential'];
const managementModule = methods.map((method) => `export const ${method}=(...args)=>globalThis.__hostFixture.management.${method}(...args);`).join('\n');
const vscodeModule = `
export const window = {
 createOutputChannel:()=>({appendLine(){},clear(){},show(){},dispose(){}}),
 registerWebviewViewProvider:(_name,provider)=>{globalThis.__hostFixture.provider=provider;return {dispose(){}}},
 withProgress:async(_options,task)=>task(),
 showInputBox:async()=>globalThis.__hostFixture.secret,
 showWarningMessage:async(message,_options,button)=>{globalThis.__hostFixture.warnings.push(message);return globalThis.__hostFixture.confirm ? button : undefined},
 showInformationMessage:async(message)=>{globalThis.__hostFixture.information.push(message)},
 showErrorMessage:async(message)=>{globalThis.__hostFixture.errors.push(message)}
};
export const commands={registerCommand:()=>({dispose(){}})};
export const ProgressLocation={Notification:1};
export const l10n={t:(text,params={})=>text.replace(/\\{(\\w+)\\}/g,(_,key)=>String(params[key]??''))};
export const Uri={joinPath:(_base,...parts)=>parts.join('/')};
`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'vscode') return { url: 'data:text/javascript,' + encodeURIComponent(vscodeModule), shortCircuit: true };
    if (specifier.endsWith('/src/management/index.js')) return { url: 'data:text/javascript,' + encodeURIComponent(managementModule), shortCircuit: true };
    if (specifier === './extensionUpdate.js') return { url: 'data:text/javascript,' + encodeURIComponent(`export const checkExtensionUpdate=async(version)=>({status:'idle',currentVersion:version}); export const createInitialExtensionUpdateState=(version)=>({status:'idle',currentVersion:version});export const downloadExtensionVsix=async()=>{throw Error('not used')};`), shortCircuit: true };
    if (specifier.endsWith('.js') && specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const ts = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
      if (existsSync(ts)) return { url: ts.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('/src/extension.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { activate } = await import('../../src/extension.ts');
const { createFormModel } = await import('../../src/formModel.ts');
function fixture() {
  const server = { name: 'old', category: '分類', enabled: true, sourceType: 'npm', source: 'pkg@1.2.3', configPath: '/fixture/old.json',
    config: { command: 'npx', args: ['-y', '--package', 'pkg@1.2.3', '--', 'bin'], env: { TOKEN: '${TOKEN}' }, preload: true },
    requiredEnvVars: ['TOKEN'], tools: [], toolCount: 0, authStatus: 'unknown', credential: { envVar: 'TOKEN', active: 'work', accountLabels: ['work', 'personal'], accountCount: 2 } };
  const result = { server, warnings: [], information: [], errors: [], sent: [], calls: [], confirm: true, secret: 'fixture-value', management: {} };
  result.management = {
    getGatewayStatus: () => ({ packageVersion: '1.2.0', initialized: true, enabledServers: 1, totalServers: 1, totalTools: 0 }),
    listMcpServers: () => [result.server],
    updateMcp: async (input) => { result.calls.push({ method: 'update', input }); result.server = { ...result.server, name: input.nextName, category: input.category, config: input.config }; return { ok: true, committed: true, savedName: input.nextName, message: 'saved' }; },
    upsertCredential: () => { result.calls.push({ method: 'upsert' }); return { ok: true, message: 'saved' }; },
    switchCredential: (name, label) => { result.calls.push({ method: 'switch', name, label }); result.server.credential.active = label; return { ok: true, message: 'switched' }; },
    deleteCredential: () => { result.calls.push({ method: 'delete' }); delete result.server.credential; return { ok: true, message: 'deleted' }; },
    rescanRegistry: async () => ({ servers: {}, all_tools: {} }),
    setMcpEnabled: () => ({ ok: true, message: 'enabled' }),
    removeMcp: async () => ({ ok: true, message: 'removed' }),
  };
  globalThis.__hostFixture = result;
  activate({ extensionPath: '/fixture/extension', extensionUri: 'fixture:', subscriptions: [], extension: { packageJSON: { version: '0.1.3' } }, globalState: { get: () => undefined, update: async () => {} } });
  result.provider.resolveWebviewView({ webview: { cspSource: 'fixture:', asWebviewUri: String, postMessage: (message) => { result.sent.push(message); }, onDidReceiveMessage: (listener) => { result.receive = listener; } } });
  return result;
}

test('F15/F27 real host message route passes credential in the update transaction and acknowledges saved name', async () => {
  const f = fixture(); const draft = createFormModel().createEdit(f.server); draft.nextName = 'new'; draft.saveCredential = true; draft.rescan = true;
  await f.receive({ command: 'saveMcpForm', operationId: 'one', payload: createFormModel().buildPayload(draft) });
  assert.deepEqual(f.calls.map((call) => call.method), ['update']);
  assert.equal(f.calls[0].input.credential.value, 'fixture-value'); assert.equal(f.calls[0].input.rescan, true);
  const reply = f.sent.find((item) => item.command === 'formResult');
  assert.equal(reply.operationId, 'one'); assert.equal(reply.savedName, 'new'); assert.equal(reply.state.servers[0].name, 'new');
  assert.ok(reply.message.includes('Gateway 自己的 rescan/reload'));
  assert.equal(JSON.stringify(f.information).includes('fixture-value'), false);
});

test('F17 real host switches existing labels; cancelled deletion leaves store untouched', async () => {
  const f = fixture();
  await f.receive({ command: 'switchCredential', operationId: 'switch', name: 'old', label: 'personal' });
  const reply = f.sent.find((item) => item.command === 'formResult');
  assert.equal(reply.state.servers[0].credential.active, 'personal'); assert.deepEqual(f.calls, [{ method: 'switch', name: 'old', label: 'personal' }]);
  f.confirm = false;
  await f.receive({ command: 'deleteCredential', operationId: 'cancel', name: 'old' });
  assert.equal(f.calls.length, 1); assert.equal(f.sent.find((item) => item.operationId === 'cancel').ok, false);
});

test('F15/F27 real host partial scan failure reports warning and committed result', async () => {
  const f = fixture(); const draft = createFormModel().createEdit(f.server); draft.nextName = 'new';
  f.management.updateMcp = async (input) => { f.server.name = input.nextName; return { ok: false, committed: true, savedName: input.nextName, message: 'settings saved; scan failed' }; };
  await f.receive({ command: 'saveMcpForm', operationId: 'partial', payload: createFormModel().buildPayload(draft) });
  const reply = f.sent.find((item) => item.command === 'formResult');
  assert.equal(reply.committed, true); assert.equal(reply.ok, false); assert.equal(reply.savedName, 'new');
  assert.ok(f.warnings.some((message) => message.includes('scan failed')));
  assert.equal(f.information.length, 0);
});

test('F25 real host rescan shows stale service warning, not complete success', async () => {
  const f = fixture();
  f.management.rescanRegistry = async () => ({ servers: { failing: { stale: true, scan_error: 'fixture failure', tools: {} } }, all_tools: {} });
  await f.receive({ command: 'rescan' });
  assert.ok(f.warnings.some((message) => message.includes('failing'))); assert.equal(f.information.length, 0);
});

test('F27/F28 real host reconnect query recovers pending/completed results without replaying mutation', async () => {
  const f = fixture(); const draft = createFormModel().createEdit(f.server); draft.nextName = 'new'; draft.rescan = true;
  let finish; let entered;
  const ready = new Promise((resolve) => { entered = resolve; });
  f.management.updateMcp = async (input) => {
    f.calls.push({ method: 'update', input }); f.server = { ...f.server, name: input.nextName };
    entered(); await new Promise((resolve) => { finish = resolve; });
    return { ok: true, committed: true, savedName: input.nextName, message: 'saved' };
  };
  const save = f.receive({ command: 'saveMcpForm', operationId: 'rebuild', payload: createFormModel().buildPayload(draft) });
  await ready;
  const rebuiltMessages = [];
  f.provider.resolveWebviewView({ webview: { cspSource: 'fixture:', asWebviewUri: String,
    postMessage: (message) => rebuiltMessages.push(message), onDidReceiveMessage: (listener) => { f.receive = listener; } } });
  await f.receive({ command: 'getFormResult', operationId: 'rebuild' });
  assert.equal(rebuiltMessages.at(-1).command, 'formPending');
  assert.equal(rebuiltMessages.at(-1).state.servers[0].name, 'new');
  finish(); await save;
  assert.equal(rebuiltMessages.at(-1).command, 'formResult'); assert.equal(rebuiltMessages.at(-1).savedName, 'new');
  await f.receive({ command: 'getFormResult', operationId: 'rebuild' });
  assert.equal(rebuiltMessages.at(-1).command, 'formResult'); assert.equal(rebuiltMessages.at(-1).ok, true);
  assert.equal(f.calls.filter((call) => call.method === 'update').length, 1);
});

test('F27/F28 real host unknown correlation is read-only and explicitly uncertain', async () => {
  const f = fixture();
  await f.receive({ command: 'getFormResult', operationId: 'previous-host-operation' });
  const reply = f.sent.find((item) => item.command === 'formResult');
  assert.equal(reply.ok, false); assert.equal(reply.outcomeUnknown, true); assert.equal(f.calls.length, 0);
});
