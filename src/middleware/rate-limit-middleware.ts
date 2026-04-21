/**
 * Rate Limiting Middleware
 * Implements rate limiting to prevent API abuse
 */

import { MCPRequest, MCPResponse, ErrorType } from '../types/mcp';
import { Middleware } from '../interfaces/mcp-protocol';
import { Logger } from '../interfaces/services';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimitMiddleware {
  private rateLimits = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(
    private logger: Logger,
    options: {
      windowMs?: number;
      maxRequests?: number;
    } = {}
  ) {
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.maxRequests = options.maxRequests || 100;
  }

  create(): Middleware {
    return async (request: MCPRequest, next: () => Promise<MCPResponse>): Promise<MCPResponse> => {
      // Skip rate limiting for initialize method
      if (request.method === 'initialize') {
        return await next();
      }

      const clientId = this.getClientId(request);
      const now = Date.now();

      // Clean up expired entries
      this.cleanupExpiredEntries(now);

      // Get or create rate limit entry
      let entry = this.rateLimits.get(clientId);
      if (!entry || now >= entry.resetTime) {
        entry = {
          count: 0,
          resetTime: now + this.windowMs,
        };
        this.rateLimits.set(clientId, entry);
      }

      // Check rate limit
      if (entry.count >= this.maxRequests) {
        const resetIn = Math.ceil((entry.resetTime - now) / 1000);

        this.logger.warn('Rate limit exceeded', {
          clientId,
          method: request.method,
          count: entry.count,
          resetIn,
        });

        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32000,
            message: 'Rate limit exceeded',
            data: {
              type: ErrorType.RATE_LIMIT_ERROR,
              details: `Too many requests. Limit: ${this.maxRequests} per ${this.windowMs / 1000}s`,
              retryable: true,
              retryAfter: resetIn,
            },
          },
        };
      }

      // Increment counter
      entry.count++;

      // Add rate limit headers to response
      const response = await next();

      // Add rate limit information to response metadata
      if (!response.error) {
        (response as any).rateLimit = {
          limit: this.maxRequests,
          remaining: this.maxRequests - entry.count,
          reset: entry.resetTime,
        };
      }

      return response;
    };
  }

  private getClientId(request: MCPRequest): string {
    // Try to get client ID from authenticated context
    if ((request as any).auth && (request as any).auth.apiKey) {
      return `api:${(request as any).auth.apiKey}`;
    }

    // Try to get from request context (IP address, etc.)
    if ((request as any).context && (request as any).context.clientId) {
      return (request as any).context.clientId;
    }

    // Fallback to a default identifier
    return 'anonymous';
  }

  private cleanupExpiredEntries(now: number): void {
    for (const [clientId, entry] of this.rateLimits.entries()) {
      if (now >= entry.resetTime) {
        this.rateLimits.delete(clientId);
      }
    }
  }

  // Utility methods for testing and monitoring
  getCurrentLimits(): Map<string, RateLimitEntry> {
    return new Map(this.rateLimits);
  }

  resetLimits(): void {
    this.rateLimits.clear();
  }

  getLimitForClient(clientId: string): RateLimitEntry | undefined {
    return this.rateLimits.get(clientId);
  }
}
