/**
 * Service Interfaces
 * Defines contracts for various service components
 */

import {
  NRQLQuery,
  NRQLResult,
  ValidationResult,
  EntityType,
  AlertPolicy,
  AlertCondition,
  NotificationChannel,
  AlertPolicyInput,
  AlertConditionInput,
  NotificationChannelInput,
  PolicyFilters,
  Application,
  Incident,
  IncidentAnalysis,
  RootCauseAnalysis,
  Recommendation,
  IncidentReport,
  Anomaly,
  SimilarIncident,
  ErrorPattern,
  ErrorEvent,
  TimeRange,
} from '../types/newrelic';

// Query Service Interface
export interface QueryService {
  executeQuery(query: NRQLQuery): Promise<NRQLResult>;
  validateQuery(query: string): Promise<ValidationResult>;
  getQuerySuggestions(partialQuery: string): Promise<string[]>;
  getMetricNames(entityType?: string): Promise<string[]>;
  getEntityTypes(): Promise<EntityType[]>;
  buildQuery(params: QueryBuilderParams): string;
}

export interface QueryBuilderParams {
  select: string[];
  from: string;
  where?: Record<string, unknown>;
  since?: string;
  until?: string;
  limit?: number;
  orderBy?: string;
  groupBy?: string[];
}

// Alert Manager Interface
export interface AlertManager {
  // Policy management
  createPolicy(policy: AlertPolicyInput): Promise<AlertPolicy>;
  updatePolicy(policyId: string, updates: Partial<AlertPolicyInput>): Promise<AlertPolicy>;
  deletePolicy(policyId: string): Promise<boolean>;
  getPolicies(filters?: PolicyFilters): Promise<AlertPolicy[]>;
  getPolicy(policyId: string): Promise<AlertPolicy>;

  // Condition management
  createCondition(policyId: string, condition: AlertConditionInput): Promise<AlertCondition>;
  updateCondition(
    conditionId: string,
    updates: Partial<AlertConditionInput>
  ): Promise<AlertCondition>;
  deleteCondition(conditionId: string): Promise<boolean>;
  getConditions(policyId: string): Promise<AlertCondition[]>;
  getCondition(conditionId: string): Promise<AlertCondition>;

  // Notification channels
  getNotificationChannels(): Promise<NotificationChannel[]>;
  createNotificationChannel(channel: NotificationChannelInput): Promise<NotificationChannel>;
  updateNotificationChannel(
    channelId: string,
    updates: Partial<NotificationChannelInput>
  ): Promise<NotificationChannel>;
  deleteNotificationChannel(channelId: string): Promise<boolean>;

  // Policy-channel associations
  associateChannelWithPolicy(policyId: string, channelId: string): Promise<boolean>;
  disassociateChannelFromPolicy(policyId: string, channelId: string): Promise<boolean>;
}

// APM Service Interface
export interface APMService {
  getApplications(): Promise<Application[]>;
  getApplication(applicationId: string): Promise<Application>;
  getApplicationMetrics(
    applicationId: string,
    timeRange: TimeRange,
    metrics: string[]
  ): Promise<Record<string, unknown>>;
  getTransactionTraces(applicationId: string, timeRange: TimeRange): Promise<TransactionTrace[]>;
  getDatabaseQueries(applicationId: string, timeRange: TimeRange): Promise<DatabaseQuery[]>;
  getErrorAnalytics(applicationId: string, timeRange: TimeRange): Promise<ErrorAnalytics>;
}

export interface TransactionTrace {
  id: string;
  name: string;
  duration: number;
  timestamp: string;
  url: string;
  segments: TraceSegment[];
}

export interface TraceSegment {
  name: string;
  duration: number;
  exclusive_duration: number;
  call_count: number;
  class_name?: string;
  method_name?: string;
}

export interface DatabaseQuery {
  query: string;
  duration: number;
  call_count: number;
  total_time: number;
  operation: string;
  table?: string;
}

export interface ErrorAnalytics {
  error_rate: number;
  error_count: number;
  top_errors: TopError[];
  error_trends: ErrorTrend[];
}

export interface TopError {
  message: string;
  count: number;
  percentage: number;
  first_seen: string;
  last_seen: string;
}

export interface ErrorTrend {
  timestamp: string;
  error_count: number;
  error_rate: number;
}

// Incident Analyzer Interface
export interface IncidentAnalyzer {
  analyzeIncident(incidentId: string): Promise<IncidentAnalysis>;
  performRootCauseAnalysis(incident: Incident): Promise<RootCauseAnalysis>;
  generateRecommendations(analysis: IncidentAnalysis): Promise<Recommendation[]>;
  createIncidentReport(incidentId: string): Promise<IncidentReport>;

  // Pattern detection
  detectAnomalies(entityId: string, timeRange: TimeRange): Promise<Anomaly[]>;
  findSimilarIncidents(incident: Incident): Promise<SimilarIncident[]>;
  analyzeErrorPatterns(errors: ErrorEvent[]): Promise<ErrorPattern[]>;

  // Correlation analysis
  findCorrelatedEvents(incident: Incident): Promise<ServiceCorrelatedEvent[]>;
  analyzeMetricCorrelations(
    entityId: string,
    timeRange: TimeRange
  ): Promise<MetricCorrelation[]>;
}

export interface ServiceCorrelatedEvent {
  timestamp: string;
  type: string;
  description: string;
  correlation_score: number;
  source: string;
}

export interface MetricCorrelation {
  metric1: string;
  metric2: string;
  correlation: number;
  significance: number;
  timeRange: TimeRange;
}

// Authentication Service Interface
export interface AuthService {
  validateApiKey(apiKey: string): Promise<boolean>;
  getAccountAccess(apiKey: string): Promise<string[]>;
  checkPermissions(apiKey: string, operation: string): Promise<boolean>;
  rotateApiKey(currentKey: string): Promise<string>;
  getKeyMetadata(apiKey: string): Promise<ApiKeyMetadata>;
}

export interface ApiKeyMetadata {
  keyId: string;
  name: string;
  accountIds: string[];
  permissions: string[];
  createdAt: string;
  lastUsed: string;
  expiresAt?: string;
}

// Cache Manager Interface
export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  
  // Bulk operations
  mget<T>(keys: string[]): Promise<Array<T | null>>;
  mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  
  // Pattern operations
  keys(pattern: string): Promise<string[]>;
  deletePattern(pattern: string): Promise<number>;
}

// Configuration Manager Interface
export interface ConfigManager {
  get<T>(key: string): T;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  reload(): Promise<void>;
  validate(): Promise<ValidationResult>;
  getEnvironment(): string;
}

// Logger Interface
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;

  // Structured logging for analysis
  logAPICall(
    method: string,
    params: unknown,
    duration: number,
    success: boolean,
    meta?: Record<string, unknown>
  ): void;
  logIncidentAnalysis(incidentId: string, analysisResult: unknown): void;
  logQueryExecution(query: string, resultCount: number, duration: number): void;
}

// Metrics Collector Interface
export interface MetricsCollector {
  // Request metrics
  recordRequestDuration(method: string, duration: number): void;
  recordRequestCount(method: string, status: string): void;
  recordErrorCount(errorType: string): void;

  // Performance metrics
  recordCacheHitRate(operation: string, hitRate: number): void;
  recordQueryExecutionTime(query: string, duration: number): void;
  recordAPILatency(endpoint: string, latency: number): void;

  // Business metrics
  recordIncidentAnalysisCount(): void;
  recordAlertPolicyChanges(): void;

  // System metrics
  recordMemoryUsage(usage: number): void;
  recordCPUUsage(usage: number): void;
  recordActiveConnections(count: number): void;
}

// Error Handler Interface
export interface ErrorHandler {
  handleError(error: Error, context?: Record<string, unknown>): Promise<void>;
  createMCPError(error: Error, code?: number): MCPError;
  isRetryableError(error: Error): boolean;
  getRetryDelay(attempt: number, error: Error): number;
}

import { MCPError } from '../types/mcp';