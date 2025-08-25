/**
 * Configuration Types
 * Defines the structure for server configuration
 */

export interface ServerConfig {
  server: ServerSettings;
  newrelic: NewRelicSettings;
  cache: CacheSettings;
  logging: LoggingSettings;
  security: SecuritySettings;
  performance: PerformanceSettings;
}

export interface ServerSettings {
  port: number;
  host: string;
  timeout: number;
  maxConcurrentRequests: number;
  enableCors: boolean;
  requestSizeLimit: string;
  environment: 'development' | 'staging' | 'production';
}

export interface NewRelicSettings {
  apiKey?: string;
  baseUrl?: string;
  graphqlUrl?: string;
  defaultAccountId?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  rateLimitPerMinute?: number;
}

export interface CacheSettings {
  type: 'memory' | 'redis';
  ttl: number;
  maxSize: number;
  keyPrefix: string;
  redis?: RedisSettings;
}

export interface RedisSettings {
  host: string;
  port: number;
  password?: string;
  db: number;
  connectTimeout: number;
  lazyConnect: boolean;
}

export interface LoggingSettings {
  level: 'debug' | 'info' | 'warn' | 'error';
  format?: 'json' | 'simple';
  destination?: 'console' | 'file';
  filename?: string;
  maxSize?: string;
  maxFiles?: number;
  enableMetrics?: boolean;
}

export interface SecuritySettings {
  enableHttps: boolean;
  certPath?: string;
  keyPath?: string;
  enableRateLimit: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
  enableApiKeyValidation: boolean;
  trustedProxies: string[];
}

export interface PerformanceSettings {
  enableMetrics: boolean;
  metricsPort: number;
  healthCheckInterval: number;
  gcInterval: number;
  maxMemoryUsage: number;
  connectionPoolSize: number;
}

export interface EnvironmentVariables {
  // Required
  NEWRELIC_API_KEY: string;
  
  // Optional with defaults
  NEWRELIC_ACCOUNT_ID?: string;
  NEWRELIC_BASE_URL?: string;
  NEWRELIC_GRAPHQL_URL?: string;
  
  MCP_SERVER_PORT?: string;
  MCP_SERVER_HOST?: string;
  MCP_SERVER_TIMEOUT?: string;
  
  CACHE_TYPE?: string;
  CACHE_TTL?: string;
  CACHE_MAX_SIZE?: string;
  
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  
  LOG_LEVEL?: string;
  LOG_FORMAT?: string;
  LOG_DESTINATION?: string;
  
  ENABLE_METRICS?: string;
  RATE_LIMIT_PER_MINUTE?: string;
  MAX_CONCURRENT_REQUESTS?: string;
  
  ENABLE_CORS?: string;
  REQUEST_SIZE_LIMIT?: string;
  
  NODE_ENV?: string;
}