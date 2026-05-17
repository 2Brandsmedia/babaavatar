import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
}

let logFilePath: string | null = null;
let logStream: fs.WriteStream | null = null;

function ensureLogFile(): fs.WriteStream | null {
  if (!app.isReady()) return null;
  if (logStream) return logStream;

  const logsDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  logFilePath = path.join(logsDir, `babaavatar-${today}.log`);
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  return logStream;
}

function write(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): void {
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  const stream = ensureLogFile();
  if (stream) stream.write(`${line}\n`);
}

export function createLogger(moduleName: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) => write('debug', moduleName, message, data),
    info: (message: string, data?: Record<string, unknown>) => write('info', moduleName, message, data),
    warn: (message: string, data?: Record<string, unknown>) => write('warn', moduleName, message, data),
    error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
      const errorPayload =
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { value: String(error) };
      write('error', moduleName, message, { ...data, error: errorPayload });
    },
  };
}

export function getLogFilePath(): string | null {
  return logFilePath;
}

export function closeLogger(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}
