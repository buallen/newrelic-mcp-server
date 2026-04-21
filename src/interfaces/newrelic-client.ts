/**
 * NewRelic Client Interface
 * Defines the contract for interacting with NewRelic APIs
 */

import {
  Application,
  AlertPolicy,
  AlertCondition,
  NotificationChannel,
  Incident,
  IncidentDetails,
  NRQLQuery,
  NRQLResult,
  GraphQLResult,
  ValidationResult,
  EntityType,
  IncidentFilters,
  PolicyFilters,
  AlertPolicyInput,
  AlertConditionInput,
  NotificationChannelInput,
} from '../types/newrelic';

export interface NewRelicClient {
  // Authentication
  authenticate(apiKey: string): Promise<boolean>;
  validatePermissions(): Promise<string[]>;
  getAccountAccess(apiKey: string): Promise<string[]>;

  // GraphQL/NerdGraph queries
  executeNRQL(query: NRQLQuery): Promise<NRQLResult>;
  executeGraphQL(query: string, variables?: Record<string, unknown>): Promise<GraphQLResult>;

  // REST API operations - Applications
  getApplications(): Promise<Application[]>;
  getApplication(applicationId: string): Promise<Application>;

  // REST API operations - Alert Policies
  getAlertPolicies(filters?: PolicyFilters): Promise<AlertPolicy[]>;
  getAlertPolicy(policyId: string): Promise<AlertPolicy>;
  createAlertPolicy(policy: AlertPolicyInput): Promise<AlertPolicy>;
  updateAlertPolicy(policyId: string, updates: Partial<AlertPolicyInput>): Promise<AlertPolicy>;
  deleteAlertPolicy(policyId: string): Promise<boolean>;

  // REST API operations - Alert Conditions
  getAlertConditions(policyId: string): Promise<AlertCondition[]>;
  getAlertCondition(conditionId: string): Promise<AlertCondition>;
  createAlertCondition(policyId: string, condition: AlertConditionInput): Promise<AlertCondition>;
  updateAlertCondition(
    conditionId: string,
    condition: Partial<AlertConditionInput>
  ): Promise<AlertCondition>;
  deleteAlertCondition(conditionId: string): Promise<boolean>;

  // REST API operations - Notification Channels
  getNotificationChannels(): Promise<NotificationChannel[]>;
  getNotificationChannel(channelId: string): Promise<NotificationChannel>;
  createNotificationChannel(channel: NotificationChannelInput): Promise<NotificationChannel>;
  updateNotificationChannel(
    channelId: string,
    updates: Partial<NotificationChannelInput>
  ): Promise<NotificationChannel>;
  deleteNotificationChannel(channelId: string): Promise<boolean>;

  // Incident management
  getIncidents(filters?: IncidentFilters): Promise<Incident[]>;
  getIncident(incidentId: string): Promise<IncidentDetails>;
  acknowledgeIncident(incidentId: string): Promise<boolean>;
  closeIncident(incidentId: string): Promise<boolean>;

  // Query utilities
  validateQuery(query: string): Promise<ValidationResult>;
  getQuerySuggestions(partialQuery: string): Promise<string[]>;
  getMetricNames(entityType?: string): Promise<string[]>;
  getEntityTypes(): Promise<EntityType[]>;

  // Health and status
  checkConnection(): Promise<boolean>;
  getApiStatus(): Promise<ApiStatus>;
}

export interface ApiStatus {
  connected: boolean;
  lastSuccessfulCall: string;
  rateLimitRemaining: number;
  rateLimitReset: string;
  responseTime: number;
}

export interface NewRelicClientConfig {
  apiKey: string;
  baseUrl: string;
  graphqlUrl: string;
  defaultAccountId?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimitPerMinute: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  keyPrefix: string;
}
