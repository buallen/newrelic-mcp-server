/**
 * Request Router Tests
 * Unit tests for request routing functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestRouterImpl } from '../../../src/protocol/request-router';
import { MCPRequest, MCPResponse } from '../../../src/types/mcp';
import { RequestHandler, Middleware } from '../../../src/interfaces/mcp-protocol';
import { Logger } from '../../../src/interfaces/services';

describe('RequestRouter', () => {
  let router: RequestRouterImpl;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      logAPICall: vi.fn(),
      logIncidentAnalysis: vi.fn(),
      logQueryExecution: vi.fn(),
    };

    router = new RequestRouterImpl(mockLogger);
  });

  describe('handler registration', () => {
    it('should register and route to handler', async () => {
      const mockHandler: RequestHandler = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      router.registerHandler('test/method', mockHandler);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
        params: { test: true },
      };

      const response = await router.route(request);

      expect(mockHandler).toHaveBeenCalledWith(request);
      expect(response.result).toEqual({ success: true });
    });

    it('should return error for unregistered method', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'unknown/method',
      };

      const response = await router.route(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toBe('Method not found: unknown/method');
    });

    it('should unregister handler', () => {
      const mockHandler: RequestHandler = vi.fn();
      router.registerHandler('test/method', mockHandler);

      expect(router.hasHandler('test/method')).toBe(true);

      const result = router.unregisterHandler('test/method');

      expect(result).toBe(true);
      expect(router.hasHandler('test/method')).toBe(false);
    });

    it('should return false when unregistering non-existent handler', () => {
      const result = router.unregisterHandler('non/existent');
      expect(result).toBe(false);
    });

    it('should list registered methods', () => {
      router.registerHandler('method1', vi.fn());
      router.registerHandler('method2', vi.fn());

      const methods = router.getRegisteredMethods();

      expect(methods).toContain('method1');
      expect(methods).toContain('method2');
      expect(methods).toHaveLength(2);
    });

    it('should clear all handlers', () => {
      router.registerHandler('method1', vi.fn());
      router.registerHandler('method2', vi.fn());

      router.clearHandlers();

      expect(router.getRegisteredMethods()).toHaveLength(0);
    });
  });

  describe('middleware execution', () => {
    it('should execute middleware in order', async () => {
      const executionOrder: string[] = [];

      const middleware1: Middleware = async (request, next) => {
        executionOrder.push('middleware1-before');
        const response = await next();
        executionOrder.push('middleware1-after');
        return response;
      };

      const middleware2: Middleware = async (request, next) => {
        executionOrder.push('middleware2-before');
        const response = await next();
        executionOrder.push('middleware2-after');
        return response;
      };

      const mockHandler: RequestHandler = vi.fn().mockImplementation(() => {
        executionOrder.push('handler');
        return Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: { success: true },
        });
      });

      router.registerMiddleware(middleware1);
      router.registerMiddleware(middleware2);
      router.registerHandler('test/method', mockHandler);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
      };

      await router.route(request);

      expect(executionOrder).toEqual([
        'middleware1-before',
        'middleware2-before',
        'handler',
        'middleware2-after',
        'middleware1-after',
      ]);
    });

    it('should allow middleware to modify request', async () => {
      const middleware: Middleware = async (request, next) => {
        // Add metadata to request
        (request as any).metadata = { processed: true };
        return await next();
      };

      const mockHandler: RequestHandler = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      router.registerMiddleware(middleware);
      router.registerHandler('test/method', mockHandler);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
      };

      await router.route(request);

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          ...request,
          metadata: { processed: true },
        })
      );
    });

    it('should allow middleware to modify response', async () => {
      const middleware: Middleware = async (request, next) => {
        const response = await next();
        // Add metadata to response
        (response as any).metadata = { processed: true };
        return response;
      };

      const mockHandler: RequestHandler = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      router.registerMiddleware(middleware);
      router.registerHandler('test/method', mockHandler);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
      };

      const response = await router.route(request);

      expect((response as any).metadata).toEqual({ processed: true });
    });

    it('should handle middleware errors', async () => {
      const middleware: Middleware = async () => {
        throw new Error('Middleware error');
      };

      const mockHandler: RequestHandler = vi.fn();

      router.registerMiddleware(middleware);
      router.registerHandler('test/method', mockHandler);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
      };

      const response = await router.route(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('Middleware error');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should clear all middlewares', () => {
      const middleware1: Middleware = vi.fn();
      const middleware2: Middleware = vi.fn();

      router.registerMiddleware(middleware1);
      router.registerMiddleware(middleware2);

      router.clearMiddlewares();

      // Verify middlewares are cleared by checking they don't execute
      const mockHandler: RequestHandler = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      router.registerHandler('test/method', mockHandler);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
      };

      router.route(request);

      expect(middleware1).not.toHaveBeenCalled();
      expect(middleware2).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle handler errors', async () => {
      const mockHandler: RequestHandler = vi.fn().mockRejectedValue(new Error('Handler error'));

      router.registerHandler('test/method', mockHandler);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
      };

      const response = await router.route(request);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('Handler error');
    });

    it('should log API calls with success/failure', async () => {
      const mockHandler: RequestHandler = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      router.registerHandler('test/method', mockHandler);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
        params: { test: true },
      };

      await router.route(request);

      expect(mockLogger.logAPICall).toHaveBeenCalledWith(
        'test/method',
        { test: true },
        expect.any(Number),
        true
      );
    });

    it('should log API calls on failure', async () => {
      const mockHandler: RequestHandler = vi.fn().mockRejectedValue(new Error('Handler error'));

      router.registerHandler('test/method', mockHandler);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test/method',
        params: { test: true },
      };

      await router.route(request);

      expect(mockLogger.logAPICall).toHaveBeenCalledWith(
        'test/method',
        { test: true },
        expect.any(Number),
        false
      );
    });
  });
});
