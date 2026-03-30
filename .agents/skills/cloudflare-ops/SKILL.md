---
name: cloudflare-ops
description: >
  Cloudflare 雲端服務操作食譜：KV/D1/R2 資源管理、Workers 管理、容器操作、日誌查詢。
  MCP Server: cloudflare-bindings, cloudflare-containers, cloudflare-observability
  Use when: 呼叫 cloudflare 相關工具、雲端資源管理/Workers/KV/D1/R2/容器/日誌 的場景。
---

# Cloudflare Ops — Cloud Service Recipes

> This skill spans three MCP servers: bindings（資源管理）, containers, observability（日誌）。

## Recipe 1: Account Initialization

1. `accounts_list` — List all accounts
2. `set_active_account` — Set active account（**其他操作前必須先做**）

## Recipe 2: KV Key-Value Storage

1. `kv_namespaces_list` — List all KV namespaces
2. `kv_namespace_create` — Create new namespace
3. `kv_namespace_get` — View specific namespace details

## Recipe 3: D1 Database Management

1. `d1_databases_list` — List all D1 databases
2. `d1_database_create` — Create new database
3. `d1_database_query` — Execute SQL queries

## Recipe 4: R2 Object Storage

1. `r2_buckets_list` — List all R2 buckets
2. `r2_bucket_create` — Create new bucket
3. `r2_bucket_get` — View bucket details

## Recipe 5: Workers Management & Log Queries

1. `workers_list` — List all Workers
2. `workers_get_worker_code` — Read Worker source code
3. `query_worker_observability` — Query logs and performance metrics
4. Before querying, use `observability_keys` to confirm available fields
5. Use `observability_values` to confirm available values for a field

## Recipe 6: Container Operations

1. `container_initialize` — Start container
2. `container_ping` — Confirm container is running
3. `container_exec` — Execute commands（Python 用 `python3`/`pip3`）
4. `container_file_write` / `container_file_read` — File read/write

## Gotchas (踩坑點)

- ⚠️ **Account first**: Must `set_active_account` before all operations（所有操作前必須先設定帳號）
- ⚠️ **Log queries**: `query_worker_observability` filter fields require `observability_keys` confirmation first — do not guess（不要猜測欄位名稱）
- ⚠️ **Container Python**: Must use `python3` and `pip3`, NOT `python`/`pip`
- ⚠️ **Pages migration**: Before migrating Pages to Workers, **must** call `migrate_pages_to_workers_guide` first（遷移前必調）
- ⚠️ `search_cloudflare_documentation` can search all Cloudflare product docs（可搜尋全部 Cloudflare 產品文件）

## Interpretation (結果解讀)

- Log queries support three views: `events`（列表）, calculations（統計）, specific invocations（定位）
- Worker's `workers_get_worker_code` may return bundled version, not necessarily source code（可能回傳打包版本）
