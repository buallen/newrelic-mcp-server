/**
 * MCP-Compatible Logger Implementation
 * Logger that outputs to stderr only to avoid corrupting MCP JSON protocol on stdout
 */

import { Logger } from '../interfaces/services';

export class MCPLogger implements Logger {
  constructor(private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'error') {}

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      process.stderr.write(`[DEBUG] ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      process.stderr.write(`[INFO] ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      process.stderr.write(`[WARN] ${message} ${meta ? JSON.stringify(meta) : ''}\n`);
    }
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      process.stderr.write(`[ERROR] ${message} ${error?.message || ''} ${meta ? JSON.stringify(meta) : ''}\n`);
    }
  }

  logAPICall(method: string, params: unknown, duration: number, success: boolean, meta?: Record<string, unknown>): void {
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

  logCacheOperation(operation: string, key: string, hit: boolean, duration?: number): void {
    this.debug(`Cache ${operation}`, { key, hit, duration });
  }

  logAuthentication(success: boolean, details?: Record<string, unknown>): void {
    this.info(`Authentication ${success ? 'successful' : 'failed'}`, details);
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }
}