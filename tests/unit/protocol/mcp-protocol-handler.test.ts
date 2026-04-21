/**
 * MCP Protocol Handler Tests
 * Unit tests for MCP protocol handling functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPProtocolHandlerImpl } from '../../../src/protocol/mcp-protocol-handler';
import { Logger } from '../../../src/interfaces/services';
import {
  MCPInitializeRequest,
  MCPToolsListRequest,
  MCPToolCallRequest,
  MCPResourcesListRequest,
  MCPResourceReadRequest,
  MCPNotification,
  ErrorType,
} from '../../../src/types/mcp';

describe('MCPProtocolHandler', () => {
  let handler: MCPProtocolHandlerImpl;
  let mockLogger: Logger;

  beforeEach(async () => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      logAPICall: vi.fn(),
      logIncidentAnalysis: vi.fn(),
      logQueryExecution: vi.fn(),
    };

    handler = new MCPProtocolHandlerImpl(mockLogger);
    await handler.initialize();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newHandler = new MCPProtocolHandlerImpl(mockLogger);
      await newHandler.initialize();
      expect(mockLogger.info).toHaveBeenCalledWith('MCP Protocol Handler initialized successfully');
    });

    it('should handle initialize request', async () => {
      const request: MCPInitializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const response = await handler.handleInitialize(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result?.protocolVersion).toBe('2024-11-05');
      expect(response.result?.serverInfo.name).toBe('newrelic-mcp-server');
    });

    it('should reject unsupported protocol version', async () => {
      const request: MCPInitializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      await expect(handler.handleInitialize(request)).rejects.toThrow(
        'Unsupported protocol version: 1.0.0'
      );
    });
  });

  describe('request handling', () => {
    it('should handle valid JSON-RPC request', async () => {
      const request: MCPToolsListRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
    });

    it('should reject invalid JSON-RPC version', async () => {
      const request = {
        jsonrpc: '1.0',
        id: 1,
        method: 'tools/list',
      } as any;

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600);
      expect(response.error?.message).toBe('Invalid JSON-RPC version');
    });

    it('should reject request without ID', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
      } as any;

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600);
      expect(response.error?.message).toBe('Missing request ID');
    });

    it('should reject unknown method', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'unknown/method',
      } as any;

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toBe('Method not found: unknown/method');
    });
  });

  describe('tools handling', () => {
    it('should list available tools', async () => {
      const request: MCPToolsListRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      const response = await handler.handleToolsList(request);

      expect(response.result?.tools).toBeDefined();
      expect(response.result?.tools.length).toBeGreaterThan(0);

      const nrqlTool = response.result?.tools.find(tool => tool.name === 'nrql_query');
      expect(nrqlTool).toBeDefined();
      expect(nrqlTool?.description).toBe('Execute NRQL queries against NewRelic data');
    });

    it('should handle tool call request', async () => {
      const request: MCPToolCallRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'nrql_query',
          arguments: {
            query: 'SELECT * FROM Transaction',
          },
        },
      };

      const response = await handler.handleToolCall(request);

      expect(response.result?.content).toBeDefined();
      expect(response.result?.content[0].type).toBe('text');
      expect(response.result?.isError).toBe(false);
    });
  });

  describe('resources handling', () => {
    it('should list available resources', async () => {
      const request: MCPResourcesListRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list',
      };

      const response = await handler.handleResourcesList(request);

      expect(response.result?.resources).toBeDefined();
      expect(response.result?.resources.length).toBeGreaterThan(0);

      const appsResource = response.result?.resources.find(
        resource => resource.uri === 'newrelic://applications'
      );
      expect(appsResource).toBeDefined();
      expect(appsResource?.name).toBe('Applications');
    });

    it('should handle resource read request', async () => {
      const request: MCPResourceReadRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {
          uri: 'newrelic://applications',
        },
      };

      const response = await handler.handleResourceRead(request);

      expect(response.result?.contents).toBeDefined();
      expect(response.result?.contents[0].uri).toBe('newrelic://applications');
      expect(response.result?.contents[0].mimeType).toBe('application/json');
    });
  });

  describe('notification handling', () => {
    it('should handle initialized notification', async () => {
      const notification: MCPNotification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      };

      await handler.handleNotification(notification);

      expect(mockLogger.info).toHaveBeenCalledWith('Client initialized notification received');
    });

    it('should handle cancelled notification', async () => {
      const notification: MCPNotification = {
        jsonrpc: '2.0',
        method: 'notifications/cancelled',
        params: { id: 1 },
      };

      await handler.handleNotification(notification);

      expect(mockLogger.info).toHaveBeenCalledWith('Request cancelled notification received', {
        id: 1,
      });
    });

    it('should handle unknown notification', async () => {
      const notification: MCPNotification = {
        jsonrpc: '2.0',
        method: 'unknown/notification',
      };

      await handler.handleNotification(notification);

      expect(mockLogger.warn).toHaveBeenCalledWith('Unknown notification method', {
        method: 'unknown/notification',
      });
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize requests', () => {
      const request: MCPToolsListRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      const serialized = handler.serializeRequest(request);
      const deserialized = handler.deserializeRequest(serialized);

      expect(deserialized).toEqual(request);
    });

    it('should serialize and deserialize responses', () => {
      const response = {
        jsonrpc: '2.0' as const,
        id: 1,
        result: { test: true },
      };

      const serialized = handler.serializeResponse(response);
      const deserialized = handler.deserializeResponse(serialized);

      expect(deserialized).toEqual(response);
    });

    it('should serialize and deserialize notifications', () => {
      const notification: MCPNotification = {
        jsonrpc: '2.0',
        method: 'test/notification',
        params: { test: true },
      };

      const serialized = handler.serializeNotification(notification);
      const deserialized = handler.deserializeNotification(serialized);

      expect(deserialized).toEqual(notification);
    });

    it('should handle invalid JSON in deserialization', () => {
      expect(() => handler.deserializeRequest('invalid json')).toThrow('Parse error');
      expect(() => handler.deserializeResponse('invalid json')).toThrow('Parse error');
      expect(() => handler.deserializeNotification('invalid json')).toThrow('Parse error');
    });
  });

  describe('error handling', () => {
    it('should create retryable errors correctly', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      } as any;

      // Mock an error that would be thrown
      const originalHandleToolsList = handler.handleToolsList;
      handler.handleToolsList = vi.fn().mockRejectedValue(
        Object.assign(new Error('Network error'), {
          code: -32000,
          type: ErrorType.NETWORK_ERROR,
        })
      );

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.data?.retryable).toBe(true);
      expect(response.error?.data?.retryAfter).toBe(5);

      // Restore original method
      handler.handleToolsList = originalHandleToolsList;
    });

    it('should create non-retryable errors correctly', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      } as any;

      // Mock an error that would be thrown
      const originalHandleToolsList = handler.handleToolsList;
      handler.handleToolsList = vi.fn().mockRejectedValue(
        Object.assign(new Error('Validation error'), {
          code: -32600,
          type: ErrorType.VALIDATION_ERROR,
        })
      );

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.data?.retryable).toBe(false);
      expect(response.error?.data?.retryAfter).toBeUndefined();

      // Restore original method
      handler.handleToolsList = originalHandleToolsList;
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await handler.shutdown();

      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down MCP Protocol Handler');
      expect(mockLogger.info).toHaveBeenCalledWith('MCP Protocol Handler shutdown complete');
    });

    it('should reject requests after shutdown', async () => {
      await handler.shutdown();

      const request: MCPToolsListRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };

      await expect(handler.handleToolsList(request)).rejects.toThrow('Server not initialized');
    });
  });
});
