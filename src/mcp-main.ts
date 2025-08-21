#!/usr/bin/env node

/**
 * NewRelic MCP Server - Proper MCP Protocol Implementation
 * This is the correct entry point for MCP protocol communication
 */

import { NewRelicMCPServer } from './server';
import { ServerConfig } from './config/types';

// Silence all console output to avoid corrupting MCP JSON protocol
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = () => {};
console.warn = () => {};
console.error = () => {};

class MCPServerStdio {
  private server: NewRelicMCPServer;

  constructor() {
    // Configure for MCP protocol
    const config: Partial<ServerConfig> = {};

    // Parse environment variables
    if (process.env.NEWRELIC_API_KEY) {
      config.newrelic = {
        ...config.newrelic,
        apiKey: process.env.NEWRELIC_API_KEY,
      };
    }

    if (process.env.NEWRELIC_ACCOUNT_ID) {
      config.newrelic = {
        ...config.newrelic,
        defaultAccountId: process.env.NEWRELIC_ACCOUNT_ID,
      };
    }

    if (process.env.NEWRELIC_BASE_URL) {
      config.newrelic = {
        ...config.newrelic,
        baseUrl: process.env.NEWRELIC_BASE_URL,
      };
    }

    if (process.env.NEWRELIC_GRAPHQL_URL) {
      config.newrelic = {
        ...config.newrelic,
        graphqlUrl: process.env.NEWRELIC_GRAPHQL_URL,
      };
    }

    this.server = new NewRelicMCPServer(config);
  }

  async start() {
    try {
      // For MCP, we'll initialize the protocol handler only
      // NewRelic client will authenticate lazily when first used
      
      // Set up stdin/stdout for MCP protocol
      process.stdin.setEncoding('utf8');
      
      let buffer = '';
      
      process.stdin.on('data', async (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = await this.server.handleRequest(line.trim());
              // Output JSON response to stdout
              process.stdout.write(response + '\n');
            } catch (error) {
              // Send error response in MCP format
              const errorResponse = {
                jsonrpc: '2.0',
                id: null,
                error: {
                  code: -32000,
                  message: (error as Error).message,
                },
              };
              process.stdout.write(JSON.stringify(errorResponse) + '\n');
            }
          }
        }
      });

      // Handle process termination gracefully
      process.on('SIGINT', async () => {
        await this.server.shutdown();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await this.server.shutdown();
        process.exit(0);
      });

      // Keep the process running
      process.stdin.resume();

    } catch (error) {
      // Use original console.error for fatal errors
      originalConsoleError('Failed to start MCP server:', (error as Error).message);
      process.exit(1);
    }
  }
}

// Start the MCP server
const mcpServer = new MCPServerStdio();
mcpServer.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});