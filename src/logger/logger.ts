import fs from 'fs';
import path from 'path';

import log from 'loglevel';

interface CustomLogger extends log.Logger {
  __customized?: boolean;
}

const isTest = process.env.VITEST === 'true';

const LOG_BASE_DIR = path.join(process.cwd(), 'log');
const LOG_DIR = isTest ? path.join(LOG_BASE_DIR, 'test') : LOG_BASE_DIR;
const LOG_FILE = path.join(LOG_DIR, 'application.log');

let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  initialized = true;
}

function createLogger(logname: string): log.Logger {
  ensureInitialized();
  const logger = log.getLogger(logname) as CustomLogger;

  if (logger.__customized) {
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
        fs.appendFileSync(LOG_FILE, logLine);
      } catch {
        // ignore file write errors
      }
    };
  };

  logger.__customized = true;
  logger.setLevel((process.env.LOG_LEVEL || 'info') as log.LogLevelDesc);

  return logger;
}

export { createLogger };
