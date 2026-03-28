/**
 * Multi-MCP Gateway — CLI 管理主控台入口
 * 分組選單 + 儀表板，所有業務邏輯已拆分到 cli/ 子模組。
 */

// Windows 修正：PowerShell 7 會將 COMSPEC / SHELL 設為 pwsh.exe，
// 導致 cross-spawn 用 cmd.exe 語法 (/d /s /c) 呼叫 pwsh.exe 而失敗。
// 同時清除 SHELL，防止路徑含空格（Program Files）造成 spawn 失敗。
if (process.platform === 'win32') {
  process.env.COMSPEC = process.env.SystemRoot
    ? `${process.env.SystemRoot}\\System32\\cmd.exe`
    : 'C:\\Windows\\System32\\cmd.exe';
  delete process.env.SHELL;
}
import { rl, header, ask, c, sectionTitle } from './cli/shared.js';
import { renderDashboard } from './cli/dashboard.js';
import { viewMCPs, removeMCP, rescan } from './cli/mcp-manager.js';
import { marketplaceMenu } from './cli/marketplace.js';
import { authMenu } from './cli/auth-manager.js';
import { categoryMenu } from './cli/category-manager.js';
import { healthCheckMenu } from './cli/health-check.js';
import { toolBrowserMenu } from './cli/tool-browser.js';
import { versionCheckMenu } from './cli/version-check.js';
import { importExportMenu } from './cli/import-export.js';

// ═══════════════════════════════════
// 主選單
// ═══════════════════════════════════

async function mainMenu(): Promise<void> {
  while (true) {
    header('Multi-MCP Gateway 管理主控台');
    renderDashboard();

    sectionTitle('📦', 'MCP 管理');
    console.log(`  ${c.bold}[1]${c.reset} 檢視已安裝的 MCP`);
    console.log(`  ${c.bold}[2]${c.reset} 🛒 MCP 市集`);
    console.log(`  ${c.bold}[3]${c.reset} 移除 MCP`);

    sectionTitle('🔍', '工具與診斷');
    console.log(`  ${c.bold}[4]${c.reset} 工具瀏覽器`);
    console.log(`  ${c.bold}[5]${c.reset} 🏥 健康檢查`);
    console.log(`  ${c.bold}[6]${c.reset} 🔄 版本檢查`);

    sectionTitle('🔧', '系統設定');
    console.log(`  ${c.bold}[7]${c.reset} 認證管理`);
    console.log(`  ${c.bold}[8]${c.reset} 分類管理`);

    sectionTitle('⚡', '進階');
    console.log(`  ${c.bold}[9]${c.reset} 重新掃描工具`);
    console.log(`  ${c.bold}[E]${c.reset} 匯出 / 匯入設定`);
    console.log(`  ${c.bold}[0]${c.reset} 離開\n`);

    const choice = (await ask('> ')).toUpperCase();
    switch (choice) {
      case '1': await viewMCPs(); break;
      case '2': await marketplaceMenu(rescan); break;
      case '3': await removeMCP(rescan); break;
      case '4': await toolBrowserMenu(); break;
      case '5': await healthCheckMenu(); break;
      case '6': await versionCheckMenu(); break;
      case '7': await authMenu(); break;
      case '8': await categoryMenu(); break;
      case '9': await rescan(); break;
      case 'E': await importExportMenu(); break;
      case '0': rl.close(); process.exit(0);
    }
  }
}

// ─── 啟動 ───

mainMenu().catch(console.error);
