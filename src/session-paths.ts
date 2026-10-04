import { dirname, resolve } from 'node:path';
import { getGatewayPaths, type GatewayPaths } from './paths.js';

/** Resolve once before chdir; all reloads and scans retain this session's source. */
export function resolveSessionPaths(args: string[], startupCwd: string): GatewayPaths {
  const argument = args.find((arg) => arg.startsWith('--config='));
  if (argument === undefined) return getGatewayPaths();
  const value = argument.slice('--config='.length);
  if (!value.trim()) throw new Error('--config requires a file path');
  const configPath = resolve(startupCwd, value);
  return { ...getGatewayPaths(dirname(configPath)), configPath };
}
