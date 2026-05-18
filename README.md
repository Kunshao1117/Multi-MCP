# Multi-MCP Gateway

**統一 MCP 閘道器 — 單一插槽代理多個下游 MCP 伺服器**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP_SDK-1.12+-000000?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHRleHQgeD0iMCIgeT0iMTQiIGZvbnQtc2l6ZT0iMTQiPuKaqTwvdGV4dD48L3N2Zz4=)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-ESM-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 目錄

- [概覽](#概覽)
- [核心特色](#核心特色)
- [系統架構](#系統架構)
- [快速開始](#快速開始)
- [設定檔說明](#設定檔說明)
- [使用者資料位置](#使用者資料位置)
- [MCP 資料夾結構](#mcp-資料夾結構)
- [閘道器管理工具](#閘道器管理工具)
- [CLI 管理主控台](#cli-管理主控台)
- [開發指南](#開發指南)
- [測試](#測試)
- [專案結構](#專案結構)

---

## 概覽

Multi-MCP Gateway 是一個**統一聚合閘道器**，讓 AI 程式碼助理（如 Gemini、Claude、Cursor 等）透過**單一 MCP 連接**即可存取數十個下游 MCP 伺服器的所有工具。

### 解決的問題

在傳統的 MCP 架構中，IDE 需要為每一個 MCP 工具分別建立獨立的程序連線（stdio 插槽），這導致：

- 🔴 **資源浪費** — 同時運行數十個子程序，記憶體開銷巨大
- 🔴 **設定散落** — 每個工具的認證、參數分散在不同的設定檔中
- 🔴 **管理困難** — 新增、移除、更新工具需要手動編輯多個設定檔

Multi-MCP Gateway 將所有 MCP 伺服器整合在一個統一的閘道器之下：

- 🟢 **單一插槽** — IDE 只需連接一個 Gateway，即可使用所有工具
- 🟢 **按需啟動** — 子程序在首次呼叫時才啟動，閒置後自動回收
- 🟢 **集中管理** — 所有認證、分類、健康狀態統一管控

---

## 核心特色

### 🔌 命名空間化工具路由
所有下游工具自動加上伺服器前綴（如 `github__create_issue`），避免名稱衝突，同時保留原始工具的完整參數結構。

### 🔍 智慧工具發現
內建模糊搜尋引擎（BM25 風格評分），AI 可透過自然語言描述需求，Gateway 會自動推薦最匹配的工具及其完整參數結構。

### ⚡ 按需程序池
採用惰性啟動策略 — 下游 MCP 伺服器在首次被呼叫時才產生子程序，閒置超時後自動釋放。包含崩潰自動重啟、啟動超時防護、優雅關閉等生產級程序管理機制。

### 🔐 集中認證管理
透過統一的 `gateway.env` 檔案管理所有 API 金鑰與認證令牌，支援 `${VAR}` 環境變數模板語法，自動注入到各個下游 MCP 的執行環境中。

### 🚀 一行 npx 啟動
可作為 npm 套件直接由 MCP Client 以 `npx` 啟動。程式碼由 npm 下載，使用者設定、認證與工具目錄保存在本機資料夾，不需要 clone 專案。

### 📂 分類目錄式設定
MCP 設定檔按功能分類存放在 `mcps/` 資料夾中（如 `mcps/開發工具/github.json`），直覺且易於維護。

### 🏥 健康檢查與認證診斷
內建認證狀態監控、伺服器健康檢查、授權引導指南，確保所有工具在任何時刻都處於可用狀態。

### 🛒 MCP 市集
CLI 主控台內建 npm 搜尋整合，可直接搜尋、安裝、設定新的 MCP 伺服器。

---

## 系統架構

```
┌─────────────────────────────────────────────────────┐
│                    AI IDE (Gemini / Cursor)          │
│                         │ stdio                     │
└─────────────────────────┼───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│              Multi-MCP Gateway                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  GatewayServer                               │   │
│  │  ├─ 10 個管理工具 (gateway__*)               │   │
│  │  ├─ ToolRouter (命名空間路由 + 模糊搜尋)     │   │
│  │  └─ ProcessPool (按需啟動 + 閒置回收)        │   │
│  └──────────────────────────────────────────────┘   │
│                          │                          │
│  ┌──────────────────────────────────────────────┐   │
│  │  ConfigLoader                                │   │
│  │  ├─ gateway.config.json (閘道器設定)         │   │
│  │  ├─ gateway.env (認證檔案)                   │   │
│  │  └─ mcps/ (分類目錄式 MCP 設定)              │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Registry (集成表引擎)                       │   │
│  │  └─ registry.json (工具目錄快取)             │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────┘
                          │ stdio (按需)
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  GitHub  │   │  Sentry  │   │ GitNexus │  ...
    │  MCP     │   │  MCP     │   │  MCP     │
    └──────────┘   └──────────┘   └──────────┘
```

### 核心模組

| 模組 | 檔案 | 職責 |
|------|------|------|
| **進入點** | `src/index.ts` | 啟動分流（伺服器模式 / 掃描模式）、Windows 環境修正、使用者資料資料夾初始化 |
| **路徑管理** | `src/paths.ts` | 分離 npm package 位置與使用者資料位置，初始化本機設定資料夾 |
| **閘道器主體** | `src/gateway-server.ts` | MCP Server 實例化、10 個管理工具定義、請求處理器註冊 |
| **工具路由器** | `src/tool-router.ts` | 命名空間解析、管理工具分發、下游工具代理呼叫、模糊搜尋 |
| **程序池** | `src/process-pool.ts` | 子程序生命週期管理（啟動/閒置回收/崩潰重啟/健康檢查） |
| **設定載入器** | `src/config-loader.ts` | 設定檔讀取、`gateway.env` 注入、`mcps/` 目錄掃描、環境變數模板解析 |
| **集成表引擎** | `src/registry.ts` | 下游 MCP 掃描、工具目錄生成、模糊搜尋、分類總表產生 |
| **認證引導** | `src/auth-guides.ts` | 各 MCP 的授權步驟指南生成（環境變數 / OAuth / API Key） |
| **認證儲存** | `src/credential-store.ts` | 多帳號認證資料的讀寫管理 |
| **日誌系統** | `src/logger.ts` | 結構化 JSON 日誌，輸出至 stderr（避免干擾 stdio 通訊） |
| **型別定義** | `src/types.ts` | 全域共用型別（GatewayConfig、ToolRegistry、ProcessState 等） |

### CLI 管理主控台模組

| 模組 | 檔案 | 職責 |
|------|------|------|
| **主控台入口** | `src/cli.ts` | 主選單路由與互動式介面 |
| **儀表板** | `src/cli/dashboard.ts` | MCP 總覽儀表板渲染 |
| **MCP 管理** | `src/cli/mcp-manager.ts` | 檢視、移除、重新掃描 MCP |
| **市集** | `src/cli/marketplace.ts` | npm 搜尋整合與一鍵安裝 |
| **安裝流程** | `src/cli/install-flow.ts` | 互動式 MCP 安裝精靈（自動偵測設定格式） |
| **認證管理** | `src/cli/auth-manager.ts` | 認證狀態查看、密鑰設定、同步 |
| **分類管理** | `src/cli/category-manager.ts` | MCP 分類的增刪改 |
| **健康檢查** | `src/cli/health-check.ts` | 批量認證狀態驗證 |
| **工具瀏覽器** | `src/cli/tool-browser.ts` | 互動式工具清單瀏覽 |
| **版本檢查** | `src/cli/version-check.ts` | 下游 MCP 版本更新偵測 |
| **匯出匯入** | `src/cli/import-export.ts` | 設定檔的匯出與匯入 |
| **來源偵測** | `src/cli/source-detector.ts` | 自動偵測 MCP 安裝來源（npm / GitHub 等） |
| **共用工具** | `src/cli/shared.ts` | 終端機 UI 元件、色彩碼、共用函式 |

---

## 快速開始

### 前置需求

- **Node.js** >= 18（ESM 支援）
- **npm** >= 9

### 一行啟動（一般使用者）

在 MCP Client 設定中加入 Multi-MCP Gateway：

```json
{
  "mcpServers": {
    "multi-mcp-gateway": {
      "command": "npx",
      "args": ["-y", "multi-mcp-gateway@latest"]
    }
  }
}
```

首次啟動時會自動建立本機設定資料夾，包含 `gateway.config.json`、`gateway.env`、`mcps/`、`registry.json` 與一次性預設 MCP seed 狀態檔。新資料夾會預設啟用可攜、無金鑰的 MCP，例如 `cartridge-system`、`context7`、`playwright`、`a11y`、`excel`、`sequentialthinking` 與 `gitnexus`。

預設 MCP 只在第一次初始化時建立；若你刪除某個 MCP 設定，Gateway 不會在下次啟動時自動補回。需要 Token 的 MCP（如 GitHub、Sentry、Stitch）請用主控台安裝並設定金鑰。

啟動互動式管理主控台：

```bash
npx -y multi-mcp-gateway@latest console
```

若要固定設定資料夾位置，可設定：

```bash
MULTI_MCP_HOME=D:/my-mcp-home
```

### 原始碼安裝（開發者）

```bash
git clone https://github.com/Kunshao1117/Multi-MCP.git
cd Multi-MCP
npm install
```

### 首次設定

#### 1. 設定認證檔案

建立或透過 CLI 主控台維護 `gateway.env`，填入你的 API 金鑰：

```env
# GitHub
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxx

# Sentry
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxx

# Cloudflare
CLOUDFLARE_API_TOKEN=xxxxxxxxxxxx
```

#### 2. 新增 MCP 伺服器

在 `mcps/` 資料夾下，按分類建立 JSON 設定檔：

```bash
# 範例：新增 GitHub MCP
mkdir -p mcps/開發工具
```

建立 `mcps/開發工具/github.json`：

```json
{
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-github"
  ],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
  }
}
```

#### 3. 掃描並生成工具目錄

```bash
npx -y multi-mcp-gateway@latest --scan
```

此指令會依序連接所有已設定的 MCP 伺服器，取得工具清單，並生成 `registry.json`。

#### 4. 啟動 Gateway

```bash
npx -y multi-mcp-gateway@latest
```

### 連接到 IDE

在你的 IDE MCP 設定中，加入 Gateway 作為唯一的 MCP 伺服器：

**Gemini IDE (`mcp_config.json`)**:
```json
{
  "mcpServers": {
    "multi-mcp-gateway": {
      "command": "npx",
      "args": ["-y", "multi-mcp-gateway@latest"]
    }
  }
}
```

> 💡 開發期間可使用 `tsx src/index.ts` 或 `node dist/index.js` 取代 `npx`。

> ⚠️ Codex/Gemini 若使用 `node D:/Multi-MCP/dist/index.js` 啟動 Gateway，修改 `src/` 後必須先重新建置。Gateway 會在啟動時檢查 `src/` 是否比 `dist/` 新；若偵測到舊編譯產物，會拒絕啟動並提示執行 `npx tsc`，避免 AI 連到舊版工具描述。

---

## 設定檔說明

### `gateway.config.json`

閘道器的核心設定檔：

```json
{
  "gateway": {
    "idle_timeout_ms": 300000,
    "startup_timeout_ms": 60000,
    "max_retries": 3,
    "log_level": "info",
    "env_file": "gateway.env",
    "health_check_on_start": false,
    "mcps_dir": "mcps"
  }
}
```

| 欄位 | 說明 | 預設值 |
|------|------|--------|
| `idle_timeout_ms` | 子程序閒置超時（毫秒），超過後自動回收 | `300000` (5 分鐘) |
| `startup_timeout_ms` | 子程序啟動超時（毫秒） | `60000` (1 分鐘) |
| `max_retries` | 子程序崩潰後的最大重試次數 | `3` |
| `log_level` | 日誌等級：`debug` / `info` / `warn` / `error` | `info` |
| `env_file` | 認證檔案路徑（相對於 `gateway.config.json` 所在資料夾） | `gateway.env` |
| `health_check_on_start` | 啟動時是否執行認證健康檢查 | `false` |
| `mcps_dir` | MCP 設定檔資料夾路徑（相對於 `gateway.config.json` 所在資料夾） | `mcps` |

### `gateway.env`

集中管理所有認證令牌的環境變數檔案：

```env
# 格式：KEY=VALUE
# 支援 # 註解
# 系統環境變數優先（已存在的不會被覆蓋）

GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxx
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxx
CLOUDFLARE_API_TOKEN=xxxxxxxxxxxx
```

---

## 使用者資料位置

`npx` 模式會把程式碼與使用者資料分開：

| 平台 | 預設資料夾 |
|------|------------|
| Windows | `%APPDATA%/multi-mcp-gateway` |
| macOS | `~/Library/Application Support/multi-mcp-gateway` |
| Linux | `~/.config/multi-mcp-gateway` |

資料夾內容：

| 檔案/資料夾 | 說明 |
|-------------|------|
| `gateway.config.json` | Gateway 啟動設定 |
| `gateway.env` | API key 與 token |
| `credentials.json` | CLI 管理的多帳號認證資料 |
| `mcps/` | 使用者安裝的下游 MCP 設定 |
| `registry.json` | 掃描生成的工具目錄 |
| `default-mcps.seed.json` | 預設 MCP 一次性初始化紀錄；存在時不再自動補回被刪除的預設 MCP |

若需自訂位置，設定 `MULTI_MCP_HOME` 即可。開發與驗證腳本可用這個變數指向 repo 根目錄，以沿用本專案內的示範設定。

### `registry.json`

由 `npx -y multi-mcp-gateway@latest --scan` 或 `npm run dev:scan` 自動生成的工具目錄快取，包含所有下游 MCP 的工具清單、參數結構、命名空間映射。**此檔案不需要手動編輯。**

---

## MCP 資料夾結構

```
mcps/
├── UI設計/
│   └── stitch.json
├── 文件查詢/
│   └── context7.json
├── 網頁測試/
│   ├── playwright.json
│   └── a11y.json
├── 記憶管理/
│   └── cartridge-system.json
├── 資料處理/
│   └── excel.json
├── 輔助工具/
│   └── sequentialthinking.json
├── 錯誤監控/
│   └── sentry.json
├── 開發工具/
│   ├── github.json
│   └── gitnexus.json
├── 雲端基礎設施/
│   ├── cloudflare-bindings.disabled
│   ├── cloudflare-containers.disabled
│   └── cloudflare-observability.disabled
├── 安全掃描/
│   └── snyk.json
├── 程式碼品質/
│   └── eslint.json
└── 資料庫管理/
    └── supabase.json
```

每個 JSON 檔案的格式：

首次 user-data 初始化會自動建立以下無金鑰預設 MCP：`cartridge-system`、`context7`、`playwright`、`a11y`、`excel`、`sequentialthinking`、`gitnexus`。這些設定由 npm package 程式產生，不是直接把 repo 的 `mcps/` 打包到 npm；因此私人路徑、Token 設定與 `.disabled` 檔案不會被發布出去。

預設 MCP 都使用 explicit package 形式（`npx -y --package <package> -- <bin>`）。這可避免 Gateway 自己由 npm/npx 啟動時，Windows 內層 `npx` 把 scoped package 或 `@latest` 規格誤判成 shell 指令。`gitnexus` 目前固定使用已驗證的 `gitnexus@1.6.5`。

`mcps/記憶管理/cartridge-system.json` 使用 npm runtime：

```json
{
  "command": "npx",
  "args": ["-y", "--package", "cartridge-system@latest", "--", "cartridge-system"]
}
```

Gateway 呼叫 `cartridge-system` 時會以每次 `gateway__call_tool.workspace` 注入當前專案路徑，因此示範設定不再固定本機 `d:/cartridge_system` 或 `--workspace`。

```json
{
  "command": "npx",
  "args": ["-y", "@scope/mcp-server-name"],
  "env": {
    "API_KEY": "${API_KEY_FROM_GATEWAY_ENV}"
  }
}
```

- **資料夾名稱** = 分類名稱（自動對應到 `search_tools` 的分類總表）
- **JSON 檔名** = MCP 伺服器名稱（自動成為命名空間前綴）
- **`env` 欄位** — 支援 `${VAR}` 模板語法，自動從 `gateway.env` 或系統環境變數中解析

---

## 閘道器管理工具

Gateway 啟動後會暴露 10 個管理工具，供 AI 助理直接呼叫：

### 工具發現與呼叫

| 工具 | 說明 |
|------|------|
| `gateway__search_tools` | 模糊搜尋可用工具（含分類總表與參數結構） |
| `gateway__call_tool` | 呼叫指定的下游工具（透過 Gateway 代理） |
| `gateway__list_server_tools` | 列出指定伺服器的所有工具 |
| `gateway__list_servers` | 列出所有已註冊的伺服器及工具數量 |

`gateway__search_tools` 與 `gateway__list_server_tools` 只負責探索工具與查詢 schema，不代表工具已被執行。若使用者要求「Gateway MCP 真實呼叫」，AI 必須透過 `gateway__call_tool` 呼叫下游 MCP 工具；`stdio` E2E、終端 handler 測試、單元測試或直接啟動下游程序只能作為補充驗證，不能宣稱取代 Gateway 驗證。

### 下游工具呼叫流程

1. 使用 `gateway__search_tools` 搜尋需求，例如 `呼叫 cartridge-system memory_audit` 或 `call downstream MCP tool`。
2. 使用 `gateway__list_server_tools` 查詢下游工具 schema，例如 `{ "server_name": "cartridge-system" }`。
3. 使用 `gateway__call_tool` 真實呼叫下游工具：

```json
{
  "name": "cartridge-system__memory_audit",
  "arguments": {
    "projectRoot": "d:\\your-project"
  },
  "workspace": "d:\\your-project"
}
```

`cartridge-system__workspace_brief` 與 `cartridge-system__commit_preflight` 也採相同流程。所有 `arguments` 必須符合下游工具的真實 `inputSchema`；例如 `cartridge-system__memory_deps` 使用 `moduleName`，不是 `module`。若 Gateway 找不到呼叫入口、server 未註冊、工具不存在或 schema 不明，AI 應先回報卡點並等待授權，不要自行改用替代驗證方式。

`workspace` 是每次呼叫的唯一可信專案來源。Gateway 不保存固定全域工作目錄，也不再使用啟動時的 `--workspace` 或 IDE 環境變數作為預設值；AI 應在確認當前專案後，於每次 `gateway__call_tool` 呼叫中明確帶入該專案的絕對路徑，避免多專案共用同一 Gateway 時路徑互相污染。

若下游工具因參數驗證失敗，Gateway 會根據該工具的 `inputSchema` 產生保守診斷，例如列出未知參數、缺少的 required 參數，以及高相似度的參數名稱建議（如 `module` 可能應改為 `moduleName`）。這只是輔助提示，Gateway 不會自動改寫 arguments 或重試；AI 必須確認 schema 後重新透過 `gateway__call_tool` 呼叫。

### 認證管理

| 工具 | 說明 |
|------|------|
| `gateway__auth_status` | 查看所有伺服器的認證狀態 |
| `gateway__auth_test` | 測試指定伺服器的認證是否有效 |
| `gateway__auth_guide` | 取得指定伺服器的授權步驟指南 |

### 伺服器管理

| 工具 | 說明 |
|------|------|
| `gateway__server_status` | 查看所有伺服器的運行狀態（JSON） |
| `gateway__reload_server` | 重新載入指定伺服器（更新密鑰後使用） |
| `gateway__rescan` | 熱掃描所有 MCP 並更新集成表（無需重啟） |

## CLI 管理主控台

啟動互動式管理主控台：

```bash
npx -y multi-mcp-gateway@latest console
```

開發模式也可使用 `npm run console`。

主控台提供以下功能：

```
╔══════════════════════════════════════════════════╗
║     Multi-MCP Gateway 管理主控台                ║
╠══════════════════════════════════════════════════╣
║ 📦 MCP 管理                                     ║
║  [1] 檢視已安裝的 MCP                           ║
║  [2] 🛒 MCP 市集                                ║
║  [3] 移除 MCP                                   ║
║                                                  ║
║ 🔍 工具與診斷                                    ║
║  [4] 工具瀏覽器                                  ║
║  [5] 🏥 健康檢查                                 ║
║  [6] 🔄 版本檢查                                 ║
║                                                  ║
║ 🔧 系統設定                                      ║
║  [7] 認證管理                                    ║
║  [8] 分類管理                                    ║
║                                                  ║
║ ⚡ 進階                                          ║
║  [9] 重新掃描工具                                ║
║  [E] 匯出 / 匯入設定                            ║
║  [0] 離開                                        ║
╚══════════════════════════════════════════════════╝
```

---

## 開發指南

### 可用腳本

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式啟動 Gateway（使用 tsx 即時編譯） |
| `npm run dev:scan` | 開發模式掃描所有 MCP 並生成集成表 |
| `npm run console` | 啟動互動式 CLI 管理主控台 |
| `npm run build` | 編譯 TypeScript 至 `dist/` |
| `npm run typecheck` | 執行 TypeScript 型別檢查，不輸出檔案 |
| `npm run verify:runtime` | 以 MCP stdio 啟動 `dist/index.js`，驗證 Gateway 工具暴露與 cartridge-system 工具數量 |
| `npm run preflight:gateway` | 依序執行 typecheck、核心測試、build 與 runtime 驗證 |
| `npm run start` | 生產模式啟動 Gateway |
| `npm run scan` | 生產模式掃描工具 |
| `npm test` | 執行單元測試（Vitest） |
| `npm run test:watch` | 監看模式執行測試 |
| `npm pack --dry-run --json` | 檢查 npm 發布內容，不應包含本機認證與開發治理資料 |

### 技術堆疊

| 項目 | 技術 |
|------|------|
| **語言** | TypeScript 5.7+（strict 模式） |
| **模組系統** | ESM（`"type": "module"`） |
| **執行環境** | Node.js 18+ |
| **核心依賴** | `@modelcontextprotocol/sdk` ^1.29.0 |
| **開發工具** | tsx 4.19+、Vitest 3.0+ |
| **建構** | tsc → `dist/` |

### 新增下游 MCP 伺服器

1. 在 `mcps/` 下建立或選擇分類資料夾
2. 建立 JSON 設定檔（檔名即為伺服器名稱）
3. 如需認證，將金鑰加入 `gateway.env`，在 JSON 中使用 `${VAR}` 引用
4. 執行 `npx -y multi-mcp-gateway@latest --scan` 或 `npm run dev:scan` 掃描並註冊
5. （選用）使用 CLI 主控台確認工具已就緒

### 日誌系統

Gateway 的日誌以**結構化 JSON 格式**輸出至 `stderr`，避免干擾 stdio MCP 通訊：

```json
{
  "timestamp": "2026-05-04T13:49:45.524Z",
  "level": "info",
  "module": "config-loader",
  "message": "載入設定檔",
  "data": { "path": "D:\\Multi-MCP\\gateway.config.json" }
}
```

日誌等級可在 `gateway.config.json` 中透過 `log_level` 欄位調整。

---

## 測試

專案包含完整的單元測試覆蓋：

```bash
# 執行所有測試
npm test

# 監看模式
npm run test:watch
```

測試覆蓋的核心模組：

| 測試檔案 | 覆蓋模組 | 測試重點 |
|----------|----------|----------|
| `paths.test.ts` | 路徑管理 | 使用者資料夾、package root、資料路徑生成 |
| `config-loader.test.ts` | 設定載入器 | JSON 解析、相對路徑解析、環境變數替換、目錄掃描、驗證邏輯 |
| `registry.test.ts` | 集成表引擎 | 自訂 registry 路徑、命名空間化、模糊搜尋排序、分類總表生成 |
| `tool-router.test.ts` | 工具路由器 | 命名空間解析、管理工具分發、下游代理、錯誤處理 |
| `process-pool.test.ts` | 程序池 | 啟動/關閉生命週期、閒置回收、崩潰重啟 |
| `runtime-guard.test.ts` | Runtime 防護 | 阻擋 stale `dist/` 啟動 |

---

## 專案結構

```
Multi-MCP/
├── gateway.config.json         # 閘道器核心設定
├── gateway.env                 # 認證檔案（.gitignore 排除）
├── credentials.json            # 多帳號認證儲存（.gitignore 排除）
├── registry.json               # 工具目錄快取（自動生成）
├── package.json
├── tsconfig.json
│
├── mcps/                       # MCP 分類目錄式設定
│   ├── 開發工具/
│   ├── 雲端基礎設施/
│   ├── 網頁測試/
│   └── ...                     # 12 個分類
│
├── src/
│   ├── index.ts                # 進入點（伺服器 / 掃描模式分流）
│   ├── paths.ts                # package 與使用者資料路徑管理
│   ├── gateway-server.ts       # 閘道器主體（GatewayServer 類別）
│   ├── tool-router.ts          # 工具路由器（ToolRouter 類別）
│   ├── process-pool.ts         # 程序池（ProcessPool 類別）
│   ├── config-loader.ts        # 設定檔載入器
│   ├── registry.ts             # 集成表引擎
│   ├── auth-guides.ts          # 認證引導指南
│   ├── credential-store.ts     # 認證儲存
│   ├── logger.ts               # 結構化日誌系統
│   ├── types.ts                # 全域型別定義
│   ├── *.test.ts               # 單元測試
│   │
│   └── cli/                    # CLI 管理主控台
│       ├── shared.ts           # 共用 UI 元件
│       ├── dashboard.ts        # 儀表板
│       ├── mcp-manager.ts      # MCP 管理
│       ├── marketplace.ts      # MCP 市集
│       ├── install-flow.ts     # 安裝精靈
│       ├── auth-manager.ts     # 認證管理
│       ├── category-manager.ts # 分類管理
│       ├── health-check.ts     # 健康檢查
│       ├── tool-browser.ts     # 工具瀏覽器
│       ├── version-check.ts    # 版本檢查
│       ├── import-export.ts    # 匯出匯入
│       └── source-detector.ts  # 來源偵測
│
└── dist/                       # 編譯輸出（tsc）
```

---

## 安全性注意事項

- ⚠️ `gateway.env` 與 `credentials.json` 包含明文認證資訊，已被 `.gitignore` 排除
- ⚠️ 請勿將認證檔案提交至版本控制系統
- 💡 建議在生產環境中使用作業系統級別的環境變數管理（如 Windows Credential Manager 或 macOS Keychain）

---

## License

[MIT](LICENSE)
