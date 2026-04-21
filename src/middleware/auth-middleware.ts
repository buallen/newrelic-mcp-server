/**
 * Authentication Middleware
 * Handles API key validation and authentication
 */

import { MCPRequest, MCPResponse, ErrorType } from '../types/mcp';
import { Middleware } from '../interfaces/mcp-protocol';
import { AuthService, Logger } from '../interfaces/services';

export class AuthMiddleware {
  constructor(
    private authService: AuthService,
    private logger: Logger
  ) {}

  create(): Middleware {
    return async (request: MCPRequest, next: () => Promise<MCPResponse>): Promise<MCPResponse> => {
      // Skip authentication for initialize method
      if (request.method === 'initialize') {
        return await next();
      }

      try {
        // Extract API key from request params or headers
        const apiKey = this.extractApiKey(request);

        if (!apiKey) {
          throw this.createError(-32000, 'API key required', ErrorType.AUTHENTICATION_ERROR);
        }

        // Validate API key
        const isValid = await this.authService.validateApiKey(apiKey);
        if (!isValid) {
          throw this.createError(-32000, 'Invalid API key', ErrorType.AUTHENTICATION_ERROR);
        }

        // Check permissions for the requested operation
        const hasPermission = await this.authService.checkPermissions(apiKey, request.method);
        if (!hasPermission) {
          throw this.createError(
            -32000,
            `Insufficient permissions for method: ${request.method}`,
            ErrorType.AUTHORIZATION_ERROR
          );
        }

        this.logger.debug('Authentication successful', {
          method: request.method,
          id: request.id,
        });

        // Add authenticated context to request
        (request as any).auth = {
          apiKey,
          accountIds: await this.authService.getAccountAccess(apiKey),
        };

        return await next();
      } catch (error) {
        this.logger.warn('Authentication failed', {
          method: request.method,
          id: request.id,
          error: (error as Error).message,
        });

        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: (error as any).code || -32000,
            message: (error as Error).message,
            data: {
              type: (error as any).type || ErrorType.AUTHENTICATION_ERROR,
              details: (error as Error).message,
              retryable: false,
            },
          },
        };
      }
    };
  }

  private extractApiKey(request: MCPRequest): string | null {
    // Try to extract from request params first
    if (request.params && typeof request.params === 'object' && 'apiKey' in request.params) {
      return (request.params as any).apiKey;
    }

    // Try to extract from request context (if set by transport layer)
    if ((request as any).context && (request as any).context.apiKey) {
      return (request as any).context.apiKey;
    }

    // Could also check environment variable as fallback
    return process.env.NEWRELIC_API_KEY || null;
  }

  private createError(code: number, message: string, type: ErrorType): Error {
    const error = new Error(message);
    (error as any).code = code;
    (error as any).type = type;
    return error;
  }
}
