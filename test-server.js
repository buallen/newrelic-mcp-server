#!/usr/bin/env node

/**
 * Simple test MCP server to debug connection issues
 */

console.error("Starting test MCP server...");

// Set up stdin/stdout for MCP protocol
process.stdin.setEncoding('utf8');

let buffer = '';

process.stdin.on('data', async (chunk) => {
  console.error("Received data:", chunk.toString().trim());
  buffer += chunk;
  const lines = buffer.split('\n');
  
  // Keep the last incomplete line in buffer
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const request = JSON.parse(line.trim());
        console.error("Parsed request:", request);
        
        let response;
        if (request.method === 'initialize') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: true }
              },
              serverInfo: {
                name: 'test-newrelic-mcp-server',
                version: '1.0.0'
              }
            }
          };
        } else if (request.method === 'tools/list') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: [{
                name: 'test_tool',
                description: 'A test tool',
                inputSchema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' }
                  }
                }
              }]
            }
          };
        } else {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`
            }
          };
        }
        
        console.error("Sending response:", response);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        console.error("Error processing request:", error);
        const errorResponse = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32000,
            message: error.message
          }
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    }
  }
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.error("Received SIGINT, shutting down...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error("Received SIGTERM, shutting down...");
  process.exit(0);
});

// Keep the process running
process.stdin.resume();

console.error("Test MCP server ready and waiting for input...");