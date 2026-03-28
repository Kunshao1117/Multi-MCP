---
name: github-ops
description: >
  GitHub 版本控制操作食譜：倉庫管理、Issue/PR 工作流程、程式碼搜尋。
  MCP Server: github
  Use when: 呼叫 github 相關工具、版本控制/倉庫管理/PR操作 的場景。
---

# GitHub Ops — 版本控制操作食譜

## Recipe 1: 程式碼搜尋與閱讀

1. `search_code` — 跨倉庫搜尋程式碼片段
2. `get_file_contents` — 取得特定檔案或目錄內容
3. `search_repositories` — 搜尋相關倉庫

## Recipe 2: Issue 管理流程

1. `list_issues` — 篩選現有 Issue（支援 state/label 過濾）
2. `create_issue` — 建立新 Issue
3. `update_issue` — 更新狀態或指派
4. `add_issue_comment` — 追加評論

## Recipe 3: Pull Request 工作流程

1. `create_branch` — 從主分支建立功能分支
2. `push_files` — 一次提交多個檔案變更
3. `create_pull_request` — 建立 PR
4. `get_pull_request_status` — 確認 CI 檢查通過
5. `create_pull_request_review` — 建立審核（approve/request_changes）
6. `merge_pull_request` — 合併 PR

## Recipe 4: 單檔快速更新

1. `create_or_update_file` — 建立或更新單個檔案（含 commit message）

> 多檔案時改用 `push_files`，避免多次 commit。

## Gotchas (踩坑點)

- ⚠️ `push_files` 可一次推送多個檔案為**單一 commit**，比逐一 `create_or_update_file` 更乾淨
- ⚠️ `fork_repository` 預設 fork 到個人帳號，需指定 `organization` 才會 fork 到組織
- ⚠️ 合併前用 `get_pull_request_status` 確認所有 CI 通過
- ⚠️ `update_pull_request_branch` 可能觸發 rebase 衝突

## Interpretation (結果解讀)

- `get_pull_request_files` 回傳的 `status` 欄位：`added`/`modified`/`removed`
- `get_pull_request_status` 的 `state`：`success`/`pending`/`failure`
