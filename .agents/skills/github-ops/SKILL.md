---
name: github-ops
description: >
  [MCP: github] GitHub 版本控制操作食譜：倉庫管理、Issue 追蹤、分支建立、程式碼搜尋、檔案推送。
  MCP Server: github
  Use when: 需要 倉庫管理/Issue 操作/分支建立/檔案推送/程式碼搜尋 的場景。
  DO NOT use when: 執行 PR 程式碼審查或合併決策（用 pr-review-ops）。
metadata:
  author: antigravity
  version: "5.1"
  origin: framework
  memory_awareness: none
  mcp_servers: [github]
  tool_scope: ["mcp:github"]
---

# GitHub Ops — Version Control Recipes

## Recipe 1: Code Search & Reading

1. `search_code` — Search code snippets across repositories（跨倉庫搜尋）
2. `get_file_contents` — Get specific file or directory contents（取得檔案/目錄內容）
3. `search_repositories` — Search related repositories（搜尋倉庫）

## Recipe 2: Issue Management

1. `list_issues` — Filter existing Issues (supports state/label filters)
2. `create_issue` — Create new Issue
3. `update_issue` — Update status or assignment
4. `add_issue_comment` — Add comment

## Recipe 3: Pull Request Workflow

1. `create_branch` — Create feature branch from main
2. `push_files` — Commit multiple file changes at once
3. `create_pull_request` — Create PR
4. `get_pull_request_status` — Confirm CI checks pass
5. `create_pull_request_review` — Create review (approve/request_changes)
6. `merge_pull_request` — Merge PR

## Recipe 4: Single File Quick Update

1. `create_or_update_file` — Create or update a single file (with commit message)

> For multiple files, use `push_files` instead to avoid multiple commits（避免多次 commit）。

## Gotchas (踩坑點)

- `push_files` can push multiple files as a **single commit**（單一 commit） — cleaner than calling `create_or_update_file` repeatedly
- `fork_repository` defaults to personal account; specify `organization` to fork to an org（預設 fork 到個人帳號）
- Use `get_pull_request_status` before merging to confirm all CI passes（合併前先確認 CI）
- `update_pull_request_branch` may trigger rebase conflicts（可能觸發衝突）

## Interpretation (結果解讀)

- `get_pull_request_files` returns `status` field: `added`/`modified`/`removed`
- `get_pull_request_status` returns `state`: `success`/`pending`/`failure`
