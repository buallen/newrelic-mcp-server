/**
 * Logger Implementation
 * Simple console-based logger
 */

import { Logger } from '../interfaces/services';

export class ConsoleLogger implements Logger {
  constructor(private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {}

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, error?.message || '', meta ? JSON.stringify(meta) : '');
    }
  }

  logAPICall(
    method: string,
    params: unknown,
    duration: number,
    success: boolean,
    meta?: Record<string, unknown>
  ): void {
    this.info(`API Call: ${method}`, {
      duration,
      success,
      params: typeof params === 'object' ? JSON.stringify(params) : params,
      ...meta,
    });
  }

  logIncidentAnalysis(incidentId: string, analysisResult: unknown): void {
    this.info(`Incident Analysis: ${incidentId}`, { analysisResult });
  }

  logQueryExecution(query: string, resultCount: number, duration: number): void {
    this.info(`Query Executed`, {
      query: query.substring(0, 100) + '...',
      resultCount,
      duration,
    });
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }
}

// Export both the interface and implementation
export { Logger } from '../interfaces/services';
