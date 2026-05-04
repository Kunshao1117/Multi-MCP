---
name: browser-testing
description: >
  [Testing] Browser subagent delegation SOP and auto-arbitration gate for E2E visual testing.
  Use when: 需要啟動 browser_subagent 進行視覺驗證、E2E 測試執行、或瀏覽器自動仲裁閘門判定 的場景。
  DO NOT use when: 寫單元測試（用 test-patterns）、只需要 DOM 選擇器策略（用 test-automation-strategy）、決定委派管道（用 delegation-strategy）。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: none
  mcp_servers: [playwright, a11y]
  tool_scope: ["filesystem:read", "browser", "mcp:playwright", "mcp:a11y"]
---

# Browser Testing (瀏覽器測試)

## Trigger Conditions (觸發條件)

- E2E visual testing, UI verification, or browser-based validation
  （端到端視覺測試、UI 驗證、或瀏覽器操作驗證）

## Procedure (操作流程)

### Step 1: Subagent Delegation SOP (委派標準作業)

When spawning `browser_subagent`:
（啟動瀏覽器代理時）

1. **Task description**: MUST be in Traditional Chinese (zh-TW)
   （任務描述必須使用繁體中文）
2. **Stop condition**: Explicitly define when the subagent should stop and return
   （明確定義停止條件）
3. **Return format**: Specify what information the subagent should report back
   （指定回報內容格式）
4. **Allowed scope**: Subagent can ONLY interact with browser DOM. Cannot read/write project files
   （代理只能操作瀏覽器，不可讀寫專案檔案）
5. **Recording**: Subagent recordings saved to `.gemini/antigravity/brain/` (OS-segregated)
   （錄影存放在系統隔離目錄）

### Step 2: Context Passing (上下文傳遞)

- browser_subagent does NOT have access to module memory
  （瀏覽器代理無法存取模組記憶）
- If project context needed, embed key details directly in task description prompt
  （如需專案資訊，直接嵌入任務描述中）

### Step 3: Auto-Arbitration Gate (自動仲裁閘門)

After delegation produces code changes:
（委派產出程式碼變更後）

1. Master Agent applies proposed changes via Proxy Write
   （主代理透過代理寫入套用變更）
2. Run automated tests if project has them
   （如有自動測試則執行）
3. **Auto-Pass**: Linter + Tests pass 100% → bypass human review and proceed
   （全通過則自動放行）
4. **Visual Authorization Gate**: UI changes MUST conclude with `/06_test` for visual verification
   （UI 變更必須以視覺測試收尾）

## Constraints (約束)

- Subagent output is Read-Only — Master Agent performs all physical writes
  （代理輸出為唯讀，實際寫入由主代理執行）
- Server must be running and warmed up before spawning subagent
  （啟動代理前確保伺服器已運行）

### Step 4: Structured Error Triage (結構化錯誤分類)

When Auto-Arbitration Gate FAILS, classify the error before deciding next action:
（自動仲裁閘門失敗時，先分類錯誤再決定下一步）

```
[ERROR TRIAGE] On Auto-Arbitration failure:
├── TRANSIENT (暫時性): Network timeout, server not ready, rate limit, 429/503
│   └── Action: Wait 3s with backoff, then retry (max 2 retries).
│       Counts toward Circuit Breaker (Check 0 in _completion_gate).
├── SEMANTIC (語意性): Wrong selector, element not found, assertion mismatch, logic error
│   └── Action: Return structured error to Master Agent for re-planning.
│       Include: { errorType: "SEMANTIC", selector: "...", expected: "...", actual: "..." }
│       Does NOT count toward Circuit Breaker retry limit.
└── INFRASTRUCTURE (基礎設施): Server crash, port conflict, OOM, ECONNREFUSED
    └── Action: [HALT] Escalate to Director immediately.
          「🔴 [INFRA HALT] 基礎設施異常：{error}。請總監確認環境狀態。」
          Does NOT count toward Circuit Breaker retry limit.
```

## Done When (驗證標準)

- Browser subagent returned successfully with report
- All proposed changes applied and tests pass
- Visual verification screenshot/recording embedded in walkthrough
