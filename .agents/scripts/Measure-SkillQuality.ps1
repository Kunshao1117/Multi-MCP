<#
.SYNOPSIS
    技能品質掃描腳本 — 掃描所有 SKILL.md 並產出結構化品質報告。
.DESCRIPTION
    依據 agentskills.io 規範和 Antigravity 命令式書寫標準，
    檢查行數、Token 估算、禁用詞彙、Frontmatter 完整性、
    agentskills.io 相容性和 L3 參考文件內嵌狀態。
.PARAMETER Target
    指定單一技能目錄路徑（含 SKILL.md）。若未指定，掃描所有技能目錄。
.PARAMETER SkillsRoot
    技能根目錄。預設為腳本同層的 ..\.agents\skills。
.EXAMPLE
    .\Measure-SkillQuality.ps1
    .\Measure-SkillQuality.ps1 -Target "d:\AI_Rules\Antigravity\.agents\skills\memory-ops"
#>
param(
    [string]$Target,
    [string]$SkillsRoot
)

# ─── 初始化 ───
$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $SkillsRoot) {
    $SkillsRoot = Join-Path $scriptDir '..\skills'
}
$SkillsRoot = (Resolve-Path $SkillsRoot).Path

# ─── 禁用詞彙清單 ───
$ForbiddenPatterns = @(
    'This skill teaches',
    'This skill enables',
    'This skill provides',
    'This skill extends',
    'this is because',
    'the purpose is',
    'the reason is'
)

# ─── 必要 Frontmatter 欄位 ───
$RequiredFrontmatter = @('name', 'description', 'metadata')
$RequiredMetadata = @('author', 'version', 'origin')

# ─── 掃描函式 ───
function Measure-SingleSkill {
    param([string]$SkillDir)

    $skillFile = Join-Path $SkillDir 'SKILL.md'
    if (-not (Test-Path $skillFile)) { return $null }

    $content = Get-Content $skillFile -Raw -Encoding UTF8
    $lines = Get-Content $skillFile -Encoding UTF8
    $skillName = Split-Path $SkillDir -Leaf
    $refsDir = Join-Path $SkillDir 'references'
    $hasRefs = Test-Path $refsDir

    # 行數
    $lineCount = $lines.Count
    $lineStatus = if ($lineCount -lt 500) { '🟢' } else { '🔴' }

    # Token 估算（字元數 ÷ 3）
    $charCount = $content.Length
    $tokenEstimate = [math]::Ceiling($charCount / 3)
    $tokenStatus = if ($tokenEstimate -lt 5000) { '🟢' } else { '🔴' }

    # 禁用詞彙檢查（排除 FORBIDDEN 規則定義行中的引用）
    $foundForbidden = @()
    $contentLines = $content -split "`n"
    foreach ($pattern in $ForbiddenPatterns) {
        $escapedPattern = [regex]::Escape($pattern)
        foreach ($line in $contentLines) {
            # 跳過 FORBIDDEN 規則定義行（允許引用禁用詞作為示範）
            if ($line -match 'FORBIDDEN:' -or $line -match '禁用模式' -or $line -match '❌') { continue }
            if ($line -match $escapedPattern) {
                $foundForbidden += $pattern
                break
            }
        }
    }
    $forbiddenStatus = if ($foundForbidden.Count -eq 0) { '🟢' } else { '🔴' }

    # Frontmatter 解析
    $frontmatterOk = $true
    $missingFields = @()
    foreach ($field in $RequiredFrontmatter) {
        if ($content -notmatch "(?m)^${field}:") {
            $frontmatterOk = $false
            $missingFields += $field
        }
    }
    foreach ($field in $RequiredMetadata) {
        if ($content -notmatch "(?m)^\s+${field}:") {
            $frontmatterOk = $false
            $missingFields += "metadata.$field"
        }
    }
    $frontmatterStatus = if ($frontmatterOk) { '🟢' } else { '🔴' }

    # agentskills.io 相容性
    $nameOk = ($skillName -match '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$') -and ($skillName.Length -le 64)
    # description 長度（從 frontmatter 區塊提取）
    $fmMatch = [regex]::Match($content, '(?ms)\A---\s*\n(.*?)\n---')
    $descLength = 0
    if ($fmMatch.Success) {
        $fm = $fmMatch.Groups[1].Value
        $descLineMatch = [regex]::Match($fm, '(?ms)^description:\s*>\s*\n((?:\s{2,}.*\n)*)')
        if ($descLineMatch.Success) {
            $descLength = $descLineMatch.Groups[1].Value.Trim().Length
        } else {
            # 單行 description
            $singleMatch = [regex]::Match($fm, '(?m)^description:\s*(.+)$')
            if ($singleMatch.Success) {
                $descLength = $singleMatch.Groups[1].Value.Trim().Length
            }
        }
    }
    $descOk = $descLength -lt 1024
    $compatStatus = if ($nameOk -and $descOk) { '🟢' } else { '🔴' }

    # L3 內嵌狀態
    $l3Status = '—'
    if ($hasRefs) {
        $hasInlineRef = $content -match 'Read references/' -or $content -match 'references/\S+\.md'
        $l3Status = if ($hasInlineRef) { '🟢' } else { '🟡' }
    }

    return [PSCustomObject]@{
        Name             = $skillName
        Lines            = $lineCount
        LineStatus       = $lineStatus
        Tokens           = $tokenEstimate
        TokenStatus      = $tokenStatus
        ForbiddenWords   = $foundForbidden
        ForbiddenStatus  = $forbiddenStatus
        MissingFields    = $missingFields
        FrontmatterStatus = $frontmatterStatus
        CompatStatus     = $compatStatus
        L3Status         = $l3Status
        HasRefs          = $hasRefs
        OverallStatus    = if (
            $lineStatus -eq '🟢' -and
            $tokenStatus -eq '🟢' -and
            $forbiddenStatus -eq '🟢' -and
            $frontmatterStatus -eq '🟢' -and
            $compatStatus -eq '🟢' -and
            ($l3Status -ne '🟡')
        ) { '🟢' } elseif (
            $lineStatus -eq '🔴' -or
            $tokenStatus -eq '🔴' -or
            $forbiddenStatus -eq '🔴' -or
            $frontmatterStatus -eq '🔴' -or
            $compatStatus -eq '🔴'
        ) { '🔴' } else { '🟡' }
    }
}

# ─── 主執行 ───
$results = @()

if ($Target) {
    $targetPath = (Resolve-Path $Target).Path
    $result = Measure-SingleSkill -SkillDir $targetPath
    if ($result) { $results += $result }
} else {
    # 掃描三個目錄：skills/, memory/, project_skills/
    $agentsRoot = Split-Path $SkillsRoot -Parent
    $scanDirs = @($SkillsRoot)

    $memoryDir = Join-Path $agentsRoot 'memory'
    if (Test-Path $memoryDir) { $scanDirs += $memoryDir }

    $projectDir = Join-Path $agentsRoot 'project_skills'
    if (Test-Path $projectDir) { $scanDirs += $projectDir }

    foreach ($scanRoot in $scanDirs) {
        $skillDirs = Get-ChildItem -Path $scanRoot -Directory | Where-Object {
            $_.Name -notmatch '^_' # 排除 _memory, _project 等 symlink
        }
        foreach ($dir in $skillDirs) {
            $result = Measure-SingleSkill -SkillDir $dir.FullName
            if ($result) { $results += $result }
        }
    }
}

# ─── 輸出報告 ───
$timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss+08:00'
$passCount = ($results | Where-Object { $_.OverallStatus -eq '🟢' }).Count
$warnCount = ($results | Where-Object { $_.OverallStatus -eq '🟡' }).Count
$failCount = ($results | Where-Object { $_.OverallStatus -eq '🔴' }).Count

Write-Host ""
Write-Host "📊 技能品質掃描報告 — $timestamp"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "掃描技能數：$($results.Count)"
Write-Host "🟢 合格：$passCount  🟡 警告：$warnCount  🔴 不合格：$failCount"
Write-Host ""

# 詳細表
$headerFmt = "{0,-30} {1,6} {2,3} {3,7} {4,3} {5,4} {6,4} {7,4} {8,3} {9,4}"
Write-Host ($headerFmt -f '技能名稱', '行數', ' ', 'Token', ' ', '禁詞', 'FM', 'IO', 'L3', '總評')
Write-Host ('-' * 80)

foreach ($r in $results | Sort-Object Name) {
    $line = $headerFmt -f $r.Name, $r.Lines, $r.LineStatus, $r.Tokens, $r.TokenStatus, $r.ForbiddenStatus, $r.FrontmatterStatus, $r.CompatStatus, $r.L3Status, $r.OverallStatus
    Write-Host $line

    # 細節
    if ($r.ForbiddenWords.Count -gt 0) {
        Write-Host "  ⚠ 禁用詞：$($r.ForbiddenWords -join ', ')" -ForegroundColor Yellow
    }
    if ($r.MissingFields.Count -gt 0) {
        Write-Host "  ⚠ 缺少欄位：$($r.MissingFields -join ', ')" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 回傳結果物件（供 Pipeline 使用）
return $results
