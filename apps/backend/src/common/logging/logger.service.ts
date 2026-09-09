import { Injectable, type LoggerService } from '@nestjs/common';

@Injectable()
export class StructuredLogger implements LoggerService {
  private logLevel = 'info';

  constructor() {}

  setLogLevel(level: string): void {
    this.logLevel = level;
  }

  private shouldLog(level: string): boolean {
    if (this.logLevel === 'silent') return false;
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private write(level: string, message: unknown, context?: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? 'Application',
      message: typeof message === 'string' ? message : JSON.stringify(message),
      ...(metadata ?? {}),
    };

    const json = JSON.stringify(payload);
    if (level === 'error') {
      process.stderr.write(json + '\n');
    } else {
      process.stdout.write(json + '\n');
    }
  }

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace ? { stack: trace } : undefined);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug?(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose?(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
}