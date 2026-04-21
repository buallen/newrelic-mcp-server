#!/usr/bin/env node

/**
 * Working MCP server with proper NewRelic integration
 */

const { NewRelicMCPServer } = require('./dist/server');

// Silence all console output to avoid corrupting MCP JSON protocol
console.log = () => {};
console.warn = () => {};
console.error = () => {};

class WorkingMCPServerStdio {
  constructor() {
    // Configure for MCP protocol with proper version negotiation
    const config = {};

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
      // Use the MCP-only initialization method
      await this.server.initializeMCPOnly();
      
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
              // Intercept initialize requests to handle version negotiation
              const request = JSON.parse(line.trim());
              let response;
              
              if (request.method === 'initialize') {
                // Handle protocol version negotiation flexibly
                const supportedVersions = ['2024-11-05', '2025-06-18', '2025-11-25'];
                const clientVersion = request.params.protocolVersion;
                
                if (supportedVersions.includes(clientVersion)) {
                  // Override the server response with flexible version
                  response = JSON.stringify({
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                      protocolVersion: clientVersion, // Accept client version
                      capabilities: {
                        tools: { listChanged: true },
                        resources: { subscribe: false, listChanged: true },
                        logging: { level: 'info' }
                      },
                      serverInfo: {
                        name: 'newrelic-mcp-server',
                        version: '1.0.0'
                      }
                    }
                  });
                } else {
                  response = JSON.stringify({
                    jsonrpc: '2.0',
                    id: request.id,
                    error: {
                      code: -32000,
                      message: `Unsupported protocol version: ${clientVersion}. Supported: ${supportedVersions.join(', ')}`
                    }
                  });
                }
              } else {
                // Use the server's normal request handling for all other requests
                response = await this.server.handleRequest(line.trim());
              }
              
              // Output JSON response to stdout
              process.stdout.write(response + '\n');
            } catch (error) {
              // Send error response in MCP format
              const errorResponse = {
                jsonrpc: '2.0',
                id: null,
                error: {
                  code: -32000,
                  message: error.message,
                },
              };
              process.stdout.write(JSON.stringify(errorResponse) + '\n');
            }
          }
        }
      });

      // Handle process termination gracefully
      process.on('SIGINT', () => {
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        process.exit(0);
      });

      // Keep the process running
      process.stdin.resume();

    } catch (error) {
      process.exit(1);
    }
  }
}

// Start the MCP server
const mcpServer = new WorkingMCPServerStdio();
mcpServer.start().catch((error) => {
  process.exit(1);
});