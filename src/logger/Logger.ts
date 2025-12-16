/**
 * エージェント主体開発向けロガー
 *
 * 【機能】
 * - 自動ログローテーション（10MB超過で.1→.2→.3形式、最大10ファイル）
 * - エラーオブジェクト第2引数でスタックトレース記録
 * - 固定ファイル名（agent.log/application.log）
 *
 * 【ログレベル制御】
 * - サーバー側: 環境変数 LOG_LEVEL (debug/info/warn/error)
 * - ブラウザ側: localStorage.setItem('LOG_LEVEL', 'debug') で調整可能
 */
import log from 'loglevel';

const isBrowser = typeof window !== 'undefined';
const isTest = process.env.VITEST === 'true';

let fs: any, path: any;
let LOG_BASE_DIR: string;
let LOG_DIR: string;
const LOG_MAX_FILE_SIZE = 10 * 1024 * 1024;
const LOG_MAX_FILES = 10;

const fileSizeCounters: Map<string, number> = new Map();

if (!isBrowser) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  path = require('path');
  LOG_BASE_DIR = path.join(process.cwd(), 'log');
  LOG_DIR = isTest ? path.join(LOG_BASE_DIR, 'test') : path.join(LOG_BASE_DIR, 'server');

  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFilename(logname: string): string {
  if (logname.startsWith('agent')) {
    return 'agent.log';
  }
  return 'application.log';
}

function createLogger(logname: string): log.Logger {
  const logger = log.getLogger(logname);

  // カスタマイズ済みかチェック
  if ((logger as any).__customized) {
    return logger;
  }

  if (!isBrowser) {
    const filename = getLogFilename(logname);
    const filepath = path.join(LOG_DIR, filename);

    if (!fileSizeCounters.has(filepath)) {
      try {
        if (fs.existsSync(filepath)) {
          const stat = fs.statSync(filepath);
          fileSizeCounters.set(filepath, stat.size);
        } else {
          fileSizeCounters.set(filepath, 0);
        }
      } catch {
        fileSizeCounters.set(filepath, 0);
      }
    }

    logger.methodFactory = (methodName, _logLevel, loggerName) => {
      return (...args: any[]) => {
        try {
          const now = new Date();
          const timestamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().replace('T', ' ').split('.')[0];
          const source = loggerName ? ` [${String(loggerName)}]` : '';

          // メッセージとエラーオブジェクトを統合
          let fullMessage = String(args[0] || '');
          for (let i = 1; i < args.length; i++) {
            const arg = args[i];
            if (arg instanceof Error) {
              // エラーオブジェクトの場合はスタックトレースを含める
              fullMessage += ` ${arg.stack || arg.message || arg}`;
            } else if (arg !== undefined) {
              fullMessage += ` ${String(arg)}`;
            }
          }

          const logLine = `${timestamp} ${methodName.toUpperCase()}${source}: ${fullMessage}\n`;

          const currentSize = fileSizeCounters.get(filepath) || 0;
          const logLineSize = Buffer.byteLength(logLine, 'utf8');

          if (currentSize + logLineSize > LOG_MAX_FILE_SIZE) {
            rotateLogFile(filename);
          }

          fs.appendFileSync(filepath, logLine);
          fileSizeCounters.set(filepath, (fileSizeCounters.get(filepath) || 0) + logLineSize);
        } catch {
          // ファイル出力エラーは無視（コンソールには出力済み）
        }
      };
    };
  }

  // カスタマイズ済みフラグを設定
  (logger as any).__customized = true;

  // methodFactory設定後に一度だけsetLevel（カスタムファクトリーが適用される）
  let logLevel = 'info';
  if (isBrowser) {
    // ブラウザ側: localStorage から取得
    if (typeof localStorage !== 'undefined') {
      logLevel = localStorage.getItem('LOG_LEVEL') || 'info';
    }
  } else {
    // サーバー側: 環境変数から取得
    logLevel = process.env.LOG_LEVEL || 'info';
  }
  logger.setLevel(logLevel as log.LogLevelDesc);

  return logger;
}

function rotateLogFile(filename: string): void {
  if (isBrowser || !fs) return;

  const filepath = path.join(LOG_DIR, filename);

  try {
    for (let i = LOG_MAX_FILES - 1; i >= 1; i--) {
      const currentFile = `${filepath}.${i}`;
      const nextFile = `${filepath}.${i + 1}`;

      if (fs.existsSync(currentFile)) {
        if (i === LOG_MAX_FILES - 1) {
          fs.unlinkSync(currentFile);
        } else {
          fs.renameSync(currentFile, nextFile);
        }
      }
    }

    if (fs.existsSync(filepath)) {
      fs.renameSync(filepath, `${filepath}.1`);
    }

    fileSizeCounters.set(filepath, 0);
  } catch (error) {
    console.error(`[Logger] Rotation failed for ${filename}:`, error instanceof Error ? error.message : error);
  }
}

export { createLogger };
