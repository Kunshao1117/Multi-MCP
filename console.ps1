# Multi-MCP Gateway 管理主控台啟動腳本
# 用法：在任意位置執行 d:\Multi-MCP\console.ps1 即可開啟主控台

# 1. 檢查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 找不到 Node.js，請先安裝: https://nodejs.org" -ForegroundColor Red
    Read-Host "按 Enter 離開"
    exit 1
}

# 2. 檢查依賴
Set-Location -Path $PSScriptRoot
if (-not (Test-Path "$PSScriptRoot\node_modules")) {
    Write-Host "📦 首次使用，正在安裝依賴..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 依賴安裝失敗" -ForegroundColor Red
        Read-Host "按 Enter 離開"
        exit 1
    }
    Write-Host ""
}

# 3. 啟動主控台
npx tsx src/cli.ts
