import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  delete process.env.ELECTRON_RUN_AS_NODE;
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const extensionDevelopmentPath = resolve(__dirname, '..', '..');
  const extensionTestsPath = resolve(__dirname, 'suite', 'index.js');
  await runTests({ extensionDevelopmentPath, extensionTestsPath });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
