/**
 * Default Configuration
 * Provides default values for server configuration
 */

import { ServerConfig } from './types';

export const defaultConfig: ServerConfig = {
  server: {
    port: 3000,
    host: 'localhost',
    timeout: 30000,
    maxConcurrentRequests: 10,
    enableCors: true,
    requestSizeLimit: '10mb',
    environment: 'development',
  },
  newrelic: {
    apiKey: '', // Must be provided via environment variable
    baseUrl: 'https://api.newrelic.com',
    graphqlUrl: 'https://api.newrelic.com/graphql',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    rateLimitPerMinute: 60,
  },
  cache: {
    type: 'memory',
    ttl: 300, // 5 minutes
    maxSize: 1000,
    keyPrefix: 'newrelic-mcp:',
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
      connectTimeout: 10000,
      lazyConnect: true,
    },
  },
  logging: {
    level: 'info',
    format: 'json',
    destination: 'console',
    enableMetrics: true,
  },
  security: {
    enableHttps: false,
    enableRateLimit: true,
    rateLimitWindow: 60000, // 1 minute
    rateLimitMax: 100,
    enableApiKeyValidation: true,
    trustedProxies: [],
  },
  performance: {
    enableMetrics: true,
    metricsPort: 9090,
    healthCheckInterval: 30000,
    gcInterval: 300000, // 5 minutes
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    connectionPoolSize: 10,
  },
};
