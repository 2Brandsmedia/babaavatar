type LogLevel = 'info' | 'warn' | 'error';

export interface RendererLogger {
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
}

function format(module: string, level: LogLevel, message: string, data?: unknown): string {
  const payload =
    data === undefined
      ? ''
      : ` ${
          data instanceof Error
            ? data.message
            : typeof data === 'string'
              ? data
              : JSON.stringify(data)
        }`;
  return `[${module}] [${level}] ${message}${payload}`;
}

export function createLogger(module: string): RendererLogger {
  return {
    info: (message, data) => {
      console.info(format(module, 'info', message, data));
    },
    warn: (message, data) => {
      console.warn(format(module, 'warn', message, data));
    },
    error: (message, data) => {
      console.error(format(module, 'error', message, data));
    },
  };
}
