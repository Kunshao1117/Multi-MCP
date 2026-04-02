---
name: stitch-design
description: >
  StitchMCP UI design workflow: project management, screen generation, and design DNA extraction.
  Use when: 需要 UI 設計稿生成/編輯/變體/設計規範擷取 的場景。
metadata:
  author: antigravity
  version: "5.3"
  origin: framework
  memory_awareness: none
  mcp_servers: [stitch]
  tool_scope: ["mcp:stitch"]
---

# Stitch Design (UI 設計生成)

## Trigger Conditions (觸發條件)
- UI prototyping during /02_blueprint or /03_build
  （架構設計或建構階段的 UI 原型設計）
- Design-to-code workflow: extracting design specs for frontend implementation
  （設計轉程式碼：擷取設計規範用於前端實作）
- Generating design variants for Director review
  （生成設計變體供總監審閱）

## Procedure (操作流程)

### Step 1: Project Management (專案管理)
1. Call `list_projects` to check existing Stitch projects
   （查看現有設計專案）
2. Call `create_project` with descriptive title if new project needed
   （需要時建立新專案）
3. Note the `projectId` for all subsequent operations
   （記下專案 ID 供後續使用）

### Step 2: Screen Generation (畫面生成)
1. Call `generate_screen_from_text` with **intent-driven prompt** (describe mood/brand, NOT pixels)
   （用意圖描述生成畫面：描述氛圍和品牌感，而非像素細節）
2. If `output_components` contains suggestions, present to Director for selection
   （若回傳建議選項，呈報總監裁決）
3. Use `edit_screens` for iterative refinement
   （使用編輯功能迭代修正）
4. Use `generate_variants` for alternative explorations
   （使用變體功能探索不同方向）

### Step 3: Design System Management (設計系統管理)

Establish a unified visual language and apply it across all screens.
（建立統一的視覺語言並套用到所有畫面）

1. `list_design_systems` — Check existing design systems（查看已有設計系統）
2. `create_design_system` — Create new design system:
   - **Color Palette**: Choose preset or define custom primary color + saturation
     （色彩：預設或自訂主色調 + 飽和度）
   - **Typography**: Select font family (e.g., Inter, Roboto, Outfit)
     （字體：選擇字型家族）
   - **Shape**: Set corner roundness for UI elements
     （形狀：設定元件圓角）
   - **Appearance**: Configure light/dark mode background colors
     （外觀：設定亮暗模式背景色）
   - **Design MD**: Free-form design instructions in markdown
     （設計備注：Markdown 格式的自由設計指令）
3. `update_design_system` — Immediately after creation to apply and display
   （建立後立即呼叫以套用並顯示）
4. `apply_design_system` — Apply to selected screens:
   - Pass list of screen IDs to apply the design system tokens
   - This modifies screen appearance to align with the design system
     （將設計系統的色彩/字體/形狀套用到指定畫面）

### Step 4: Design DNA Extraction (設計 DNA 擷取)
1. Call `get_screen` to retrieve full screen details (colors, typography, layout)
   （擷取完整畫面細節：色碼、字體、佈局）
2. Document extracted design tokens as project reference
   （將設計規範記錄為專案參考）
3. Feed design tokens into frontend implementation
   （將設計規範輸入前端實作）

### Step 5: Sync Checkpoint (設計同步檢查)
- After ANY modification in Stitch web UI, re-call `get_project` / `get_screen` to refresh context
  （Stitch 網頁端有任何修改後，必須重新讀取以同步設計資訊）

## Constraints (約束)
- **Vibe Design**: Use business-level intent prompts, NOT pixel-level specifications
  （意圖式設計：用商業語言描述，不要像素微調）
- **Sync Required**: Always re-read after external Stitch edits to avoid stale design data
  （同步必要：外部編輯後必須重新讀取，避免設計資料過時）
- Generation can take a few minutes — DO NOT RETRY on timeout
  （生成可能需要數分鐘，逾時請勿重試）

## Done When (驗證標準)
- Design screens generated and approved by Director
- Design tokens extracted and documented
- No stale design data in current context
