/**
 * Error Handling Middleware
 * Provides centralized error handling and recovery
 */

import { MCPRequest, MCPResponse, MCPError, ErrorType } from '../types/mcp';
import { Middleware } from '../interfaces/mcp-protocol';
import { Logger, ErrorHandler } from '../interfaces/services';

export class ErrorHandlingMiddleware {
  constructor(
    private errorHandler: ErrorHandler,
    private logger: Logger
  ) {}

  create(): Middleware {
    return async (request: MCPRequest, next: () => Promise<MCPResponse>): Promise<MCPResponse> => {
      try {
        return await next();
      } catch (error) {
        const mcpError = await this.handleError(error as Error, request);
        
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: mcpError,
        };
      }
    };
  }

  private async handleError(error: Error, request: MCPRequest): Promise<MCPError> {
    // Log the error with context
    await this.errorHandler.handleError(error, {
      method: request.method,
      id: request.id,
      params: request.params,
    });

    // Create MCP error response
    const mcpError = this.errorHandler.createMCPError(error);

    // Add additional context for debugging
    if (process.env.NODE_ENV === 'development') {
      mcpError.data = {
        type: mcpError.data?.type || ErrorType.INTERNAL_SERVER_ERROR,
        details: mcpError.data?.details || error.message,
        retryable: mcpError.data?.retryable || false,
        retryAfter: mcpError.data?.retryAfter,
        stack: error.stack,
        request: {
          method: request.method,
          id: request.id,
        },
      };
    }

    return mcpError;
  }
}