import { createHash } from 'node:crypto';
import * as vscode from 'vscode';

const OWNER = 'Kunshao1117';
const REPO = 'Multi-MCP';
const TAG_PREFIX = 'vscode-multi-mcp-manager-v';
const ASSET_PREFIX = 'vscode-multi-mcp-manager-';
const LATEST_RELEASE_URL = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;

export type ExtensionUpdateStatus =
  | 'idle'
  | 'current'
  | 'updateAvailable'
  | 'assetMissing'
  | 'error';

export interface ExtensionUpdateState {
  status: ExtensionUpdateStatus;
  currentVersion: string;
  checkedAt?: string;
  latestVersion?: string;
  releaseName?: string;
  releaseUrl?: string;
  assetName?: string;
  assetUrl?: string;
  assetDigest?: string;
  error?: string;
}

interface GitHubRelease {
  tag_name?: string;
  name?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

interface GitHubReleaseAsset {
  name?: string;
  browser_download_url?: string;
  digest?: string;
}

export function createInitialExtensionUpdateState(currentVersion: string): ExtensionUpdateState {
  return { status: 'idle', currentVersion };
}

export async function checkExtensionUpdate(currentVersion: string): Promise<ExtensionUpdateState> {
  const checkedAt = new Date().toISOString();
  try {
    const release = await fetchLatestRelease();
    const latestVersion = parseReleaseVersion(release.tag_name);
    if (!latestVersion) {
      return failure(currentVersion, checkedAt, 'Latest release tag is not a Multi-MCP Manager extension tag.');
    }

    const base = {
      currentVersion,
      checkedAt,
      latestVersion,
      releaseName: release.name,
      releaseUrl: release.html_url,
    };

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      return { ...base, status: 'current' };
    }

    const asset = findVsixAsset(release.assets ?? [], latestVersion);
    if (!asset?.browser_download_url || !asset.name) {
      return { ...base, status: 'assetMissing' };
    }

    return {
      ...base,
      status: 'updateAvailable',
      assetName: asset.name,
      assetUrl: asset.browser_download_url,
      assetDigest: asset.digest,
    };
  } catch (error) {
    return failure(currentVersion, checkedAt, (error as Error).message);
  }
}

export async function downloadExtensionVsix(
  update: ExtensionUpdateState,
  storageUri: vscode.Uri,
): Promise<vscode.Uri> {
  if (update.status !== 'updateAvailable' || !update.assetUrl || !update.assetName) {
    throw new Error('No installable VSIX asset is available for this update.');
  }

  const response = await fetch(update.assetUrl, {
    headers: { 'User-Agent': 'Multi-MCP-Manager' },
  });
  if (!response.ok) throw new Error(`VSIX download failed: HTTP ${response.status}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  verifySha256(bytes, update.assetDigest);

  const updatesDir = vscode.Uri.joinPath(storageUri, 'updates');
  await vscode.workspace.fs.createDirectory(updatesDir);
  const target = vscode.Uri.joinPath(updatesDir, update.assetName.replace(/[\\/]/g, '-'));
  await vscode.workspace.fs.writeFile(target, bytes);
  return target;
}

function failure(currentVersion: string, checkedAt: string, error: string): ExtensionUpdateState {
  return { status: 'error', currentVersion, checkedAt, error };
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(LATEST_RELEASE_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Multi-MCP-Manager',
    },
  });
  if (!response.ok) throw new Error(`GitHub latest release check failed: HTTP ${response.status}`);
  return await response.json() as GitHubRelease;
}

function parseReleaseVersion(tagName?: string): string | undefined {
  if (!tagName?.startsWith(TAG_PREFIX)) return undefined;
  const version = tagName.slice(TAG_PREFIX.length);
  return parseVersion(version) ? version : undefined;
}

function findVsixAsset(assets: GitHubReleaseAsset[], version: string): GitHubReleaseAsset | undefined {
  const exact = `${ASSET_PREFIX}${version}.vsix`;
  return assets.find((asset) => asset.name === exact);
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function parseVersion(version: string): [number, number, number] | undefined {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function verifySha256(bytes: Uint8Array, digest?: string): void {
  const expected = digest?.match(/^sha256:([a-f0-9]{64})$/i)?.[1].toLowerCase();
  if (!expected) return;
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) throw new Error('Downloaded VSIX failed SHA256 verification.');
}
