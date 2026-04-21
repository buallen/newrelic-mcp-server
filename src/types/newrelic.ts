// Core NewRelic entity types
export interface Application {
  id: string;
  name: string;
  language: string;
  health_status: 'green' | 'yellow' | 'red' | 'gray';
  reporting: boolean;
  last_reported_at: string;
  application_summary: ApplicationSummary;
}

export interface ApplicationSummary {
  response_time: number;
  throughput: number;
  error_rate: number;
  apdex_target: number;
  apdex_score: number;
}

// Alert-related types
export interface AlertPolicy {
  id: string;
  name: string;
  incident_preference: 'PER_POLICY' | 'PER_CONDITION' | 'PER_CONDITION_AND_TARGET';
  created_at: string;
  updated_at: string;
}

export interface AlertPolicyInput {
  name: string;
  incident_preference?: 'PER_POLICY' | 'PER_CONDITION' | 'PER_CONDITION_AND_TARGET';
}

export interface AlertCondition {
  id: string;
  type: 'apm_app_metric' | 'apm_kt_metric' | 'servers_metric' | 'browser_metric';
  name: string;
  enabled: boolean;
  entities: string[];
  metric: string;
  condition_scope: 'application' | 'instance';
  terms: AlertTerm[];
  user_defined?: UserDefinedMetric;
}

export interface AlertConditionInput {
  type: 'apm_app_metric' | 'apm_kt_metric' | 'servers_metric' | 'browser_metric';
  name: string;
  enabled?: boolean;
  entities: string[];
  metric: string;
  condition_scope?: 'application' | 'instance';
  terms: AlertTerm[];
  user_defined?: UserDefinedMetric;
}

export interface AlertTerm {
  duration: number; // in minutes
  operator: 'above' | 'below' | 'equal';
  priority: 'critical' | 'warning';
  threshold: number;
  time_function: 'all' | 'any';
}

export interface UserDefinedMetric {
  metric: string;
  value_function: 'average' | 'min' | 'max' | 'total' | 'sample_size';
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'campfire';
  configuration: NotificationChannelConfiguration;
  created_at: string;
  updated_at: string;
}

export interface NotificationChannelInput {
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'campfire';
  configuration: NotificationChannelConfiguration;
}

export interface NotificationChannelConfiguration {
  recipients?: string; // for email
  url?: string; // for slack/webhook
  base_url?: string; // for webhook
  auth_username?: string; // for webhook
  auth_password?: string; // for webhook
  payload_type?: 'application/json' | 'application/x-www-form-urlencoded'; // for webhook
  payload?: Record<string, any>; // for webhook
  headers?: Record<string, string>; // for webhook
  service_key?: string; // for pagerduty
  subdomain?: string; // for campfire
  token?: string; // for campfire
  room?: string; // for campfire
}

export interface PolicyFilters {
  name?: string;
  enabled?: boolean;
}

// Incident-related types
export interface Incident {
  id: string;
  opened_at: string;
  closed_at?: string;
  description: string;
  state: 'open' | 'acknowledged' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'critical';
  policy_name: string;
  condition_name: string;
  violation_url: string;
  policy_id: string;
  condition_id: string;
  entity_id?: string;
  entity_name?: string;
  entity_type?: string;
}

export interface IncidentDetails extends Incident {
  violations: Violation[];
  links: IncidentLinks;
  acknowledgement?: IncidentAcknowledgement;
}

export interface Violation {
  id: string;
  label: string;
  duration: number;
  opened_at: string;
  closed_at?: string;
  metric_name: string;
  metric_value: number;
  threshold_value: number;
  threshold_duration: number;
  threshold_occurrence: string;
}

export interface IncidentLinks {
  policy: string;
  condition: string;
  entity?: string;
}

export interface IncidentAcknowledgement {
  acknowledged_at: string;
  acknowledged_by: string;
}

export interface IncidentFilters {
  only_open?: boolean;
  exclude_violations?: boolean;
  since?: string;
  until?: string;
  policy_id?: string;
  condition_id?: string;
  entity_id?: string;
  state?: 'open' | 'acknowledged' | 'closed';
}

// Query-related types
export interface NRQLResult {
  results: QueryResultRow[];
  metadata: QueryMetadata;
  performanceStats?: QueryPerformanceStats;
}

export interface QueryResultRow {
  [key: string]: any;
}

export interface QueryMetadata {
  eventType?: string;
  eventTypes?: string[];
  contents?: QueryContent[];
  messages?: QueryMessage[];
  facet?: string[];
  timeWindow?: TimeWindow;
}

export interface QueryContent {
  function: string;
  attribute: string;
  simple: boolean;
}

export interface QueryMessage {
  level: 'INFO' | 'WARNING' | 'ERROR';
  text: string;
}

export interface TimeWindow {
  since: string;
  until: string;
  compareWith?: string;
}

export interface QueryPerformanceStats {
  inspectedCount: number;
  omittedCount: number;
  matchCount: number;
  wallClockTime: number;
  userTime: number;
  systemTime: number;
}

export interface NRQLQuery {
  query: string;
  accountId?: string;
  timeout?: number;
  limit?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  suggestions?: string[];
}

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

// GraphQL-related types
export interface GraphQLResult {
  data?: any;
  errors?: GraphQLError[];
  extensions?: any;
}

export interface GraphQLError {
  message: string;
  locations?: GraphQLErrorLocation[];
  path?: (string | number)[];
  extensions?: any;
}

export interface GraphQLErrorLocation {
  line: number;
  column: number;
}

// Entity-related types
export interface EntityType {
  name: string;
  domain: string;
  type: string;
}

export interface Entity {
  guid: string;
  name: string;
  type: string;
  domain: string;
  entityType: string;
  permalink: string;
  reporting: boolean;
  tags: EntityTag[];
}

export interface EntityTag {
  key: string;
  values: string[];
}

// Analysis-related types
export interface IncidentAnalysis {
  incident: Incident;
  timeline: TimelineEvent[];
  affectedEntities: AffectedEntity[];
  metrics: IncidentMetrics;
  correlatedEvents: CorrelatedEvent[];
  possibleCauses: PossibleCause[];
  recommendations: Recommendation[];
  confidence: number;
  analysisMethod: string;
  generatedAt: string;
}

export interface TimelineEvent {
  timestamp: string;
  type:
    | 'incident_opened'
    | 'violation_started'
    | 'violation_ended'
    | 'incident_acknowledged'
    | 'incident_closed'
    | 'deployment'
    | 'alert_triggered';
  description: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface AffectedEntity {
  guid: string;
  name: string;
  type: string;
  impactLevel: 'high' | 'medium' | 'low';
  metrics: EntityMetrics;
}

export interface EntityMetrics {
  responseTime?: number;
  throughput?: number;
  errorRate?: number;
  apdexScore?: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface IncidentMetrics {
  duration: number; // in minutes
  severity: 'critical' | 'warning' | 'info';
  impactScore: number;
  affectedUsers?: number;
  affectedTransactions?: number;
  businessImpact?: string;
}

export interface CorrelatedEvent {
  timestamp: string;
  type: 'deployment' | 'configuration_change' | 'infrastructure_event' | 'external_service_issue';
  description: string;
  correlation: number; // 0-1 correlation score
  source: string;
  details?: Record<string, any>;
}

export interface PossibleCause {
  type:
    | 'code_deployment'
    | 'infrastructure_issue'
    | 'external_dependency'
    | 'configuration_change'
    | 'resource_exhaustion';
  description: string;
  probability: number; // 0-1 probability score
  evidence: Evidence[];
  mitigation?: string;
}

export interface Evidence {
  type: 'metric_anomaly' | 'log_pattern' | 'error_spike' | 'performance_degradation';
  description: string;
  timestamp: string;
  value?: any;
  threshold?: any;
  source: string;
}

export interface RootCauseAnalysis {
  primaryCause: Cause;
  contributingFactors: Cause[];
  evidenceChain: Evidence[];
  confidenceScore: number;
  analysisMethod: string;
  recommendations: Recommendation[];
  preventionStrategies: PreventionStrategy[];
}

export interface Cause {
  type: string;
  description: string;
  probability: number;
  impact: 'high' | 'medium' | 'low';
  evidence: Evidence[];
  timeline: string[];
}

export interface Recommendation {
  type: 'immediate' | 'short_term' | 'long_term';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: ActionItem[];
  estimatedImpact: string;
  estimatedEffort: string;
  category: 'monitoring' | 'infrastructure' | 'code' | 'process';
}

export interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

export interface PreventionStrategy {
  type: 'monitoring' | 'alerting' | 'testing' | 'infrastructure' | 'process';
  description: string;
  implementation: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

export interface IncidentReport {
  incident: Incident;
  analysis: IncidentAnalysis;
  rootCause?: RootCauseAnalysis;
  timeline: TimelineEvent[];
  impactAssessment: ImpactAssessment;
  resolutionSummary: ResolutionSummary;
  lessonsLearned: string[];
  actionItems: ActionItem[];
  generatedAt: string;
  generatedBy: string;
}

export interface ImpactAssessment {
  duration: number;
  affectedUsers: number;
  affectedServices: string[];
  businessImpact: string;
  financialImpact?: number;
  reputationalImpact?: string;
}

export interface ResolutionSummary {
  resolvedAt: string;
  resolvedBy: string;
  resolutionMethod: string;
  stepsToResolve: string[];
  timeToResolve: number; // in minutes
}

// Anomaly detection types
export interface Anomaly {
  timestamp: string;
  entityGuid: string;
  entityName: string;
  metricName: string;
  actualValue: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'spike' | 'drop' | 'trend_change' | 'pattern_break';
  confidence: number;
  context?: AnomalyContext;
}

export interface AnomalyContext {
  historicalAverage: number;
  seasonalPattern?: string;
  correlatedMetrics?: string[];
  externalFactors?: string[];
}

export interface SimilarIncident {
  incident: Incident;
  similarity: number;
  commonFactors: string[];
  resolution?: string;
  timeToResolve?: number;
}

export interface ErrorPattern {
  pattern: string;
  frequency: number;
  firstSeen: string;
  lastSeen: string;
  affectedEntities: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'application' | 'infrastructure' | 'network' | 'database';
  examples: ErrorEvent[];
}

export interface ErrorEvent {
  timestamp: string;
  message: string;
  stackTrace?: string;
  entityGuid: string;
  entityName: string;
  attributes?: Record<string, any>;
}

// Time range types
export interface TimeRange {
  since: string;
  until?: string;
}

export interface RelativeTimeRange {
  duration: number; // in minutes
  endTime?: string; // defaults to now
}

// Rate limiting types
export interface RateLimitStatus {
  remaining: number;
  limit: number;
  resetTime: string;
  retryAfter?: number;
}

// Configuration types
export interface NewRelicConfig {
  apiKey: string;
  baseUrl?: string;
  graphqlUrl?: string;
  defaultAccountId?: string;
  timeout?: number;
  retryAttempts?: number;
  rateLimitPerMinute?: number;
}

// Error types
export enum NewRelicErrorType {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  QUERY_SYNTAX_ERROR = 'QUERY_SYNTAX_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

export interface NewRelicError extends Error {
  type: NewRelicErrorType;
  status?: number;
  retryable: boolean;
  retryAfter?: number;
  details?: any;
}
