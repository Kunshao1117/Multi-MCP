---
name: sentry-ops
description: >
  Sentry 錯誤監控操作食譜：錯誤調查、效能排查、問題管理流程。
  MCP Server: sentry
  Use when: 呼叫 sentry 相關工具、錯誤追蹤/堆疊分析/效能監控 的場景。
---

# Sentry Ops — 錯誤監控操作食譜

## Recipe 1: 錯誤調查流程

1. `find_projects` — 確認目標專案的 slug
2. `list_issues` — 用 `query: 'is:unresolved'` 取得未解決問題清單
3. `get_issue_details` — 取得特定問題的完整堆疊追蹤
4. `get_issue_tag_values` — 分析影響範圍（用 `tagKey: 'environment'` 或 `'browser'`）
5. 如需深度分析 → `analyze_issue_with_seer`（AI 根因分析，需等待 2-5 分鐘）
6. 修復後 → `update_issue` 設定 `status: 'resolved'`

## Recipe 2: 效能排查流程

1. `list_events` — 用 `dataset: 'spans'` + `query: 'span.op:db'` 查詢慢查詢
2. `get_trace_details` — 用 trace ID 取得完整追蹤鏈
3. 分析 span 時間分佈，找出瓶頸

## Recipe 3: 最新版本問題監控

1. `find_releases` — 取得最新版本資訊
2. `list_issues` — 用 `query: 'firstSeen:-24h'` 篩選新問題

## Gotchas (踩坑點)

- ⚠️ `list_issues` 的 query 使用 **Sentry 搜索語法**，不是自然語言（如 `is:unresolved level:error`）
- ⚠️ 提供 Sentry URL 時，**整段 URL 原封不動**傳入 `issueUrl` 參數
- ⚠️ `analyze_issue_with_seer` 不要在 `get_issue_details` 後自動呼叫，只在需要時使用
- ⚠️ `create_project` 已包含 DSN，不需再呼叫 `create_dsn`

## Interpretation (結果解讀)

- Issue 的 `count` = 事件總數，`userCount` = 受影響使用者數
- Tag values 的 `times_seen` 顯示各分類的發生次數，用於判斷影響範圍
- Seer 分析結果包含具體的檔案位置和程式碼修復建議，可直接套用
