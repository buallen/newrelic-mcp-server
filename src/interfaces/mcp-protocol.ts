/**
 * MCP Protocol Handler Interface
 * Defines the contract for handling MCP protocol messages
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
} from '../types/mcp';

export interface MCPProtocolHandler {
  /**
   * Initialize the MCP server
   */
  initialize(): Promise<void>;

  /**
   * Handle incoming MCP requests
   */
  handleRequest(request: MCPRequest): Promise<MCPResponse>;

  /**
   * Handle incoming MCP notifications
   */
  handleNotification(notification: MCPNotification): Promise<void>;

  /**
   * Shutdown the MCP server
   */
  shutdown(): Promise<void>;

  /**
   * Handle initialize request
   */
  handleInitialize(request: MCPInitializeRequest): Promise<MCPInitializeResponse>;

  /**
   * Handle tools list request
   */
  handleToolsList(request: MCPToolsListRequest): Promise<MCPToolsListResponse>;

  /**
   * Handle tool call request
   */
  handleToolCall(request: MCPToolCallRequest): Promise<MCPToolCallResponse>;

  /**
   * Handle resources list request
   */
  handleResourcesList(request: MCPResourcesListRequest): Promise<MCPResourcesListResponse>;

  /**
   * Handle resource read request
   */
  handleResourceRead(request: MCPResourceReadRequest): Promise<MCPResourceReadResponse>;
}

export interface RequestRouter {
  /**
   * Route incoming requests to appropriate handlers
   */
  route(request: MCPRequest): Promise<MCPResponse>;

  /**
   * Register a handler for a specific method
   */
  registerHandler(method: string, handler: RequestHandler): void;

  /**
   * Register middleware for request processing
   */
  registerMiddleware(middleware: Middleware): void;
}

export interface RequestHandler {
  (request: MCPRequest): Promise<MCPResponse>;
}

export interface Middleware {
  (request: MCPRequest, next: () => Promise<MCPResponse>): Promise<MCPResponse>;
}

export interface MCPServerConfig {
  port: number;
  host: string;
  timeout: number;
  maxConcurrentRequests: number;
  enableCors: boolean;
  requestSizeLimit: string;
}
