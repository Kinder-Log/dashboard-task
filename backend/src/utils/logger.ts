export interface ILogger {
  info(message: string, meta?: object): void;
  error(error: Error, meta?: object): void;
  warn(message: string, meta?: object): void;
}

export class Logger implements ILogger {
  public info(message: string, meta?: object): void {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      ...(meta ? { meta } : {}),
    };
    console.log(JSON.stringify(log));
  }

  public error(error: Error, meta?: object): void {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message,
      stack: error.stack,
      ...(meta ? { meta } : {}),
    };
    console.error(JSON.stringify(log));
  }

  public warn(message: string, meta?: object): void {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      ...(meta ? { meta } : {}),
    };
    console.warn(JSON.stringify(log));
  }
}

export const logger = new Logger();
