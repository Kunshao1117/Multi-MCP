import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Only adapt module resolution and vscode's URI formatting. Production functions run unchanged.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'vscode') return { url: 'data:text/javascript,export const Uri={joinPath:(_base,...parts)=>parts.join("/")};', shortCircuit: true };
    if (specifier.endsWith('.js') && specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const ts = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
      if (existsSync(ts)) return { url: ts.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { createFormModel } = await import('../../src/formModel.ts');
const { submitMcpForm, FormRequestGate } = await import('../../src/formOperations.ts');
const { renderDashboardHtml } = await import('../../src/webview.ts');
const { DEFAULT_MCP_SEEDS } = await import('../../../../src/paths.ts');
const model = createFormModel();
const clone = (value) => JSON.parse(JSON.stringify(value));
function server(config, extra = {}) {
  return { name: 'original', category: '原分類', enabled: true, sourceType: 'npm', source: '@scope/pkg@1.2.3',
    config: clone(config), requiredEnvVars: [], tools: [], toolCount: 0, authStatus: 'unknown', configPath: '/fixture/mcp.json', ...extra };
}

for (const seed of DEFAULT_MCP_SEEDS) {
  for (const edit of ['none', 'rename', 'category']) {
    test(`F03/F04 seed ${seed.name}: ${edit} preserves exact config`, () => {
      const original = server(seed.config, { name: seed.name, category: seed.category });
      const draft = model.createEdit(original);
      if (edit === 'rename') draft.nextName = 'new-name';
      if (edit === 'category') draft.category = '新分類';
      const payload = model.buildPayload(draft);
      assert.deepEqual(model.configFromPayload(payload, original.config), seed.config);
      assert.deepEqual(payload.editedFields, []);
    });
  }
}

for (const sourceType of ['npm', 'remote', 'custom', 'json']) {
  test(`F03/F04 ${sourceType} retains env/preload/empty and whitespace args/extension fields`, () => {
    const config = { command: 'custom-npx', args: ['', '  padded  ', '\n', '--header', 'Authorization: literal-fixture'], env: { EMPTY: '', TOKEN: '${TOKEN}', EXTRA: 'fixture-literal' }, preload: true, extraFutureField: { enabled: false } };
    const original = server(config, { sourceType: sourceType === 'json' ? 'custom' : sourceType });
    const form = model.createEdit(original);
    form.nextName = 'renamed'; form.category = '不同分類';
    if (sourceType === 'json') form.sourceMode = 'json';
    assert.deepEqual(model.configFromPayload(model.buildPayload(form), original.config), config);
    if (sourceType !== 'json') {
      form.command = 'another-command';
      const changed = model.configFromPayload(model.buildPayload(form), original.config);
      assert.deepEqual(changed, { ...config, command: 'another-command' });
    }
  });
}

test('F03 partial edits retain current, non-edited config fields rather than stale draft fields', () => {
  const original = server({ command: 'node', args: ['original'], env: { X: 'old' }, preload: false });
  const draft = model.createEdit(original); draft.category = 'moved';
  const current = { ...original.config, args: ['externally-updated'], env: { X: 'new' } };
  assert.deepEqual(model.configFromPayload(model.buildPayload(draft), current), current);
});

for (const source of ['pkg@1.2.3', 'pkg@next', 'pkg@^2', '@scope/pkg@~1.2', '@scope/pkg@beta', 'gitnexus@1.6.5']) {
  test(`F04 source default retains explicit package specification ${source}`, () => {
    const draft = model.createInstall('npm'); draft.source = source; model.applySourceDefaults(draft);
    assert.deepEqual(model.buildPayload(draft).args, ['-y', source]);
  });
}

test('F04 args JSON preserves empty strings, embedded newlines and whitespace on actual edits', () => {
  const draft = model.createInstall('custom'); draft.argsText = JSON.stringify(['', ' a ', 'a\nb', '\t']);
  assert.deepEqual(model.buildPayload(draft).args, ['', ' a ', 'a\nb', '\t']);
  draft.argsText = '[4]'; assert.throws(() => model.buildPayload(draft), /JSON 字串陣列/);
});

test('F03 JSON import rejects lossy coercion and retains future legal fields', () => {
  for (const invalid of [{ command: 'x', args: [1] }, { command: 'x', args: [], env: { X: 42 } }, { command: 'x', args: [], preload: 'yes' }]) {
    assert.throws(() => model.parseJson(JSON.stringify(invalid)));
  }
  const config = { command: 'x', args: [], future: { keep: true } };
  assert.deepEqual(model.parseJson(JSON.stringify(config)), config);
});

test('F15 submit passes rename, full config and credential to ONE update before scan', async () => {
  const original = server({ command: 'node', args: ['x'], env: { TOKEN: '${TOKEN}' }, preload: true });
  const draft = model.createEdit(original); draft.nextName = 'new'; draft.category = 'moved';
  draft.saveCredential = true; draft.credentialEnvVar = 'TOKEN'; draft.rescan = true;
  const calls = [];
  const result = await submitMcpForm(model.buildPayload(draft), {
    listServers: () => [original], collectCredential: async () => { calls.push('secret'); return { envVar: 'TOKEN', label: 'default', value: 'fixture-secret' }; },
    confirmEdit: async () => { calls.push('confirm'); return true; }, confirmOverwrite: async () => false,
    install: async () => { throw new Error('wrong operation'); },
    update: async (input) => {
      calls.push('transaction'); assert.equal(input.currentName, 'original'); assert.equal(input.nextName, 'new');
      assert.equal(input.credential.value, 'fixture-secret'); assert.deepEqual(input.config, original.config); assert.equal(input.rescan, true);
      return { ok: true, committed: true, savedName: 'new', message: 'saved' };
    },
  });
  assert.deepEqual(calls, ['secret', 'confirm', 'transaction']); assert.equal(result.savedName, 'new');
});

test('F15 cancellation performs no mutation; failed scan keeps committed/savedName result', async () => {
  const original = server({ command: 'node', args: [] }); const draft = model.createEdit(original); draft.nextName = 'renamed';
  const services = { listServers: () => [original], collectCredential: async () => undefined, confirmEdit: async () => false,
    confirmOverwrite: async () => false, install: async () => { throw Error('must not mutate'); }, update: async () => { throw Error('must not mutate'); } };
  assert.equal((await submitMcpForm(model.buildPayload(draft), services)).ok, false);
  const scanFailure = { ok: false, committed: true, savedName: 'renamed', message: 'saved, scan failed' };
  services.confirmEdit = async () => true; services.update = async () => scanFailure;
  assert.deepEqual(await submitMcpForm(model.buildPayload(draft), services), scanFailure);
});

test('F27 success rebases rename; failure preserves draft; stale operation cannot reset newer draft', () => {
  const original = server({ command: 'node', args: [] }); const draft = model.createEdit(original); draft.nextName = 'new';
  const pending = { operationId: 'one', draftId: draft.draftId };
  assert.equal(model.settle(draft, pending, { operationId: 'one', ok: false }, [original]), draft);
  assert.equal(model.settle(draft, pending, { operationId: 'older', ok: true }, []), draft);
  const next = model.settle(draft, pending, { operationId: 'one', ok: true, savedName: 'new' }, [{ ...original, name: 'new' }]);
  assert.equal(next.currentName, 'new'); assert.equal(model.buildPayload(next).currentName, 'new');
  const newer = model.createEdit(original);
  assert.equal(model.settle(newer, pending, { operationId: 'one', ok: true }, []), newer);
  const partial = model.settle(draft, pending, { operationId: 'one', ok: false, committed: true, savedName: 'new' }, [{ ...original, name: 'new' }]);
  assert.equal(partial.currentName, 'new');
});

test('F27 host gate invokes mutation once for simultaneous duplicate and replayed requests', async () => {
  const gate = new FormRequestGate(); let release; let count = 0;
  const task = async () => { count++; await new Promise((resolve) => { release = resolve; }); return { ok: true, message: 'saved' }; };
  const first = gate.run('one', task);
  assert.equal(await gate.run('one', task), undefined);
  assert.equal((await gate.run('two', task)).ok, false);
  release(); assert.equal((await first).ok, true);
  assert.equal((await gate.run('one', task)).ok, true); assert.equal(count, 1);
});

test('F28 persistence is an allowlist; nested config/env/source/header/args secrets never survive', () => {
  const sentinel = 'DO_NOT_PERSIST_FIXTURE';
  const original = server({ command: sentinel, args: [sentinel, '--header', sentinel], env: { KEY: sentinel }, preload: true }, { source: 'https://example.test/?token=' + sentinel });
  const draft = model.createEdit(original); draft.nextName = 'renamed'; draft.category = '分類'; draft.argsText = JSON.stringify([sentinel, 'changed']);
  const saved = model.persist(draft); assert.equal(JSON.stringify(saved).includes(sentinel), false);
  assert.equal(saved.sensitiveDraftLost, true);
  const restored = model.restore(JSON.parse(JSON.stringify(saved)), [original]);
  assert.equal(restored.form.nextName, 'renamed'); assert.equal(restored.form.category, '分類');
  assert.throws(() => model.buildPayload(restored.form), /重新輸入/);
  assert.equal(model.restore(saved, []).form, null);
  assert.equal(model.persist(null), null);
});

test('F28 metadata-only drafts resume safely without losing secret-bearing original config', () => {
  const original = server({ command: 'node', args: [''], env: { X: 'fixture-secret' }, preload: true });
  const draft = model.createEdit(original); draft.nextName = 'renamed';
  const restored = model.restore(model.persist(draft), [original]).form;
  assert.equal(restored.sensitiveDraftLost, false);
  assert.deepEqual(model.configFromPayload(model.buildPayload(restored), original.config), original.config);
});

test('F17/F29 account labels and active account remain distinct, multi-env input rejected', () => {
  const original = server({ command: 'node', args: [] }, { credential: { envVar: 'TOKEN', active: 'work', accountLabels: ['work', 'personal'], accountCount: 2 } });
  const draft = model.createCredential(original);
  assert.deepEqual(draft.accountLabels, ['work', 'personal']); assert.equal(draft.activeLabel, 'work'); assert.equal(draft.credentialLocked, true);
  const edit = model.createEdit(original); edit.saveCredential = true; edit.credentialEnvVar = 'ONE\nTWO';
  assert.throws(() => model.buildPayload(edit), /單一/);
});

function runtime(initialServer, saved) {
  const status = { initialized: true, packageVersion: '1.2.0', enabledServers: 1, totalServers: 1, totalTools: 0 };
  const html = renderDashboardHtml({ cspSource: 'fixture:', asWebviewUri: String }, 'fixture:', { status, servers: [initialServer], extensionVersion: '0.1.3' });
  const script = html.slice(html.lastIndexOf('<script nonce='));
  const source = script.slice(script.indexOf('>') + 1, script.indexOf('</script>'));
  const bodyListeners = new Map(); const windowListeners = new Map(); const fields = new Map();
  const root = { innerHTML: '' }; const messages = []; let persisted = saved;
  const context = vm.createContext({ URL, console,
    acquireVsCodeApi: () => ({ getState: () => saved, setState: (state) => { persisted = clone(state); }, postMessage: (message) => messages.push(clone(message)) }),
    document: { body: { addEventListener: (name, listener) => bodyListeners.set(name, listener) }, getElementById: (name) => name === 'root' ? root : fields.get(name), querySelectorAll: () => [], querySelector: () => null },
    window: { addEventListener: (name, listener) => windowListeners.set(name, listener) },
  });
  vm.runInContext(source, context);
  return { context, fields, root, messages, persisted: () => persisted,
    click(command, extra = {}) { const button = { dataset: { command, ...extra }, disabled: false }; bodyListeners.get('click')({ target: { closest: (selector) => selector === 'button[data-command]' ? button : null } }); },
    input(id, value) { fields.set(id, { value }); bodyListeners.get('input')({ target: { id, closest: () => true } }); },
    reply(data) { windowListeners.get('message')({ data }); },
  };
}

test('F04/F27/F28 actual generated webview runs, keeps args on name input and posts once on double-click', () => {
  const original = server({ command: 'npx', args: ['-y', '--package', 'pkg@1.2.3', '--', 'bin', '', ' padded '], env: { SECRET: 'fixture-secret' }, preload: true });
  const ui = runtime(original);
  ui.click('openEditForm', { name: original.name });
  ui.input('mcp-name', 'renamed');
  ui.click('saveMcpForm'); ui.click('saveMcpForm');
  assert.equal(ui.messages.length, 1);
  assert.deepEqual(ui.messages[0].payload.args, original.config.args);
  assert.equal(JSON.stringify(ui.persisted()).includes('fixture-secret'), false);
  const message = ui.messages[0];
  ui.reply({ command: 'state', state: { status: {}, servers: [{ ...original, name: 'renamed' }] } });
  assert.equal(vm.runInContext('activeForm.currentName', ui.context), 'original');
  ui.reply({ command: 'formResult', operationId: message.operationId, ok: true, savedName: 'renamed', state: { status: {}, servers: [{ ...original, name: 'renamed' }] } });
  assert.equal(vm.runInContext('activeForm.currentName', ui.context), 'renamed');
  assert.equal(vm.runInContext('pending', ui.context), null);
  ui.click('cancelMcpForm'); assert.equal(ui.persisted().draft, null);
});

test('F28 actual generated webview restores a metadata draft on reconstruction', () => {
  const original = server({ command: 'node', args: ['--header', 'literal-secret'], preload: false });
  const first = runtime(original); first.click('openEditForm', { name: original.name }); first.input('mcp-name', 'draft-name');
  const second = runtime(original, first.persisted());
  assert.equal(vm.runInContext('activeForm.nextName', second.context), 'draft-name');
  assert.equal(vm.runInContext('activeForm.argsText', second.context), JSON.stringify(original.config.args, null, 2));
});

test('F21 core source version ignores extension package-root environment', async () => {
  const { getCoreVersion } = await import('../../../../src/version.ts');
  const root = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'));
  const old = process.env.MULTI_MCP_PACKAGE_ROOT;
  process.env.MULTI_MCP_PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
  try { assert.equal(getCoreVersion(), root.version); }
  finally { if (old === undefined) delete process.env.MULTI_MCP_PACKAGE_ROOT; else process.env.MULTI_MCP_PACKAGE_ROOT = old; }
});

test('F21 injected bundled-core value takes precedence and stays distinct from extension version', async () => {
  const { getCoreVersion } = await import('../../../../src/version.ts');
  const root = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'));
  const extension = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  globalThis.__MULTI_MCP_CORE_VERSION__ = root.version;
  try { assert.equal(getCoreVersion(), root.version); assert.notEqual(getCoreVersion(), extension.version); }
  finally { delete globalThis.__MULTI_MCP_CORE_VERSION__; }
});

test('F17 actual generated webview account selector posts selected label and rebases active summary', () => {
  const original = server({ command: 'node', args: [] }, { credential: { envVar: 'TOKEN', active: 'work', accountLabels: ['work', 'personal'], accountCount: 2 } });
  const ui = runtime(original); ui.click('openCredentialPanel', { name: original.name });
  ui.fields.set('credential-active', { value: 'personal' });
  ui.fields.set('credential-env', { value: 'TOKEN' }); ui.fields.set('credential-label', { value: 'work' });
  ui.click('switchCredential');
  assert.equal(ui.messages[0].command, 'switchCredential'); assert.equal(ui.messages[0].label, 'personal');
  const current = { ...original, credential: { ...original.credential, active: 'personal' } };
  ui.reply({ command: 'formResult', operationId: ui.messages[0].operationId, ok: true, savedName: original.name, state: { status: {}, servers: [current] } });
  assert.equal(vm.runInContext('activeForm.activeLabel', ui.context), 'personal');
});

test('F27/F28 rebuild during rename retains pending correlation, accepts ack and prevents resubmission', () => {
  const original = server({ command: 'node', args: ['--header', 'fixture-never-persist'], env: { SECRET: 'fixture-never-persist' } });
  const first = runtime(original);
  first.click('openEditForm', { name: original.name }); first.input('mcp-name', 'renamed'); first.click('saveMcpForm');
  const request = first.messages[0]; const persisted = first.persisted();
  assert.equal(persisted.pending.operationId, request.operationId);
  assert.equal(persisted.pending.draftId, persisted.draft.draftId);
  assert.equal(JSON.stringify(persisted).includes('fixture-never-persist'), false);
  const rebuilt = runtime(original, persisted);
  assert.deepEqual(rebuilt.messages, [{ command: 'getFormResult', operationId: request.operationId }]);
  assert.equal(vm.runInContext('pending.operationId', rebuilt.context), request.operationId);
  rebuilt.click('saveMcpForm'); rebuilt.click('saveMcpForm');
  assert.equal(rebuilt.messages.length, 1, 'restored pending must not replay the mutation');
  const nextState = { status: {}, servers: [{ ...original, name: 'renamed' }] };
  rebuilt.reply({ command: 'formResult', operationId: request.operationId, ok: true, savedName: 'renamed', state: nextState });
  assert.equal(vm.runInContext('activeForm.currentName', rebuilt.context), 'renamed');
  assert.equal(vm.runInContext('state.servers[0].name', rebuilt.context), 'renamed');
  assert.equal(vm.runInContext('pending', rebuilt.context), null);
  assert.equal(rebuilt.persisted().pending, null);
  rebuilt.click('saveMcpForm');
  assert.equal(rebuilt.messages[1].payload.currentName, 'renamed');
  assert.notEqual(rebuilt.messages[1].operationId, request.operationId);
});

test('F27/F28 rebuild after rename already committed retains shell until completed or partial ack', () => {
  for (const ok of [true, false]) {
    const original = server({ command: 'node', args: ['value'] }); const renamed = { ...original, name: 'renamed' };
    const first = runtime(original); first.click('openEditForm', { name: original.name }); first.input('mcp-name', renamed.name); first.click('saveMcpForm');
    const request = first.messages[0];
    const rebuilt = runtime(renamed, first.persisted());
    assert.equal(vm.runInContext('activeForm.currentName', rebuilt.context), original.name);
    assert.equal(vm.runInContext('pending.operationId', rebuilt.context), request.operationId);
    rebuilt.reply({ command: 'formPending', operationId: request.operationId, state: { status: {}, servers: [renamed] } });
    rebuilt.reply({ command: 'formResult', operationId: request.operationId, ok, committed: true, savedName: renamed.name, state: { status: {}, servers: [renamed] } });
    assert.equal(vm.runInContext('activeForm.currentName', rebuilt.context), renamed.name);
    assert.equal(vm.runInContext('activeForm.argsText', rebuilt.context), JSON.stringify(original.config.args, null, 2));
    assert.equal(vm.runInContext('pending', rebuilt.context), null);
  }
});

test('F27/F28 restored failed request retains draft; later retry has fresh id; old ack cannot replace newer draft', () => {
  const original = server({ command: 'node', args: [] }); const first = runtime(original);
  first.click('openEditForm', { name: original.name }); first.input('mcp-name', 'rename-draft'); first.click('saveMcpForm');
  const request = first.messages[0]; const rebuilt = runtime(original, first.persisted());
  rebuilt.reply({ command: 'formResult', operationId: request.operationId, ok: false, state: { status: {}, servers: [original] } });
  assert.equal(vm.runInContext('activeForm.nextName', rebuilt.context), 'rename-draft');
  assert.equal(vm.runInContext('pending', rebuilt.context), null);
  rebuilt.click('saveMcpForm'); const retry = rebuilt.messages[1];
  assert.notEqual(retry.operationId, request.operationId);
  rebuilt.reply({ command: 'formResult', operationId: request.operationId, ok: true, savedName: 'wrong-old-name', state: { status: {}, servers: [] } });
  assert.equal(vm.runInContext('activeForm.nextName', rebuilt.context), 'rename-draft');
  assert.equal(vm.runInContext('pending.operationId', rebuilt.context), retry.operationId);
  assert.equal(vm.runInContext('state.servers[0].name', rebuilt.context), original.name);
});

test('F27/F28 lost host history clears uncertain draft without replay and preserves current state', () => {
  const original = server({ command: 'node', args: [] }); const first = runtime(original);
  first.click('openEditForm', { name: original.name }); first.click('saveMcpForm');
  const request = first.messages[0]; const rebuilt = runtime(original, first.persisted());
  rebuilt.reply({ command: 'formResult', operationId: request.operationId, ok: false, outcomeUnknown: true, state: { status: {}, servers: [original] }, message: 'Please review current settings' });
  assert.equal(vm.runInContext('activeForm', rebuilt.context), null);
  assert.equal(vm.runInContext('pending', rebuilt.context), null);
  assert.equal(rebuilt.messages.length, 1);
  assert.equal(rebuilt.persisted().draft, null);
});

test('F28 pending persistence drops extra fields and mismatched draft IDs', () => {
  const original = server({ command: 'node', args: [] }); const draft = model.createEdit(original);
  const pending = { draftId: draft.draftId, operationId: model.newOperationId(draft), payload: { secret: 'excluded' } };
  assert.deepEqual(Object.keys(model.persistPending(pending, draft)).sort(), ['draftId', 'operationId']);
  assert.equal(model.persistPending({ ...pending, draftId: 'different' }, draft), null);
  assert.equal(model.restore(model.persist(draft), [original], { ...pending, draftId: 'different' }).pending, null);
});
