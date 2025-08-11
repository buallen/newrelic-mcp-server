/**
 * Middleware Tests
 * Unit tests for middleware functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthMiddleware } from '../../../src/middleware/auth-middleware';
import { LoggingMiddleware } from '../../../src/middleware/logging-middleware';
import { ErrorHandlingMiddleware } from '../../../src/middleware/error-handling-middleware';
import { RateLimitMiddleware } from '../../../src/middleware/rate-limit-middleware';
import { MCPRequest, MCPResponse, ErrorType } from '../../../src/types/mcp';
import { AuthService, Logger, ErrorHandler } from '../../../src/interfaces/services';

describe('Middleware', () => {
  let mockLogger: Logger;
  let mockAuthService: AuthService;
  let mockErrorHandler: ErrorHandler;

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

    mockAuthService = {
      validateApiKey: vi.fn(),
      getAccountAccess: vi.fn(),
      checkPermissions: vi.fn(),
      rotateApiKey: vi.fn(),
      getKeyMetadata: vi.fn(),
    };

    mockErrorHandler = {
      handleError: vi.fn(),
      createMCPError: vi.fn(),
      isRetryableError: vi.fn(),
      getRetryDelay: vi.fn(),
    };
  });

  describe('AuthMiddleware', () => {
    let authMiddleware: AuthMiddleware;

    beforeEach(() => {
      authMiddleware = new AuthMiddleware(mockAuthService, mockLogger);
    });

    it('should skip authentication for initialize method', async () => {
      const middleware = authMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      };

      const mockNext = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      const response = await middleware(request, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockAuthService.validateApiKey).not.toHaveBeenCalled();
      expect(response.result).toEqual({ success: true });
    });

    it('should authenticate valid API key', async () => {
      const middleware = authMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { apiKey: 'valid-key' },
      };

      mockAuthService.validateApiKey = vi.fn().mockResolvedValue(true);
      mockAuthService.checkPermissions = vi.fn().mockResolvedValue(true);
      mockAuthService.getAccountAccess = vi.fn().mockResolvedValue(['123456']);

      const mockNext = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      const response = await middleware(request, mockNext);

      expect(mockAuthService.validateApiKey).toHaveBeenCalledWith('valid-key');
      expect(mockAuthService.checkPermissions).toHaveBeenCalledWith('valid-key', 'tools/list');
      expect(mockNext).toHaveBeenCalled();
      expect((request as any).auth).toEqual({
        apiKey: 'valid-key',
        accountIds: ['123456'],
      });
    });

    it('should reject missing API key', async () => {
      const middleware = authMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      const mockNext = vi.fn();
      const response = await middleware(request, mockNext);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('API key required');
      expect(response.error?.data?.type).toBe(ErrorType.AUTHENTICATION_ERROR);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid API key', async () => {
      const middleware = authMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { apiKey: 'invalid-key' },
      };

      mockAuthService.validateApiKey = vi.fn().mockResolvedValue(false);

      const mockNext = vi.fn();
      const response = await middleware(request, mockNext);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('Invalid API key');
      expect(response.error?.data?.type).toBe(ErrorType.AUTHENTICATION_ERROR);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject insufficient permissions', async () => {
      const middleware = authMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { apiKey: 'valid-key' },
      };

      mockAuthService.validateApiKey = vi.fn().mockResolvedValue(true);
      mockAuthService.checkPermissions = vi.fn().mockResolvedValue(false);

      const mockNext = vi.fn();
      const response = await middleware(request, mockNext);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('Insufficient permissions for method: tools/call');
      expect(response.error?.data?.type).toBe(ErrorType.AUTHORIZATION_ERROR);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('LoggingMiddleware', () => {
    let loggingMiddleware: LoggingMiddleware;

    beforeEach(() => {
      loggingMiddleware = new LoggingMiddleware(mockLogger);
    });

    it('should log request and response', async () => {
      const middleware = loggingMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { test: true },
      };

      const mockNext = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      await middleware(request, mockNext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming MCP request',
        expect.objectContaining({
          requestId: 1,
          method: 'tools/list',
          params: { test: true },
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'MCP request completed',
        expect.objectContaining({
          requestId: 1,
          method: 'tools/list',
          success: true,
        })
      );
    });

    it('should sanitize sensitive parameters', async () => {
      const middleware = loggingMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { 
          apiKey: 'secret-key',
          password: 'secret-password',
          data: { token: 'secret-token' }
        },
      };

      const mockNext = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      await middleware(request, mockNext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Incoming MCP request',
        expect.objectContaining({
          params: {
            apiKey: '[REDACTED]',
            password: '[REDACTED]',
            data: { token: '[REDACTED]' }
          },
        })
      );
    });

    it('should warn about slow requests', async () => {
      const middleware = loggingMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      // Mock a slow response
      const mockNext = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              jsonrpc: '2.0',
              id: 1,
              result: { success: true },
            });
          }, 1100); // Longer than 1000ms threshold
        });
      });

      await middleware(request, mockNext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slow request detected',
        expect.objectContaining({
          requestId: 1,
          method: 'tools/list',
          duration: expect.any(Number),
        })
      );
    });
  });

  describe('ErrorHandlingMiddleware', () => {
    let errorMiddleware: ErrorHandlingMiddleware;

    beforeEach(() => {
      errorMiddleware = new ErrorHandlingMiddleware(mockErrorHandler, mockLogger);
    });

    it('should handle errors and create MCP error response', async () => {
      const middleware = errorMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      const error = new Error('Test error');
      const mockNext = vi.fn().mockRejectedValue(error);

      mockErrorHandler.createMCPError = vi.fn().mockReturnValue({
        code: -32000,
        message: 'Test error',
        data: {
          type: ErrorType.INTERNAL_SERVER_ERROR,
          details: 'Test error',
          retryable: false,
        },
      });

      const response = await middleware(request, mockNext);

      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, {
        method: 'tools/list',
        id: 1,
        params: undefined,
      });

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('Test error');
    });
  });

  describe('RateLimitMiddleware', () => {
    let rateLimitMiddleware: RateLimitMiddleware;

    beforeEach(() => {
      rateLimitMiddleware = new RateLimitMiddleware(mockLogger, {
        windowMs: 60000,
        maxRequests: 2,
      });
    });

    it('should allow requests within limit', async () => {
      const middleware = rateLimitMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      const mockNext = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      const response = await middleware(request, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(response.result).toEqual({ success: true });
      expect((response as any).rateLimit).toBeDefined();
    });

    it('should block requests exceeding limit', async () => {
      const middleware = rateLimitMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      const mockNext = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      // Make requests up to the limit
      await middleware(request, mockNext);
      await middleware(request, mockNext);

      // This should be blocked
      const response = await middleware(request, mockNext);

      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('Rate limit exceeded');
      expect(response.error?.data?.type).toBe(ErrorType.RATE_LIMIT_ERROR);
      expect(response.error?.data?.retryable).toBe(true);
    });

    it('should skip rate limiting for initialize method', async () => {
      const middleware = rateLimitMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      };

      const mockNext = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      const response = await middleware(request, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(response.result).toEqual({ success: true });
    });

    it('should reset limits after window expires', async () => {
      const shortWindowMiddleware = new RateLimitMiddleware(mockLogger, {
        windowMs: 100, // 100ms window
        maxRequests: 1,
      });

      const middleware = shortWindowMiddleware.create();
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      const mockNext = vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });

      // First request should succeed
      await middleware(request, mockNext);

      // Second request should be blocked
      const blockedResponse = await middleware(request, mockNext);
      expect(blockedResponse.error).toBeDefined();

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third request should succeed after window reset
      const successResponse = await middleware(request, mockNext);
      expect(successResponse.result).toEqual({ success: true });
    });
  });
});