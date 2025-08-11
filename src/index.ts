/**
 * NewRelic MCP Server Entry Point
 * Main entry point for the NewRelic Model Context Protocol server
 */

import { config } from 'dotenv';

// Load environment variables
config();

export * from './types/mcp';
export * from './types/newrelic';
export * from './interfaces/mcp-protocol';
export * from './interfaces/newrelic-client';
export * from './interfaces/services';
export * from './config/types';
export * from './config/default';
export * from './server';

// Re-export main server class
export { NewRelicMCPServer as default } from './server';