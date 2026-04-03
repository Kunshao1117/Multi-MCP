---
name: sentry-ops
description: >
  Sentry 錯誤監控操作食譜：錯誤調查、效能排查、問題管理流程。
  MCP Server: sentry
  Use when: 呼叫 sentry 相關工具、錯誤追蹤/堆疊分析/效能監控 的場景。
metadata:
  author: antigravity
  version: "5.3"
  origin: framework
  memory_awareness: none
  mcp_servers: [sentry]
  tool_scope: ["mcp:sentry"]
---

# Sentry Ops — Error Monitoring Recipes

## Recipe 1: Error Investigation Flow

1. `find_projects` — Confirm target project slug
2. `list_issues` — Use `query: 'is:unresolved'` to get unresolved issues list
3. `get_issue_details` — Get full stack trace for a specific issue
4. `get_issue_tag_values` — Analyze impact scope（分析影響範圍，用 `tagKey: 'environment'` 或 `'browser'`）
5. For deep analysis → `analyze_issue_with_seer`（AI 根因分析，需等待 2-5 分鐘）
6. After fix → `update_issue` set `status: 'resolved'`

## Recipe 2: Performance Troubleshooting

1. `list_events` — Use `dataset: 'spans'` + `query: 'span.op:db'` to query slow queries
2. `get_trace_details` — Get full trace chain using trace ID
3. Analyze span time distribution to identify bottlenecks

## Recipe 3: Latest Release Issue Monitoring

1. `find_releases` — Get latest release info
2. `list_issues` — Use `query: 'firstSeen:-24h'` to filter new issues

## Recipe 4: Seer AI Root Cause Deep Dive (AI 根因深度分析)

```
Standard stack trace insufficient?
├── Yes → Use this recipe
└── No → Use Recipe 1 instead
```

### Pre-Check (呼叫前檢查)
- Confirm issue has sufficient events (3+ occurrences recommended)（建議 3+ 次發生）
- Verify GitHub integration is connected (Seer needs source code access)（需 GitHub 整合才能存取原始碼）
- Check if analysis already exists — `analyze_issue_with_seer` caches results（結果有快取，重複呼叫秒回）

### Execution (執行)
1. `analyze_issue_with_seer` — Trigger AI analysis
   - Via URL: `issueUrl: "https://sentry.io/issues/PROJECT-123/"`
   - Via ID: `organizationSlug` + `issueId`
   - ⏱️ First analysis takes **2-5 minutes**; subsequent calls return cached results instantly
2. Review Seer response:
   - **Root Cause**: Specific code location and explanation（根因定位到具體程式碼行）
   - **Fix Suggestion**: Concrete code changes with file paths（修復建議含檔案路徑）
   - **Confidence**: Assessment of analysis certainty

### Post-Analysis Actions (分析後行動)
1. If fix is straightforward → Apply via `/04_fix` workflow（簡單修復 → 直接修復）
2. If fix requires architectural change → Escalate to Director（架構變更 → 回報總監）
3. If Seer suggests a PR → Review the generated PR via `pr-review-ops` skill

### Integration with `/07_debug` (除錯工作流整合)
- Load this skill during `/07_debug` Phase 3 (Root Cause Hypothesis)
- Use Seer as a **second opinion** after manual analysis（作為手動分析的第二意見）
- Cross-reference Seer's findings with `get_issue_tag_values` for environment/browser distribution

## Gotchas (踩坑點)

- ⚠️ `list_issues` query uses **Sentry search syntax**, not natural language（使用 Sentry 搜尋語法，如 `is:unresolved level:error`）
- ⚠️ When providing Sentry URLs, pass the **entire URL as-is** to the `issueUrl` parameter（整段 URL 原封不動傳入）
- ⚠️ Do NOT auto-call `analyze_issue_with_seer` after `get_issue_details` — only use when needed（不要自動呼叫，按需使用）
- ⚠️ `create_project` already includes DSN — no need to call `create_dsn` separately（不需再另外呼叫）

## Interpretation (結果解讀)

- Issue `count` = total events（事件總數）, `userCount` = affected users（受影響使用者數）
- Tag values' `times_seen` shows occurrence count per category — use for impact assessment（用於判斷影響範圍）
- Seer analysis results include specific file locations and code fix suggestions, directly applicable（可直接套用）
