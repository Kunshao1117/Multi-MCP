---
name: cloudflare-ops
description: >
  Cloudflare 雲端服務操作食譜：KV/D1/R2 資源管理、Workers 管理、容器操作、日誌查詢。
  MCP Server: cloudflare-bindings, cloudflare-containers, cloudflare-observability
  Use when: 呼叫 cloudflare 相關工具、雲端資源管理/Workers/KV/D1/R2/容器/日誌 的場景。
---

# Cloudflare Ops — 雲端服務操作食譜

> 此技能橫跨三台 MCP 伺服器：bindings（資源管理）、containers（容器）、observability（日誌）。

## Recipe 1: 帳號初始化

1. `accounts_list` — 列出所有帳號
2. `set_active_account` — 設定活動帳號（**其他操作前必須先做**）

## Recipe 2: KV 鍵值儲存管理

1. `kv_namespaces_list` — 列出所有 KV 命名空間
2. `kv_namespace_create` — 建立新命名空間
3. `kv_namespace_get` — 查看特定命名空間詳情

## Recipe 3: D1 資料庫管理

1. `d1_databases_list` — 列出所有 D1 資料庫
2. `d1_database_create` — 建立新資料庫
3. `d1_database_query` — 執行 SQL 查詢

## Recipe 4: R2 物件儲存管理

1. `r2_buckets_list` — 列出所有 R2 儲存桶
2. `r2_bucket_create` — 建立新儲存桶
3. `r2_bucket_get` — 查看儲存桶詳情

## Recipe 5: Workers 管理與日誌查詢

1. `workers_list` — 列出所有 Workers
2. `workers_get_worker_code` — 讀取 Worker 原始碼
3. `query_worker_observability` — 查詢日誌和效能指標
4. 查詢前用 `observability_keys` 確認可用欄位
5. 用 `observability_values` 確認欄位的可用值

## Recipe 6: 容器操作

1. `container_initialize` — 啟動容器
2. `container_ping` — 確認容器運行中
3. `container_exec` — 執行指令（Python 用 `python3`/`pip3`）
4. `container_file_write` / `container_file_read` — 檔案讀寫

## Gotchas (踩坑點)

- ⚠️ **帳號優先**：所有操作前必須先 `set_active_account`
- ⚠️ **日誌查詢**：`query_worker_observability` 的 filter 欄位需用 `observability_keys` 先確認，不要猜
- ⚠️ **容器 Python**：必須用 `python3` 和 `pip3`，不是 `python`/`pip`
- ⚠️ **Pages 遷移**：遷移 Pages 到 Workers 前，**必須**先呼叫 `migrate_pages_to_workers_guide`
- ⚠️ `search_cloudflare_documentation` 可搜尋所有 Cloudflare 產品文件

## Interpretation (結果解讀)

- 日誌查詢支援三種檢視：`events`（列表）、calculations（統計）、specific invocations（定位）
- Worker 的 `workers_get_worker_code` 可能回傳打包版本，不一定是原始碼
