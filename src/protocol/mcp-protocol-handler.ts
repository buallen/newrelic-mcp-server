/**
 * MCP Protocol Handler
 * Handles JSON-RPC 2.0 message format for MCP protocol
 */

import {
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPInitializeRequest,
  MCPInitializeResponse,
  MCPToolsListRequest,
  MCPToolsListResponse,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPResourcesListRequest,
  MCPResourcesListResponse,
  MCPResourceReadRequest,
  MCPResourceReadResponse,
  MCPError,
  ErrorType,
  MCPCapabilities,
} from '../types/mcp';
import { MCPProtocolHandler } from '../interfaces/mcp-protocol';
import { Logger } from '../interfaces/services';

export class MCPProtocolHandlerImpl implements MCPProtocolHandler {
  private initialized = false;
  private capabilities: MCPCapabilities = {};
  private clientInfo: { name: string; version: string } | null = null;

  constructor(private logger: Logger) {}

  async initialize(): Promise<void> {
    this.logger.info('Initializing MCP Protocol Handler');
    this.capabilities = {
      tools: {
        listChanged: true,
      },
      resources: {
        subscribe: false,
        listChanged: true,
      },
      logging: {
        level: 'info',
      },
    };
    this.initialized = true;
    this.logger.info('MCP Protocol Handler initialized successfully');
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    this.logger.debug('Handling MCP request', { method: request.method, id: request.id });

    try {
      this.validateRequest(request);

      switch (request.method) {
        case 'initialize':
          return await this.handleInitialize(request as MCPInitializeRequest);
        case 'tools/list':
          return await this.handleToolsList(request as MCPToolsListRequest);
        case 'tools/call':
          return await this.handleToolCall(request as MCPToolCallRequest);
        case 'resources/list':
          return await this.handleResourcesList(request as MCPResourcesListRequest);
        case 'resources/read':
          return await this.handleResourceRead(request as MCPResourceReadRequest);
        default:
          throw this.createError(
            -32601,
            `Method not found: ${request.method}`,
            ErrorType.VALIDATION_ERROR
          );
      }
    } catch (error) {
      this.logger.error('Error handling MCP request', error as Error, {
        method: request.method,
        id: request.id,
      });

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: error instanceof Error ? this.createMCPError(error) : this.createMCPError(new Error('Unknown error')),
      };
    }
  }

  async handleNotification(notification: MCPNotification): Promise<void> {
    this.logger.debug('Handling MCP notification', { method: notification.method });

    try {
      switch (notification.method) {
        case 'notifications/initialized':
          this.logger.info('Client initialized notification received');
          break;
        case 'notifications/cancelled':
          this.logger.info('Request cancelled notification received', notification.params as Record<string, unknown>);
          break;
        default:
          this.logger.warn('Unknown notification method', { method: notification.method });
      }
    } catch (error) {
      this.logger.error('Error handling MCP notification', error as Error, {
        method: notification.method,
      });
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MCP Protocol Handler');
    this.initialized = false;
    this.clientInfo = null;
    this.capabilities = {};
    this.logger.info('MCP Protocol Handler shutdown complete');
  }

  async handleInitialize(request: MCPInitializeRequest): Promise<MCPInitializeResponse> {
    this.logger.info('Handling initialize request', { clientInfo: request.params.clientInfo });

    if (this.initialized && this.clientInfo) {
      throw this.createError(
        -32000,
        'Server already initialized',
        ErrorType.VALIDATION_ERROR
      );
    }

    // Validate protocol version
    const supportedVersion = '2024-11-05';
    if (request.params.protocolVersion !== supportedVersion) {
      throw this.createError(
        -32000,
        `Unsupported protocol version: ${request.params.protocolVersion}. Supported: ${supportedVersion}`,
        ErrorType.VALIDATION_ERROR
      );
    }

    this.clientInfo = request.params.clientInfo;

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: supportedVersion,
        capabilities: this.capabilities,
        serverInfo: {
          name: 'newrelic-mcp-server',
          version: '1.0.0',
        },
      },
    };
  }

  async handleToolsList(request: MCPToolsListRequest): Promise<MCPToolsListResponse> {
    this.logger.debug('Handling tools list request');

    if (!this.initialized) {
      throw this.createError(
        -32000,
        'Server not initialized',
        ErrorType.VALIDATION_ERROR
      );
    }

    // This will be populated by the tool registry in later tasks
    const tools = [
      {
        name: 'nrql_query',
        description: 'Execute NRQL queries against NewRelic data',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string' as const,
              description: 'The NRQL query to execute',
            },
            accountId: {
              type: 'string' as const,
              description: 'NewRelic account ID (optional)',
            },
            timeout: {
              type: 'number' as const,
              description: 'Query timeout in milliseconds',
            },
            limit: {
              type: 'number' as const,
              description: 'Maximum number of results',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'create_alert_policy',
        description: 'Create a new alert policy',
        inputSchema: {
          type: 'object' as const,
          properties: {
            name: {
              type: 'string' as const,
              description: 'Policy name',
            },
            incident_preference: {
              type: 'string' as const,
              enum: ['PER_POLICY', 'PER_CONDITION', 'PER_CONDITION_AND_TARGET'] as const,
              description: 'How incidents are created',
            },
          },
          required: ['name', 'incident_preference'],
        },
      },
      {
        name: 'analyze_incident',
        description: 'Analyze an incident for root cause and recommendations',
        inputSchema: {
          type: 'object' as const,
          properties: {
            incidentId: {
              type: 'string' as const,
              description: 'The incident ID to analyze',
            },
          },
          required: ['incidentId'],
        },
      },
      {
        name: 'log_query',
        description: 'Query NewRelic log data with common patterns for recent time periods',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query_type: {
              type: 'string' as const,
              enum: ['recent_logs', 'error_logs', 'application_logs', 'infrastructure_logs', 'custom_query'] as const,
              description: 'Type of log query to execute',
            },
            time_period: {
              type: 'string' as const,
              enum: ['1 hour ago', '6 hours ago', '1 day ago', '3 days ago', '7 days ago'] as const,
              description: 'Time period for log retrieval',
            },
            limit: {
              type: 'number' as const,
              description: 'Maximum number of log entries to return (1-1000)',
            },
            log_level: {
              type: 'string' as const,
              enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'] as const,
              description: 'Filter logs by level (for error_logs type)',
            },
            hostname: {
              type: 'string' as const,
              description: 'Filter logs by hostname',
            },
            application_name: {
              type: 'string' as const,
              description: 'Filter logs by application name',
            },
            custom_nrql: {
              type: 'string' as const,
              description: 'Custom NRQL query for log data (used with custom_query type)',
            },
            include_fields: {
              type: 'array' as const,
              items: { type: 'string' as const },
              description: 'Specific fields to include in results',
            },
          },
          required: ['query_type'],
        },
      },
    ];

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools,
      },
    };
  }

  async handleToolCall(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    this.logger.debug('Handling tool call request', {
      toolName: request.params.name,
      arguments: request.params.arguments,
    });

    if (!this.initialized) {
      throw this.createError(
        -32000,
        'Server not initialized',
        ErrorType.VALIDATION_ERROR
      );
    }

    // Tool execution will be implemented in later tasks
    // For now, return a placeholder response
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        content: [
          {
            type: 'text',
            text: `Tool ${request.params.name} execution not yet implemented. Arguments: ${JSON.stringify(request.params.arguments)}`,
          },
        ],
        isError: false,
      },
    };
  }

  async handleResourcesList(request: MCPResourcesListRequest): Promise<MCPResourcesListResponse> {
    this.logger.debug('Handling resources list request');

    if (!this.initialized) {
      throw this.createError(
        -32000,
        'Server not initialized',
        ErrorType.VALIDATION_ERROR
      );
    }

    // Resources will be populated by the resource registry in later tasks
    const resources = [
      {
        uri: 'newrelic://applications',
        name: 'Applications',
        description: 'List of monitored applications',
        mimeType: 'application/json',
      },
      {
        uri: 'newrelic://alerts/policies',
        name: 'Alert Policies',
        description: 'List of alert policies',
        mimeType: 'application/json',
      },
      {
        uri: 'newrelic://incidents',
        name: 'Incidents',
        description: 'List of incidents',
        mimeType: 'application/json',
      },
    ];

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        resources,
      },
    };
  }

  async handleResourceRead(request: MCPResourceReadRequest): Promise<MCPResourceReadResponse> {
    this.logger.debug('Handling resource read request', { uri: request.params.uri });

    if (!this.initialized) {
      throw this.createError(
        -32000,
        'Server not initialized',
        ErrorType.VALIDATION_ERROR
      );
    }

    // Resource reading will be implemented in later tasks
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              message: `Resource ${request.params.uri} reading not yet implemented`,
              timestamp: new Date().toISOString(),
            }),
          },
        ],
      },
    };
  }

  private validateRequest(request: MCPRequest): void {
    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      throw this.createError(
        -32600,
        'Invalid JSON-RPC version',
        ErrorType.VALIDATION_ERROR
      );
    }

    if (request.id === undefined || request.id === null) {
      throw this.createError(
        -32600,
        'Missing request ID',
        ErrorType.VALIDATION_ERROR
      );
    }

    if (!request.method || typeof request.method !== 'string') {
      throw this.createError(
        -32600,
        'Invalid or missing method',
        ErrorType.VALIDATION_ERROR
      );
    }
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

  // Serialization methods
  public serializeRequest(request: MCPRequest): string {
    try {
      return JSON.stringify(request);
    } catch (error) {
      this.logger.error('Error serializing MCP request', error as Error);
      throw this.createError(
        -32700,
        'Parse error: Failed to serialize request',
        ErrorType.VALIDATION_ERROR
      );
    }
  }

  public deserializeRequest(data: string): MCPRequest {
    try {
      const request = JSON.parse(data) as MCPRequest;
      this.validateRequest(request);
      return request;
    } catch (error) {
      this.logger.error('Error deserializing MCP request', error as Error);
      throw this.createError(
        -32700,
        'Parse error: Invalid JSON or malformed request',
        ErrorType.VALIDATION_ERROR
      );
    }
  }

  public serializeResponse(response: MCPResponse): string {
    try {
      return JSON.stringify(response);
    } catch (error) {
      this.logger.error('Error serializing MCP response', error as Error);
      throw this.createError(
        -32700,
        'Parse error: Failed to serialize response',
        ErrorType.VALIDATION_ERROR
      );
    }
  }

  public deserializeResponse(data: string): MCPResponse {
    try {
      return JSON.parse(data) as MCPResponse;
    } catch (error) {
      this.logger.error('Error deserializing MCP response', error as Error);
      throw this.createError(
        -32700,
        'Parse error: Invalid JSON or malformed response',
        ErrorType.VALIDATION_ERROR
      );
    }
  }

  public serializeNotification(notification: MCPNotification): string {
    try {
      return JSON.stringify(notification);
    } catch (error) {
      this.logger.error('Error serializing MCP notification', error as Error);
      throw this.createError(
        -32700,
        'Parse error: Failed to serialize notification',
        ErrorType.VALIDATION_ERROR
      );
    }
  }

  public deserializeNotification(data: string): MCPNotification {
    try {
      return JSON.parse(data) as MCPNotification;
    } catch (error) {
      this.logger.error('Error deserializing MCP notification', error as Error);
      throw this.createError(
        -32700,
        'Parse error: Invalid JSON or malformed notification',
        ErrorType.VALIDATION_ERROR
      );
    }
  }
}