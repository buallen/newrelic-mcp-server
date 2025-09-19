/**
 * Request Router
 * Routes MCP requests to appropriate handlers with middleware support
 */

import { MCPRequest, MCPResponse, MCPError, ErrorType } from '../types/mcp';
import { RequestRouter, RequestHandler, Middleware } from '../interfaces/mcp-protocol';
import { Logger } from '../interfaces/services';

export class RequestRouterImpl implements RequestRouter {
  private handlers = new Map<string, RequestHandler>();
  private middlewares: Middleware[] = [];

  constructor(private logger: Logger) {}

  async route(request: MCPRequest): Promise<MCPResponse> {
    const startTime = Date.now();

    this.logger.debug('Routing request', {
      method: request.method,
      id: request.id,
    });

    try {
      // Get handler for the method
      const handler = this.handlers.get(request.method);
      if (!handler) {
        throw this.createError(
          -32601,
          `Method not found: ${request.method}`,
          ErrorType.VALIDATION_ERROR
        );
      }

      // Execute middleware chain
      const response = await this.executeMiddlewareChain(request, handler);

      const duration = Date.now() - startTime;
      this.logger.logAPICall(request.method, request.params, duration, true);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logAPICall(request.method, request.params, duration, false);

      this.logger.error('Error routing request', error as Error, {
        method: request.method,
        id: request.id,
      });

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: this.createMCPError(error as Error),
      };
    }
  }

  registerHandler(method: string, handler: RequestHandler): void {
    this.logger.debug('Registering handler', { method });
    this.handlers.set(method, handler);
  }

  registerMiddleware(middleware: Middleware): void {
    this.logger.debug('Registering middleware');
    this.middlewares.push(middleware);
  }

  private async executeMiddlewareChain(
    request: MCPRequest,
    handler: RequestHandler
  ): Promise<MCPResponse> {
    let index = 0;

    const next = async (): Promise<MCPResponse> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return await middleware(request, next);
      } else {
        return await handler(request);
      }
    };

    return await next();
  }

  private createError(code: number, message: string, type: ErrorType): Error {
    const error = new Error(message);
    (error as any).code = code;
    (error as any).type = type;
    return error;
  }

  private createMCPError(error: Error): MCPError {
    const code = (error as any).code || -32000;
    const type = (error as any).type || ErrorType.INTERNAL_SERVER_ERROR;

    return {
      code,
      message: error.message,
      data: {
        type,
        details: error.stack || error.message,
        retryable: this.isRetryableError(type),
        retryAfter: this.getRetryDelay(type),
      },
    };
  }

  private isRetryableError(type: ErrorType): boolean {
    return [
      ErrorType.NETWORK_ERROR,
      ErrorType.RATE_LIMIT_ERROR,
      ErrorType.INTERNAL_SERVER_ERROR,
    ].includes(type);
  }

  private getRetryDelay(type: ErrorType): number | undefined {
    switch (type) {
      case ErrorType.RATE_LIMIT_ERROR:
        return 60; // 60 seconds
      case ErrorType.NETWORK_ERROR:
        return 5; // 5 seconds
      default:
        return undefined;
    }
  }

  // Utility methods for handler management
  unregisterHandler(method: string): boolean {
    this.logger.debug('Unregistering handler', { method });
    return this.handlers.delete(method);
  }

  hasHandler(method: string): boolean {
    return this.handlers.has(method);
  }

  getRegisteredMethods(): string[] {
    return Array.from(this.handlers.keys());
  }

  clearHandlers(): void {
    this.logger.debug('Clearing all handlers');
    this.handlers.clear();
  }

  clearMiddlewares(): void {
    this.logger.debug('Clearing all middlewares');
    this.middlewares.length = 0;
  }
}
