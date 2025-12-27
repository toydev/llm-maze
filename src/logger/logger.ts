import fs from 'fs';
import path from 'path';

import log from 'loglevel';

const isTest = process.env.VITEST === 'true';

const LOG_DIR = path.join(process.cwd(), 'log');
const LOG_FILE = path.join(LOG_DIR, isTest ? 'test.log' : 'maze.log');

let logDirInitialized = false;
const customizedNames = new Set<string>();

function ensureLogDir(): void {
  if (logDirInitialized) return;
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  logDirInitialized = true;
}

function createLogger(logname: string): log.Logger {
  ensureLogDir();
  const logger = log.getLogger(logname);

  if (customizedNames.has(logname)) {
    return logger;
  }

  logger.methodFactory = (methodName: log.LogLevelNames, _logLevel: log.LogLevelNumbers, loggerName: string | symbol): log.LoggingMethod => {
    return (...args) => {
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

  customizedNames.add(logname);
  logger.setLevel((process.env.LOG_LEVEL || 'info') as log.LogLevelDesc);

  return logger;
}

export { createLogger };
