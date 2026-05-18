/**
 * 下游 MCP 子程序環境清理。
 *
 * Gateway 可能本身是由 npm/npx 啟動；若直接把外層 npm lifecycle 環境傳給
 * 內層 npx，Windows 會把 scoped package（例如 @upstash/...）交給 cmd 誤解析。
 */
export function createDownstreamEnv(
  extraEnv: Record<string, string> = {},
  baseEnv: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (typeof value !== 'string') continue;
    if (shouldStripNpmRuntimeEnv(key)) continue;
    env[key] = value;
  }

  if (platform === 'win32') {
    env.COMSPEC = baseEnv.SystemRoot
      ? `${baseEnv.SystemRoot}\\System32\\cmd.exe`
      : 'C:\\Windows\\System32\\cmd.exe';
    delete env.SHELL;
  }

  return { ...env, ...extraEnv };
}

function shouldStripNpmRuntimeEnv(key: string): boolean {
  const lower = key.toLowerCase();
  return lower === 'npm_config_script_shell'
    || lower === 'npm_execpath'
    || lower === 'npm_node_execpath'
    || lower === 'npm_command'
    || lower.startsWith('npm_lifecycle_')
    || lower.startsWith('npm_package_');
}
