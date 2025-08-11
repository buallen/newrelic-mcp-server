/**
 * Logging Middleware
 * Logs request/response details and performance metrics
 */

import { MCPRequest, MCPResponse } from '../types/mcp';
import { Middleware } from '../interfaces/mcp-protocol';
import { Logger } from '../interfaces/services';

export class LoggingMiddleware {
  constructor(private logger: Logger) {}

  create(): Middleware {
    return async (request: MCPRequest, next: () => Promise<MCPResponse>): Promise<MCPResponse> => {
      const startTime = Date.now();
      const requestId = request.id;
      const method = request.method;

      // Log incoming request
      this.logger.info('Incoming MCP request', {
        requestId,
        method,
        params: this.sanitizeParams(request.params),
        timestamp: new Date().toISOString(),
      });

      try {
        const response = await next();
        const duration = Date.now() - startTime;

        // Log successful response
        this.logger.info('MCP request completed', {
          requestId,
          method,
          duration,
          success: !response.error,
          timestamp: new Date().toISOString(),
        });

        // Log performance metrics
        if (duration > 1000) {
          this.logger.warn('Slow request detected', {
            requestId,
            method,
            duration,
          });
        }

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Log error
        this.logger.error('MCP request failed', error as Error, {
          requestId,
          method,
          duration,
          timestamp: new Date().toISOString(),
        });

        throw error;
      }
    };
  }

  private sanitizeParams(params: unknown): unknown {
    if (!params || typeof params !== 'object') {
      return params;
    }

    const sanitized = { ...params } as any;

    // Remove sensitive information
    const sensitiveKeys = ['apiKey', 'password', 'token', 'secret', 'key'];
    
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeParams(value);
      }
    }

    return sanitized;
  }
}