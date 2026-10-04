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
- [VS Code 延伸模組](#vs-code-延伸模組)
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
提供連線檢查、認證狀態與授權引導。MCP 握手成功只表示協定已連線；未執行服務專屬權限探測時，金鑰與權限維持 unknown。

### 🧩 VS Code 儀表板管理
Multi-MCP Manager 延伸模組提供 Activity Bar 儀表板，可安裝、編輯、移除、啟用、停用、掃描 MCP，並用共用表單管理相容的 `gateway.env` / `credentials.json` 認證檔。

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
| **Headless 管理 API** | `src/management/` | 提供 extension 與未來 UI 共用的安裝、移除、啟停、掃描、認證與版本檢查能力 |
| **日誌系統** | `src/logger.ts` | 結構化 JSON 日誌，輸出至 stderr（避免干擾 stdio 通訊） |
| **型別定義** | `src/types.ts` | 全域共用型別（GatewayConfig、ToolRegistry、ProcessState 等） |

#### 設定與重掃的生效範圍

- Gateway 自己的 `gateway__rescan` 會重讀啟動時的同一份設定、排空已移除或變更的下游程序，再更新工具快取與工具描述
- VS Code extension 的安裝／編輯／啟停／認證與掃描會更新磁碟；它沒有跨程序 IPC。已執行的 Gateway 需重新連線，或由該 Gateway 呼叫 rescan／reload 才會生效
- 暫時掃描失敗時保留該已啟用服務的最後工具快取，標示 stale 並回報失敗名單；未啟用服務不會保留可呼叫入口
- 同資料來源的多個 Extension／Gateway／CLI 掃描可並行等待下游；只有最後讀取／發布使用既有管理鎖的短同步區段。若工具快取、設定或認證已被其他操作更新，舊掃描會明確失敗並保留最新快取，請重新掃描；不會自動重播下游工具操作。reload 的裁剪同樣在鎖內讀取最新快取，無變更時不重寫。既有不含 revision 的快取可直接讀取，成功發布時新增不透明 revision；外部手動編輯器未遵守管理鎖時仍需避免同時修改。
- `--config=...` 在切換工作目錄前解析，重掃使用同一 config 與所在資料夾的 registry；含 `=` 的檔名保持完整
- 認證資料損壞會拒絕寫入並保留原檔。保存採每檔原子替換及失敗還原；不宣稱多檔交易能抵抗斷電。若有中斷後的 lock 或備份，確認沒有管理程序後先復原再繼續
- 為防止越界，管理檔案拒絕含路徑分隔符／保留檔名的名稱與符號連結路徑；遇既有不合法名稱或重複設定，先整理資料再管理，不會自動刪除

## VS Code 延伸模組與舊 CLI 模組

| 模組 | 檔案 | 職責 |
|------|------|------|
| **VS Code extension** | `extensions/vscode-multi-mcp-manager/` | Activity Bar Webview 儀表板管理 MCP、認證、掃描、MCP 版本與插件更新，並可打包 VSIX |
| **舊主控台入口** | `src/cli.ts` | 舊互動式選單程式碼保留於原始碼，但 npm `console` 入口已停用並導向 VS Code extension |
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

預設 MCP 只在第一次初始化時建立；若你刪除某個 MCP 設定，Gateway 不會在下次啟動時自動補回。需要 Token 的 MCP（如 GitHub、Sentry、Stitch）請用 Multi-MCP Manager VS Code 延伸模組安裝並設定金鑰。

安裝本 repo 打包出的 VSIX 後，從 VS Code 左側 **Multi-MCP** 圖示開啟管理儀表板：

```bash
code --install-extension extensions/vscode-multi-mcp-manager/vscode-multi-mcp-manager-0.1.4.vsix
```

`npx -y multi-mcp-gateway@latest console` 目前只會顯示遷移提示，不再啟動互動式選單。

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

建立或透過 Multi-MCP Manager VS Code 延伸模組維護 `gateway.env`，填入你的 API 金鑰：

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
| `credentials.json` | 管理介面維護的多帳號認證資料 |
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

Gateway 以每次 workspace 隔離下游程序的 cwd。自訂設定中的相對 command、啟動腳本與資料參數將相對該 workspace 解析；若啟動腳本固定在別處，請改用絕對路徑並先在測試專案驗證。這不影響本專案使用 npm/npx 的預設 MCP；只有工具 schema 宣告 `projectRoot` 才會注入該欄位。若呼叫已傳 `projectRoot`，必須與 workspace 指向相同絕對路徑，衝突會明確拒絕，不再猜測或改成另一個專案。

若下游工具因參數驗證失敗，Gateway 會根據該工具的 `inputSchema` 產生保守診斷，例如列出未知參數、缺少的 required 參數，以及高相似度的參數名稱建議（如 `module` 可能應改為 `moduleName`）。這只是輔助提示，Gateway 不會自動改寫 arguments 或重試；AI 必須確認 schema 後重新透過 `gateway__call_tool` 呼叫。

### 認證管理

| 工具 | 說明 |
|------|------|
| `gateway__auth_status` | 查看所有伺服器的認證狀態 |
| `gateway__auth_test` | 測試協定連線；不把握手成功當成金鑰或權限有效 |
| `gateway__auth_guide` | 取得指定伺服器的授權步驟指南 |

### 伺服器管理

| 工具 | 說明 |
|------|------|
| `gateway__server_status` | 查看所有伺服器的運行狀態（JSON） |
| `gateway__reload_server` | 重新載入指定伺服器（更新密鑰後使用） |
| `gateway__rescan` | 熱掃描所有 MCP 並更新集成表（無需重啟） |

### 設定與重掃的生效範圍

- Gateway 自己的 `gateway__rescan` 會重讀啟動時的同一份設定、排空已移除或變更的下游程序，再更新工具快取與工具描述
- VS Code extension 的安裝／編輯／啟停／認證與掃描會更新磁碟；它沒有跨程序 IPC。已執行的 Gateway 需重新連線，或由該 Gateway 呼叫 rescan／reload 才會生效
- 暫時掃描失敗時保留該已啟用服務的最後工具快取，標示 stale 並回報失敗名單；未啟用服務不會保留可呼叫入口
- 同資料來源的多個 Extension／Gateway／CLI 掃描可並行等待下游；只有最後讀取／發布使用既有管理鎖的短同步區段。若工具快取、設定或認證已被其他操作更新，舊掃描會明確失敗並保留最新快取，請重新掃描；不會自動重播下游工具操作。reload 的裁剪同樣在鎖內讀取最新快取，無變更時不重寫。既有不含 revision 的快取可直接讀取，成功發布時新增不透明 revision；外部手動編輯器未遵守管理鎖時仍需避免同時修改。
- `--config=...` 在切換工作目錄前解析，重掃使用同一 config 與所在資料夾的 registry；含 `=` 的檔名保持完整
- 認證資料損壞會拒絕寫入並保留原檔。保存採每檔原子替換及失敗還原；不宣稱多檔交易能抵抗斷電。若有中斷後的 lock 或備份，確認沒有管理程序後先復原再繼續
- 為防止越界，管理檔案拒絕含路徑分隔符／保留檔名的名稱與符號連結路徑；遇既有不合法名稱或重複設定，先整理資料再管理，不會自動刪除

## VS Code 延伸模組

Multi-MCP Manager 是本 repo 內的 VS Code extension，提供 Activity Bar 儀表板管理本機 Multi-MCP Gateway user-data。介面會依 VS Code 語言顯示英文或繁體中文，並保留 MCP、Gateway、Token、Registry 等技術術語。

點選左側 Multi-MCP 圖示後會開啟單一管理儀表板：

- **狀態總覽**：以摘要卡查看 Gateway 狀態、版本、插件更新狀態、已啟用 MCP、工具數與最後掃描時間。
- **頁首工具列**：直接執行來源安裝、匯入 `mcpServers` JSON、探索 MCP 目錄、重新掃描、檢查插件更新、檢查 MCP 套件版本、開啟資料夾與重新整理。
- **已安裝 MCP**：依分類區段顯示內縮 MCP 列，每個分類與 MCP 都可收合；展開 MCP 後可查看設定、認證與工具摘要，窄側欄會維持清楚的三層層級。
- **MCP 設定表單**：安裝與編輯共用同一套 Webview 表單，可修改名稱、分類、來源、command、args、重新掃描選項與金鑰 / Token 建議。

安裝流程支援 npm package / remote URL、自訂 command，以及貼上 `mcpServers` JSON；分類欄位會提供既有分類提示，也可直接輸入新分類。編輯既有 MCP 時可重新命名、搬移分類、調整來源或啟動參數，套用前會顯示變更預覽；重新命名會同步搬移對應 credential key。金鑰 / Token 區會先顯示是否需要金鑰，只有勾選設定時才展開環境變數與本機標籤欄位；完整金鑰值仍透過 VS Code password input 收集，不會放進 Webview state。移除 MCP 會先顯示名稱、分類、設定檔與認證影響，確認後才刪除設定與對應 credential。探索 MCP 會提供 PulseMCP、官方 MCP Registry、Glama 與 Smithery 等外部目錄，不在 extension 內維護推薦清單。

插件更新檢查使用 GitHub Releases。啟動後會靜默檢查最新 `vscode-multi-mcp-manager-v*` release，不會自動下載或安裝；需要更新時可從儀表板或 Command Palette 執行 **Multi-MCP: Check Extension Updates**，確認後下載並安裝對應 VSIX。

本機打包：

```bash
npm run package:extension
```

安裝 VSIX：

```bash
code --install-extension extensions/vscode-multi-mcp-manager/vscode-multi-mcp-manager-0.1.4.vsix
```

發布 VSIX 到 GitHub Releases：

```bash
git tag vscode-multi-mcp-manager-v0.1.4
git push origin vscode-multi-mcp-manager-v0.1.4
```

推送 `vscode-multi-mcp-manager-v*` tag 後，GitHub Actions 會重新驗證與打包 VSIX、確認 tag 版本與 extension 版本一致，並建立對應 GitHub Release。也可在 main 的 `VS Code Extension Release` workflow 手動執行，輸入對應 tag 與已驗證的完整 commit SHA；流程會拒絕 main 已漂移、tag 不符或既有 tag 指向其他提交。若同名 Release 已存在，發布流程會停止，不會覆蓋既有附件。

Gateway npm 發布使用 main 的 `Gateway npm Release` workflow：輸入 package version 與已通過檢查的完整 commit SHA，經 locked install、preflight、production audit 與 tarball smoke 後，以限定此 repo／workflow／package 的 npm Trusted Publisher 發布。VSIX 與 npm 為獨立交付，需分別核對正式版本；完整升級差異和剩餘開發工具風險見 CHANGELOG.md。

舊的互動式 CLI 選單已停用。`multi-mcp-gateway console` 只保留遷移提示，實際管理入口請使用 VS Code extension；若要程式化整合，請使用 `multi-mcp-gateway/management` subpath API。

---

## 開發指南

### 可用腳本

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式啟動 Gateway（使用 tsx 即時編譯） |
| `npm run dev:scan` | 開發模式掃描所有 MCP 並生成集成表 |
| `npm run console` | 顯示互動式 CLI 已停用與 VS Code extension 遷移提示 |
| `npm run build` | 編譯 TypeScript 至 `dist/` |
| `npm run typecheck` | 執行 TypeScript 型別檢查，不輸出檔案 |
| `npm run verify:runtime` | 以隔離資料夾與本地 MCP fixture 驗證真實 Gateway stdio、分頁、workspace、重掃及停用；不下載第三方 MCP、不讀寫使用者資料 |
| `npm run preflight:gateway` | 依序執行 typecheck、全部 src 測試（含管理 API / subprocess）、build 與隔離 runtime 驗證 |
| `npm run build:extension` | 編譯 Gateway 與 Multi-MCP Manager extension |
| `npm run package:extension` | 打包 VSIX 到 `extensions/vscode-multi-mcp-manager/` |
| `npm run preflight:extension` | 編譯並執行 VS Code extension smoke test |
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
5. （選用）使用 VS Code extension 或 `gateway__rescan` 確認工具已就緒

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

專案包含單元測試與受控 MCP 程序整合測試；測試結果不代表真實第三方服務、Windows 或 VS Code GUI 已驗證：

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
│   ├── management/             # Headless 管理 API
│   ├── *.test.ts               # 單元測試
│   │
│   └── cli/                    # 舊互動式 CLI 模組（console 入口已停用）
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
├── extensions/
│   └── vscode-multi-mcp-manager/ # VS Code 左側管理延伸模組與 VSIX 打包設定
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
