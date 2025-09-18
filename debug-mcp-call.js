#!/usr/bin/env node

// Test the MCP tool directly
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

// Import the simple server
require('dotenv').config();
const simpleServer = require('./simple-server.js');

async function debugMCPCall() {
  try {
    console.log('Testing MCP NRQL call...');
    
    // Create a mock request like the MCP tool would send
    const mockRequest = {
      method: 'tools/call',
      params: {
        name: 'nrql_query',
        arguments: {
          query: 'SELECT count(*) FROM Log LIMIT 1 SINCE 1 day ago'
        }
      }
    };
    
    console.log('Mock request:', JSON.stringify(mockRequest, null, 2));
    
    // This would normally be handled by the MCP server, but let's test the underlying logic
    const SimpleNewRelicClient = require('./simple-server.js').SimpleNewRelicClient;
    
  } catch (error) {
    console.error('Debug test failed:', error.message);
  }
}

debugMCPCall();