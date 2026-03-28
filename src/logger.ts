/**
 * Multi-MCP Gateway — 結構化日誌系統
 * 輸出到 stderr，避免干擾 stdio MCP 通訊
 */
import type { LogLevel } from './types.js';

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLevel: LogLevel = 'info';

/** 設定日誌等級 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/** 寫入結構化日誌到 stderr */
function log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...(data ? { data } : {}),
  };
  process.stderr.write(JSON.stringify(entry) + '\n');
}

/** 建立指定模組的日誌介面 */
export function createLogger(module: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => log('debug', module, msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log('info', module, msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log('warn', module, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log('error', module, msg, data),
  };
}
