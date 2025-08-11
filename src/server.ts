/**
 * NewRelic MCP Server
 * Main server implementation
 */

import { MCPProtocolHandlerImpl } from './protocol/mcp-protocol-handler';
import { RequestRouterImpl } from './protocol/request-router';
import { NewRelicClientImpl } from './client/newrelic-client';
import { QueryServiceImpl } from './services/query-service';
import { MemoryCacheManager } from './services/cache-manager';
import { ConsoleLogger } from './services/logger';
import { NRQLTool } from './tools/nrql-tool';
import { NewRelicClientConfig } from './interfaces/newrelic-client';
import { ServerConfig } from './config/types';
import { defaultConfig } from './config/default';

export class NewRelicMCPServer {
  private protocolHandler: MCPProtocolHandlerImpl;
  private router: RequestRouterImpl;
  private newRelicClient: NewRelicClientImpl;
  private queryService: QueryServiceImpl;
  private cacheManager: MemoryCacheManager;
  private logger: ConsoleLogger;
  private nrqlTool: NRQLTool;
  private config: ServerConfig;
  private initialized = false;

  constructor(config?: Partial<ServerConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.logger = new ConsoleLogger(this.config.logging.level);
    this.cacheManager = new MemoryCacheManager(this.config.cache.ttl);
    
    const newRelicConfig: NewRelicClientConfig = {
      apiKey: this.config.newrelic.apiKey,
      baseUrl: this.config.newrelic.baseUrl,
      graphqlUrl: this.config.newrelic.graphqlUrl,
      defaultAccountId: this.config.newrelic.defaultAccountId,
      timeout: this.config.newrelic.timeout,
      retryAttempts: this.config.newrelic.retryAttempts,
      retryDelay: this.config.newrelic.retryDelay,
      rateLimitPerMinute: this.config.newrelic.rateLimitPerMinute,
    };

    this.newRelicClient = new NewRelicClientImpl(newRelicConfig, this.logger);
    this.queryService = new QueryServiceImpl(this.newRelicClient, this.cacheManager, this.logger);
    this.nrqlTool = new NRQLTool(this.queryService);
    this.router = new RequestRouterImpl(this.logger);
    this.protocolHandler = new MCPProtocolHandlerImpl(this.logger);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing NewRelic MCP Server');

    try {
      // Initialize protocol handler
      await this.protocolHandler.initialize();

      // Authenticate with NewRelic
      const authenticated = await this.newRelicClient.authenticate(this.config.newrelic.apiKey);
      if (!authenticated) {
        throw new Error('Failed to authenticate with NewRelic API');
      }

      // Register request handlers
      this.registerHandlers();

      this.initialized = true;
      this.logger.info('NewRelic MCP Server initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize server', error as Error);
      throw error;
    }
  }

  private registerHandlers(): void {
    // Register MCP protocol handlers
    this.router.registerHandler('initialize', (request) => 
      this.protocolHandler.handleInitialize(request as any)
    );
    
    this.router.registerHandler('tools/list', (request) => 
      this.protocolHandler.handleToolsList(request as any)
    );
    
    this.router.registerHandler('tools/call', async (request) => {
      const toolRequest = request as any;
      
      switch (toolRequest.params.name) {
        case 'nrql_query':
          return await this.nrqlTool.execute(toolRequest);
        default:
          return this.protocolHandler.handleToolCall(toolRequest);
      }
    });
    
    this.router.registerHandler('resources/list', (request) => 
      this.protocolHandler.handleResourcesList(request as any)
    );
    
    this.router.registerHandler('resources/read', (request) => 
      this.protocolHandler.handleResourceRead(request as any)
    );
  }

  async handleRequest(requestData: string): Promise<string> {
    try {
      const request = this.protocolHandler.deserializeRequest(requestData);
      const response = await this.router.route(request);
      return this.protocolHandler.serializeResponse(response);
    } catch (error) {
      this.logger.error('Error handling request', error as Error);
      
      // Return error response
      const errorResponse = {
        jsonrpc: '2.0' as const,
        id: 0,
        error: {
          code: -32000,
          message: (error as Error).message,
          data: {
            type: 'INTERNAL_SERVER_ERROR',
            details: (error as Error).message,
            retryable: false,
          },
        },
      };
      
      return this.protocolHandler.serializeResponse(errorResponse);
    }
  }

  async handleNotification(notificationData: string): Promise<void> {
    try {
      const notification = this.protocolHandler.deserializeNotification(notificationData);
      await this.protocolHandler.handleNotification(notification);
    } catch (error) {
      this.logger.error('Error handling notification', error as Error);
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down NewRelic MCP Server');
    
    try {
      await this.protocolHandler.shutdown();
      await this.cacheManager.clear();
      this.initialized = false;
      
      this.logger.info('NewRelic MCP Server shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown', error as Error);
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const newRelicStatus = await this.newRelicClient.getApiStatus();
      
      return {
        status: newRelicStatus.connected ? 'healthy' : 'unhealthy',
        details: {
          initialized: this.initialized,
          newRelic: newRelicStatus,
          cache: {
            type: this.config.cache.type,
            ttl: this.config.cache.ttl,
          },
          server: {
            version: '1.0.0',
            uptime: process.uptime(),
          },
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: (error as Error).message,
          initialized: this.initialized,
        },
      };
    }
  }

  // Configuration methods
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ServerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Server configuration updated');
  }
}