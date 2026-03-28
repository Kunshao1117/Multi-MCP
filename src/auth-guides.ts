/**
 * Multi-MCP Gateway — 認證指南資料庫
 * 為每種常見 MCP 提供人類可讀的授權操作指引
 */
import type { AuthGuide } from './types.js';

/**
 * 已知 MCP 的認證指南
 * 可根據實際使用的 MCP 持續擴充
 */
const KNOWN_GUIDES: Record<string, AuthGuide> = {
  supabase: {
    serverName: 'supabase',
    authType: 'env_token',
    requiredEnvVars: ['SUPABASE_ACCESS_TOKEN'],
    steps: [
      '1. 前往 Supabase Dashboard → Account → Access Tokens',
      '2. 點擊 "Generate new token"',
      '3. 複製產生的 Token',
      '4. 貼到 gateway.env 的 SUPABASE_ACCESS_TOKEN= 後面',
      '5. 呼叫 gateway__reload_server 重新載入即可生效',
    ],
    docsUrl: 'https://supabase.com/dashboard/account/tokens',
  },

  'cloudflare-bindings': {
    serverName: 'cloudflare-bindings',
    authType: 'env_token',
    requiredEnvVars: ['CLOUDFLARE_API_TOKEN'],
    steps: [
      '1. 前往 Cloudflare Dashboard → My Profile → API Tokens',
      '2. 點擊 "Create Token"',
      '3. 選擇適當權限（建議使用 "Edit Cloudflare Workers" 範本）',
      '4. 複製產生的 Token',
      '5. 貼到 gateway.env 的 CLOUDFLARE_API_TOKEN= 後面',
      '6. 呼叫 gateway__reload_server 重新載入即可生效',
    ],
    docsUrl: 'https://dash.cloudflare.com/profile/api-tokens',
  },

  'cloudflare-containers': {
    serverName: 'cloudflare-containers',
    authType: 'env_token',
    requiredEnvVars: ['CLOUDFLARE_API_TOKEN'],
    steps: [
      '1. 與 cloudflare-bindings 共用同一組 API Token',
      '2. 若已設定 cloudflare-bindings，無需重複設定',
      '3. 呼叫 gateway__reload_server 重新載入即可生效',
    ],
    docsUrl: 'https://dash.cloudflare.com/profile/api-tokens',
  },

  'cloudflare-observability': {
    serverName: 'cloudflare-observability',
    authType: 'env_token',
    requiredEnvVars: ['CLOUDFLARE_API_TOKEN'],
    steps: [
      '1. 與 cloudflare-bindings 共用同一組 API Token',
      '2. 若已設定 cloudflare-bindings，無需重複設定',
      '3. 呼叫 gateway__reload_server 重新載入即可生效',
    ],
    docsUrl: 'https://dash.cloudflare.com/profile/api-tokens',
  },

  stitch: {
    serverName: 'stitch',
    authType: 'oauth_browser',
    requiredEnvVars: [],
    steps: [
      '1. 在終端機中直接執行 Stitch MCP 的啟動指令',
      '2. 瀏覽器會自動開啟 Google 登入頁面',
      '3. 完成授權後，Token 會自動儲存到本地',
      '4. Gateway 下次啟動 Stitch MCP 時會自動使用新 Token',
    ],
  },

  github: {
    serverName: 'github',
    authType: 'env_token',
    requiredEnvVars: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    steps: [
      '1. 前往 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)',
      '2. 點擊 "Generate new token" → "Generate new token (classic)"',
      '3. 設定 Token 名稱、過期時間，並勾選需要的權限範圍（建議勾選 repo、read:org）',
      '4. 複製產生的 Token（以 ghp_ 開頭，離開頁面後無法再查看）',
      '5. 貼到 gateway.env 的 GITHUB_PERSONAL_ACCESS_TOKEN= 後面',
      '6. 呼叫 gateway__reload_server 重新載入即可生效',
    ],
    docsUrl: 'https://github.com/settings/tokens',
  },

  sentry: {
    serverName: 'sentry',
    authType: 'env_token',
    requiredEnvVars: ['SENTRY_AUTH_TOKEN'],
    steps: [
      '1. 前往 Sentry Dashboard → Settings → Auth Tokens',
      '2. 點擊 "Create New Token"',
      '3. 權限範圍選擇：org:read、project:read、event:read',
      '4. 複製產生的 Token（以 sntryu_ 開頭）',
      '5. 貼到 gateway.env 的 SENTRY_AUTH_TOKEN= 後面',
      '6. 呼叫 gateway__reload_server 重新載入即可生效',
    ],
    docsUrl: 'https://sentry.io/settings/auth-tokens/',
  },

  playwright: {
    serverName: 'playwright',
    authType: 'none',
    requiredEnvVars: [],
    steps: [
      '1. Playwright MCP 無需認證，安裝後自動生效',
      '2. 首次使用時會自動下載 Chromium 瀏覽器',
    ],
    docsUrl: 'https://github.com/microsoft/playwright-mcp',
  },

  a11y: {
    serverName: 'a11y',
    authType: 'none',
    requiredEnvVars: [],
    steps: [
      '1. A11y MCP 無需認證，安裝後自動生效',
      '2. 使用 axe-core 引擎自動分析網頁無障礙合規性',
    ],
    docsUrl: 'https://github.com/nicobailey/a11y-mcp',
  },
};

/**
 * 取得指定伺服器的認證指南
 * 如果不在已知清單中，回傳通用指南
 */
export function getAuthGuide(serverName: string, envVars?: Record<string, string>): AuthGuide {
  const known = KNOWN_GUIDES[serverName];
  if (known) return known;

  // 通用指南：從設定檔推斷需要的環境變數
  const requiredEnvVars = envVars
    ? Object.values(envVars)
        .filter((v) => v.startsWith('${') && v.endsWith('}'))
        .map((v) => v.slice(2, -1))
    : [];

  return {
    serverName,
    authType: requiredEnvVars.length > 0 ? 'env_token' : 'unknown',
    requiredEnvVars,
    steps: requiredEnvVars.length > 0
      ? [
          `1. 取得 ${serverName} 所需的 API Token 或密鑰`,
          `2. 在 gateway.env 中設定以下環境變數: ${requiredEnvVars.join(', ')}`,
          '3. 呼叫 gateway__reload_server 重新載入',
        ]
      : [
          `1. 請參考 ${serverName} 的官方文件取得認證資訊`,
          '2. 按照文件指示完成授權',
          '3. 如使用環境變數，請更新 gateway.env',
        ],
  };
}

/**
 * 檢查指定伺服器的認證環境變數是否已設定
 */
export function checkEnvVarsConfigured(serverName: string, envConfig?: Record<string, string>): {
  configured: boolean;
  missing: string[];
} {
  const guide = getAuthGuide(serverName, envConfig);
  const missing = guide.requiredEnvVars.filter((v) => !process.env[v]);
  return { configured: missing.length === 0, missing };
}

// ─── 安裝提示系統（供 CLI 主控台使用）───

/** 安裝時的認證配置提示 */
export interface InstallHint {
  /** npm 套件名或 URL 的關鍵字（用於自動辨識） */
  packageKeywords: string[];
  /** Token 如何傳遞到 MCP */
  tokenPassMethod: 'arg' | 'env' | 'header' | 'none';
  /** 命令參數名稱（tokenPassMethod='arg' 時使用） */
  argFlag?: string;
  /** Header 格式模板（tokenPassMethod='header' 時使用） */
  headerTemplate?: string;
  /** 環境變數名稱 */
  envVar: string;
  /** 友善的 Token 欄位名（顯示給使用者看的） */
  tokenLabel: string;
  /** 取得 Token 的網址 */
  tokenUrl?: string;
}

/** 已知 MCP 的安裝提示資料庫 */
const KNOWN_INSTALL_HINTS: Record<string, InstallHint> = {
  supabase: {
    packageKeywords: ['supabase', 'mcp-server-supabase'],
    tokenPassMethod: 'arg',
    argFlag: '--access-token',
    envVar: 'SUPABASE_ACCESS_TOKEN',
    tokenLabel: 'Access Token',
    tokenUrl: 'https://supabase.com/dashboard/account/tokens',
  },
  'cloudflare-bindings': {
    packageKeywords: ['bindings.mcp.cloudflare'],
    tokenPassMethod: 'env',
    envVar: 'CLOUDFLARE_API_TOKEN',
    tokenLabel: 'Cloudflare API Token',
    tokenUrl: 'https://dash.cloudflare.com/profile/api-tokens',
  },
  'cloudflare-containers': {
    packageKeywords: ['containers.mcp.cloudflare'],
    tokenPassMethod: 'env',
    envVar: 'CLOUDFLARE_API_TOKEN',
    tokenLabel: 'Cloudflare API Token',
    tokenUrl: 'https://dash.cloudflare.com/profile/api-tokens',
  },
  'cloudflare-observability': {
    packageKeywords: ['observability.mcp.cloudflare'],
    tokenPassMethod: 'env',
    envVar: 'CLOUDFLARE_API_TOKEN',
    tokenLabel: 'Cloudflare API Token',
    tokenUrl: 'https://dash.cloudflare.com/profile/api-tokens',
  },
  stitch: {
    packageKeywords: ['stitch', 'stitch.googleapis'],
    tokenPassMethod: 'header',
    headerTemplate: 'X-Goog-Api-Key: ${STITCH_API_KEY}',
    envVar: 'STITCH_API_KEY',
    tokenLabel: 'Google API Key',
  },
  github: {
    packageKeywords: ['github', 'server-github'],
    tokenPassMethod: 'env',
    envVar: 'GITHUB_PERSONAL_ACCESS_TOKEN',
    tokenLabel: 'Personal Access Token (classic)',
    tokenUrl: 'https://github.com/settings/tokens',
  },
  sequentialthinking: {
    packageKeywords: ['sequential-thinking', 'server-sequential-thinking'],
    tokenPassMethod: 'none',
    envVar: '',
    tokenLabel: '無需認證（本地運行）',
  },
  sentry: {
    packageKeywords: ['sentry', 'mcp-server-sentry', '@sentry/mcp-server'],
    tokenPassMethod: 'env',
    envVar: 'SENTRY_AUTH_TOKEN',
    tokenLabel: 'Auth Token（以 sntryu_ 開頭）',
    tokenUrl: 'https://sentry.io/settings/auth-tokens/',
  },

  playwright: {
    packageKeywords: ['playwright', '@playwright/mcp'],
    tokenPassMethod: 'none',
    envVar: '',
    tokenLabel: '無需認證（本地運行）',
  },

  a11y: {
    packageKeywords: ['a11y-mcp', '@mseep/a11y-mcp', 'accessibility-mcp'],
    tokenPassMethod: 'none',
    envVar: '',
    tokenLabel: '無需認證（本地運行）',
  },
};

/**
 * 從輸入來源嘗試辨識已知 MCP
 * 回傳匹配的名稱與安裝提示，或 null
 */
export function matchInstallHint(input: string): { name: string; hint: InstallHint } | null {
  const lower = input.toLowerCase();
  for (const [name, hint] of Object.entries(KNOWN_INSTALL_HINTS)) {
    if (hint.packageKeywords.some((kw) => lower.includes(kw))) {
      return { name, hint };
    }
  }
  return null;
}
