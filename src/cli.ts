#!/usr/bin/env node

/**
 * NewRelic MCP Server CLI
 * Command line interface for running the server
 */

import { NewRelicMCPServer } from './server';
import { ServerConfig } from './config/types';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
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

  if (process.env.LOG_LEVEL) {
    config.logging = {
      ...config.logging,
      level: process.env.LOG_LEVEL as any,
    };
  }

  // Create and initialize server
  const server = new NewRelicMCPServer(config);

  try {
    await server.initialize();
    console.log('NewRelic MCP Server is ready to handle requests');

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('\nShutting down server...');
      await server.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down server...');
      await server.shutdown();
      process.exit(0);
    });

    // Keep the process running
    process.stdin.resume();

    // Handle stdin for MCP requests (for testing)
    if (args.includes('--stdin')) {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', async data => {
        try {
          const response = await server.handleRequest(data.toString().trim());
          console.log(response);
        } catch (error) {
          console.error('Error:', (error as Error).message);
        }
      });
    }
  } catch (error) {
    console.error('Failed to start server:', (error as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
