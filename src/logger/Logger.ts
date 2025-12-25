import fs from 'fs';
import path from 'path';

import log from 'loglevel';

const isTest = process.env.VITEST === 'true';

const LOG_BASE_DIR = path.join(process.cwd(), 'log');
const LOG_DIR = isTest ? path.join(LOG_BASE_DIR, 'test') : LOG_BASE_DIR;
const LOG_FILE = path.join(LOG_DIR, 'application.log');
const LOG_MAX_FILE_SIZE = 10 * 1024 * 1024;
const LOG_MAX_FILES = 10;

let currentFileSize = 0;
let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  if (fs.existsSync(LOG_FILE)) {
    currentFileSize = fs.statSync(LOG_FILE).size;
  }
  initialized = true;
}

function rotateLogFile(): void {
  for (let i = LOG_MAX_FILES - 1; i >= 1; i--) {
    const currentFile = `${LOG_FILE}.${i}`;
    const nextFile = `${LOG_FILE}.${i + 1}`;

    if (fs.existsSync(currentFile)) {
      if (i === LOG_MAX_FILES - 1) {
        fs.unlinkSync(currentFile);
      } else {
        fs.renameSync(currentFile, nextFile);
      }
    }
  }

  if (fs.existsSync(LOG_FILE)) {
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  }

  currentFileSize = 0;
}

function createLogger(logname: string): log.Logger {
  ensureInitialized();
  const logger = log.getLogger(logname);

  if ((logger as any).__customized) {
    return logger;
  }

  logger.methodFactory = (methodName, _logLevel, loggerName) => {
    return (...args: any[]) => {
      try {
        const now = new Date();
        const timestamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().replace('T', ' ').split('.')[0];
        const source = loggerName ? ` [${String(loggerName)}]` : '';

        let fullMessage = String(args[0] || '');
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg instanceof Error) {
            fullMessage += ` ${arg.stack || arg.message || arg}`;
          } else if (arg !== undefined) {
            fullMessage += ` ${String(arg)}`;
          }
        }

        const logLine = `${timestamp} ${methodName.toUpperCase()}${source}: ${fullMessage}\n`;
        const logLineSize = Buffer.byteLength(logLine, 'utf8');

        if (currentFileSize + logLineSize > LOG_MAX_FILE_SIZE) {
          rotateLogFile();
        }

        fs.appendFileSync(LOG_FILE, logLine);
        currentFileSize += logLineSize;
      } catch {
        // ignore file write errors
      }
    };
  };

  (logger as any).__customized = true;
  logger.setLevel((process.env.LOG_LEVEL || 'info') as log.LogLevelDesc);

  return logger;
}

export { createLogger };
