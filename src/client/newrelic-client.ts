/**
 * NewRelic API Client
 * HTTP client for interacting with NewRelic APIs
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
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
import { NewRelicClient, ApiStatus, NewRelicClientConfig, RetryConfig } from '../interfaces/newrelic-client';
import { Logger } from '../interfaces/services';

export class NewRelicClientImpl implements NewRelicClient {
  private httpClient: AxiosInstance;
  private authenticated = false;
  private lastSuccessfulCall = '';
  private rateLimitRemaining = 0;
  private rateLimitReset = '';

  constructor(
    private config: NewRelicClientConfig,
    private logger: Logger
  ) {
    this.httpClient = this.createHttpClient();
  }

  private createHttpClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.config.apiKey,
      },
    });

    // Request interceptor for logging
    client.interceptors.request.use(
      (config) => {
        this.logger.debug('Making API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error', error as Error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for rate limiting and error handling
    client.interceptors.response.use(
      (response) => {
        this.updateRateLimitInfo(response);
        this.lastSuccessfulCall = new Date().toISOString();
        
        this.logger.debug('API request successful', {
          status: response.status,
          url: response.config.url,
          rateLimitRemaining: this.rateLimitRemaining,
        });
        
        return response;
      },
      async (error) => {
        this.logger.error('API request failed', error, {
          status: error.response?.status,
          url: error.config?.url,
          message: error.response?.data?.error?.title || error.message,
        });

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          this.logger.warn('Rate limit exceeded', { retryAfter });
          
          // Implement exponential backoff retry
          if (this.shouldRetry(error)) {
            return this.retryRequest(error.config);
          }
        }

        // Handle other retryable errors
        if (this.shouldRetry(error)) {
          return this.retryRequest(error.config);
        }

        return Promise.reject(error);
      }
    );

    return client;
  }

  private updateRateLimitInfo(response: AxiosResponse): void {
    const remaining = response.headers['x-ratelimit-remaining'];
    const reset = response.headers['x-ratelimit-reset'];
    
    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    
    if (reset) {
      this.rateLimitReset = new Date(parseInt(reset, 10) * 1000).toISOString();
    }
  }

  private shouldRetry(error: any): boolean {
    const retryableStatusCodes = [429, 500, 502, 503, 504];
    const status = error.response?.status;
    
    return retryableStatusCodes.includes(status) && 
           ((error.config as any).__retryCount || 0) < this.config.retryAttempts;
  }

  private async retryRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
    (config as any).__retryCount = ((config as any).__retryCount || 0) + 1;
    
    const delay = this.calculateRetryDelay((config as any).__retryCount);
    this.logger.info('Retrying request', {
      attempt: (config as any).__retryCount,
      delay,
      url: config.url,
    });
    
    await this.sleep(delay);
    return this.httpClient.request(config);
  }

  private calculateRetryDelay(attempt: number): number {
    return Math.min(this.config.retryDelay * Math.pow(2, attempt - 1), 30000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Authentication methods
  async authenticate(apiKey: string): Promise<boolean> {
    try {
      this.logger.info('Authenticating with NewRelic API');
      
      // Update API key in headers
      this.httpClient.defaults.headers['Api-Key'] = apiKey;
      this.config.apiKey = apiKey;
      
      // Test authentication by making a simple API call
      await this.httpClient.get('/v2/applications.json', {
        params: { filter: { name: 'test' } }
      });
      
      this.authenticated = true;
      this.logger.info('Authentication successful');
      return true;
    } catch (error) {
      this.authenticated = false;
      this.logger.error('Authentication failed', error as Error);
      return false;
    }
  }

  async validatePermissions(): Promise<string[]> {
    try {
      const permissions: string[] = [];
      
      // Test read permissions
      try {
        await this.httpClient.get('/v2/applications.json', { params: { page: 1 } });
        permissions.push('read');
      } catch (error) {
        this.logger.debug('No read permissions');
      }
      
      // Test write permissions (this is a safe test that doesn't create anything)
      try {
        await this.httpClient.get('/v2/alert_policies.json', { params: { page: 1 } });
        permissions.push('write');
      } catch (error) {
        this.logger.debug('No write permissions');
      }
      
      this.logger.info('Permission validation complete', { permissions });
      return permissions;
    } catch (error) {
      this.logger.error('Permission validation failed', error as Error);
      return [];
    }
  }

  async getAccountAccess(apiKey: string): Promise<string[]> {
    try {
      // For REST API, we can infer account access from application data
      const response = await this.httpClient.get('/v2/applications.json');
      const applications = response.data.applications || [];
      
      // Extract unique account IDs from applications
      const accountIds = new Set<string>();
      applications.forEach((app: any) => {
        if (app.account_id) {
          accountIds.add(app.account_id.toString());
        }
      });
      
      const accounts = Array.from(accountIds);
      this.logger.info('Account access retrieved', { accountCount: accounts.length });
      return accounts;
    } catch (error) {
      this.logger.error('Failed to get account access', error as Error);
      return [];
    }
  }

  // GraphQL/NerdGraph methods
  async executeNRQL(query: NRQLQuery): Promise<NRQLResult> {
    try {
      this.logger.debug('Executing NRQL query', { query: query.query });
      
      const graphqlQuery = `
        query($accountId: Int!, $nrql: Nrql!) {
          actor {
            account(id: $accountId) {
              nrql(query: $nrql) {
                results
                metadata {
                  eventType
                  eventTypes
                  facets
                  messages {
                    level
                    description
                  }
                }
                totalResult {
                  count
                }
              }
            }
          }
        }
      `;
      
      const variables = {
        accountId: parseInt(query.accountId || this.config.defaultAccountId || '0', 10),
        nrql: query.query,
      };
      
      const result = await this.executeGraphQL(graphqlQuery, variables);
      
      if (result.errors) {
        throw new Error(`NRQL query failed: ${result.errors[0].message}`);
      }
      
      const nrqlData = result.data?.actor?.account?.nrql;
      if (!nrqlData) {
        throw new Error('No NRQL data returned');
      }
      
      return {
        results: nrqlData.results || [],
        metadata: {
          eventType: nrqlData.metadata?.eventType || '',
          eventTypes: nrqlData.metadata?.eventTypes || [],
          contents: [], // Will be populated from facets if available
          messages: nrqlData.metadata?.messages || [],
        },
        performanceStats: {
          inspectedCount: nrqlData.totalResult?.count || 0,
          omittedCount: 0,
          matchCount: nrqlData.results?.length || 0,
          wallClockTime: 0, // Not available in this API
          userTime: 0,
          systemTime: 0,
        },
      };
    } catch (error) {
      this.logger.error('NRQL query execution failed', error as Error, { query });
      throw error;
    }
  }

  async executeGraphQL(query: string, variables?: Record<string, unknown>): Promise<GraphQLResult> {
    try {
      this.logger.debug('Executing GraphQL query');
      
      const response = await this.httpClient.post(this.config.graphqlUrl, {
        query,
        variables,
      });
      
      return response.data;
    } catch (error) {
      this.logger.error('GraphQL query execution failed', error as Error);
      throw error;
    }
  }

  // Application methods
  async getApplications(): Promise<Application[]> {
    try {
      this.logger.debug('Fetching applications');
      
      const response = await this.httpClient.get('/v2/applications.json');
      return response.data.applications || [];
    } catch (error) {
      this.logger.error('Failed to fetch applications', error as Error);
      throw error;
    }
  }

  async getApplication(applicationId: string): Promise<Application> {
    try {
      this.logger.debug('Fetching application', { applicationId });
      
      const response = await this.httpClient.get(`/v2/applications/${applicationId}.json`);
      return response.data.application;
    } catch (error) {
      this.logger.error('Failed to fetch application', error as Error, { applicationId });
      throw error;
    }
  }

  // Alert Policy methods
  async getAlertPolicies(filters?: PolicyFilters): Promise<AlertPolicy[]> {
    try {
      this.logger.debug('Fetching alert policies', { filters });
      
      const params: any = {};
      if (filters?.name) {
        params.filter = { name: filters.name };
      }
      
      const response = await this.httpClient.get('/v2/alert_policies.json', { params });
      return response.data.policies || [];
    } catch (error) {
      this.logger.error('Failed to fetch alert policies', error as Error);
      throw error;
    }
  }

  async getAlertPolicy(policyId: string): Promise<AlertPolicy> {
    try {
      this.logger.debug('Fetching alert policy', { policyId });
      
      const response = await this.httpClient.get(`/v2/alert_policies/${policyId}.json`);
      return response.data.policy;
    } catch (error) {
      this.logger.error('Failed to fetch alert policy', error as Error, { policyId });
      throw error;
    }
  }

  async createAlertPolicy(policy: AlertPolicyInput): Promise<AlertPolicy> {
    try {
      this.logger.debug('Creating alert policy', { policy });
      
      const response = await this.httpClient.post('/v2/alert_policies.json', {
        policy,
      });
      
      this.logger.info('Alert policy created', { policyId: response.data.policy.id });
      return response.data.policy;
    } catch (error) {
      this.logger.error('Failed to create alert policy', error as Error, { policy });
      throw error;
    }
  }

  async updateAlertPolicy(policyId: string, updates: Partial<AlertPolicyInput>): Promise<AlertPolicy> {
    try {
      this.logger.debug('Updating alert policy', { policyId, updates });
      
      const response = await this.httpClient.put(`/v2/alert_policies/${policyId}.json`, {
        policy: updates,
      });
      
      this.logger.info('Alert policy updated', { policyId });
      return response.data.policy;
    } catch (error) {
      this.logger.error('Failed to update alert policy', error as Error, { policyId });
      throw error;
    }
  }

  async deleteAlertPolicy(policyId: string): Promise<boolean> {
    try {
      this.logger.debug('Deleting alert policy', { policyId });
      
      await this.httpClient.delete(`/v2/alert_policies/${policyId}.json`);
      
      this.logger.info('Alert policy deleted', { policyId });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete alert policy', error as Error, { policyId });
      return false;
    }
  }

  // Alert Condition methods
  async getAlertConditions(policyId: string): Promise<AlertCondition[]> {
    try {
      this.logger.debug('Fetching alert conditions', { policyId });
      
      const response = await this.httpClient.get(`/v2/alert_conditions.json`, {
        params: { policy_id: policyId },
      });
      
      return response.data.conditions || [];
    } catch (error) {
      this.logger.error('Failed to fetch alert conditions', error as Error, { policyId });
      throw error;
    }
  }

  async getAlertCondition(conditionId: string): Promise<AlertCondition> {
    try {
      this.logger.debug('Fetching alert condition', { conditionId });
      
      const response = await this.httpClient.get(`/v2/alert_conditions/${conditionId}.json`);
      return response.data.condition;
    } catch (error) {
      this.logger.error('Failed to fetch alert condition', error as Error, { conditionId });
      throw error;
    }
  }

  async createAlertCondition(policyId: string, condition: AlertConditionInput): Promise<AlertCondition> {
    try {
      this.logger.debug('Creating alert condition', { policyId, condition });
      
      const response = await this.httpClient.post('/v2/alert_conditions.json', {
        condition: {
          ...condition,
          policy_id: policyId,
        },
      });
      
      this.logger.info('Alert condition created', { conditionId: response.data.condition.id });
      return response.data.condition;
    } catch (error) {
      this.logger.error('Failed to create alert condition', error as Error, { policyId, condition });
      throw error;
    }
  }

  async updateAlertCondition(conditionId: string, condition: Partial<AlertConditionInput>): Promise<AlertCondition> {
    try {
      this.logger.debug('Updating alert condition', { conditionId, condition });
      
      const response = await this.httpClient.put(`/v2/alert_conditions/${conditionId}.json`, {
        condition,
      });
      
      this.logger.info('Alert condition updated', { conditionId });
      return response.data.condition;
    } catch (error) {
      this.logger.error('Failed to update alert condition', error as Error, { conditionId });
      throw error;
    }
  }

  async deleteAlertCondition(conditionId: string): Promise<boolean> {
    try {
      this.logger.debug('Deleting alert condition', { conditionId });
      
      await this.httpClient.delete(`/v2/alert_conditions/${conditionId}.json`);
      
      this.logger.info('Alert condition deleted', { conditionId });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete alert condition', error as Error, { conditionId });
      return false;
    }
  }

  // Notification Channel methods
  async getNotificationChannels(): Promise<NotificationChannel[]> {
    try {
      this.logger.debug('Fetching notification channels');
      
      const response = await this.httpClient.get('/v2/alert_channels.json');
      return response.data.channels || [];
    } catch (error) {
      this.logger.error('Failed to fetch notification channels', error as Error);
      throw error;
    }
  }

  async getNotificationChannel(channelId: string): Promise<NotificationChannel> {
    try {
      this.logger.debug('Fetching notification channel', { channelId });
      
      const response = await this.httpClient.get(`/v2/alert_channels/${channelId}.json`);
      return response.data.channel;
    } catch (error) {
      this.logger.error('Failed to fetch notification channel', error as Error, { channelId });
      throw error;
    }
  }

  async createNotificationChannel(channel: NotificationChannelInput): Promise<NotificationChannel> {
    try {
      this.logger.debug('Creating notification channel', { channel });
      
      const response = await this.httpClient.post('/v2/alert_channels.json', {
        channel,
      });
      
      this.logger.info('Notification channel created', { channelId: response.data.channel.id });
      return response.data.channel;
    } catch (error) {
      this.logger.error('Failed to create notification channel', error as Error, { channel });
      throw error;
    }
  }

  async updateNotificationChannel(channelId: string, updates: Partial<NotificationChannelInput>): Promise<NotificationChannel> {
    try {
      this.logger.debug('Updating notification channel', { channelId, updates });
      
      const response = await this.httpClient.put(`/v2/alert_channels/${channelId}.json`, {
        channel: updates,
      });
      
      this.logger.info('Notification channel updated', { channelId });
      return response.data.channel;
    } catch (error) {
      this.logger.error('Failed to update notification channel', error as Error, { channelId });
      throw error;
    }
  }

  async deleteNotificationChannel(channelId: string): Promise<boolean> {
    try {
      this.logger.debug('Deleting notification channel', { channelId });
      
      await this.httpClient.delete(`/v2/alert_channels/${channelId}.json`);
      
      this.logger.info('Notification channel deleted', { channelId });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete notification channel', error as Error, { channelId });
      return false;
    }
  }

  // Incident methods
  async getIncidents(filters?: IncidentFilters): Promise<Incident[]> {
    try {
      this.logger.debug('Fetching incidents', { filters });
      
      const params: any = {};
      if (filters?.state) {
        params.filter = { state: filters.state };
      }
      if (filters?.since) {
        params.since = filters.since;
      }
      
      const response = await this.httpClient.get('/v2/alert_incidents.json', { params });
      return response.data.incidents || [];
    } catch (error) {
      this.logger.error('Failed to fetch incidents', error as Error);
      throw error;
    }
  }

  async getIncident(incidentId: string): Promise<IncidentDetails> {
    try {
      this.logger.debug('Fetching incident', { incidentId });
      
      const response = await this.httpClient.get(`/v2/alert_incidents/${incidentId}.json`);
      return response.data.incident;
    } catch (error) {
      this.logger.error('Failed to fetch incident', error as Error, { incidentId });
      throw error;
    }
  }

  async acknowledgeIncident(incidentId: string): Promise<boolean> {
    try {
      this.logger.debug('Acknowledging incident', { incidentId });
      
      await this.httpClient.put(`/v2/alert_incidents/${incidentId}.json`, {
        incident: { state: 'acknowledged' },
      });
      
      this.logger.info('Incident acknowledged', { incidentId });
      return true;
    } catch (error) {
      this.logger.error('Failed to acknowledge incident', error as Error, { incidentId });
      return false;
    }
  }

  async closeIncident(incidentId: string): Promise<boolean> {
    try {
      this.logger.debug('Closing incident', { incidentId });
      
      await this.httpClient.put(`/v2/alert_incidents/${incidentId}.json`, {
        incident: { state: 'closed' },
      });
      
      this.logger.info('Incident closed', { incidentId });
      return true;
    } catch (error) {
      this.logger.error('Failed to close incident', error as Error, { incidentId });
      return false;
    }
  }

  // Query utility methods
  async validateQuery(query: string): Promise<ValidationResult> {
    try {
      this.logger.debug('Validating NRQL query', { query });
      
      // Simple validation - try to execute the query with LIMIT 1
      const testQuery = `${query} LIMIT 1`;
      await this.executeNRQL({ query: testQuery });
      
      return {
        valid: true,
        errors: [],
        suggestions: [],
      };
    } catch (error) {
      this.logger.debug('Query validation failed', { query, error: (error as Error).message });
      
      return {
        valid: false,
        errors: [{
          line: 1,
          column: 1,
          message: (error as Error).message,
          severity: 'error',
        }],
        suggestions: [],
      };
    }
  }

  async getQuerySuggestions(partialQuery: string): Promise<string[]> {
    // This would typically use a more sophisticated query suggestion API
    // For now, return basic suggestions based on common patterns
    const suggestions: string[] = [];
    
    if (partialQuery.toLowerCase().includes('select')) {
      suggestions.push('SELECT * FROM Transaction');
      suggestions.push('SELECT count(*) FROM Transaction');
      suggestions.push('SELECT average(duration) FROM Transaction');
    }
    
    if (partialQuery.toLowerCase().includes('from')) {
      suggestions.push('FROM Transaction');
      suggestions.push('FROM PageView');
      suggestions.push('FROM Mobile');
    }
    
    return suggestions;
  }

  async getMetricNames(entityType?: string): Promise<string[]> {
    // This would typically query the NewRelic API for available metrics
    // For now, return common metric names
    const commonMetrics = [
      'duration',
      'throughput',
      'error_rate',
      'apdex',
      'response_time',
      'cpu_usage',
      'memory_usage',
    ];
    
    return commonMetrics;
  }

  async getEntityTypes(): Promise<EntityType[]> {
    // Return common entity types
    return [
      { name: 'Application', domain: 'APM', type: 'APPLICATION' },
      { name: 'Host', domain: 'INFRA', type: 'HOST' },
      { name: 'Browser Application', domain: 'BROWSER', type: 'BROWSER_APPLICATION' },
      { name: 'Mobile Application', domain: 'MOBILE', type: 'MOBILE_APPLICATION' },
    ];
  }

  // Health and status methods
  async checkConnection(): Promise<boolean> {
    try {
      await this.httpClient.get('/v2/applications.json', {
        params: { page: 1 },
        timeout: 5000,
      });
      return true;
    } catch (error) {
      this.logger.error('Connection check failed', error as Error);
      return false;
    }
  }

  async getApiStatus(): Promise<ApiStatus> {
    const startTime = Date.now();
    const connected = await this.checkConnection();
    const responseTime = Date.now() - startTime;
    
    return {
      connected,
      lastSuccessfulCall: this.lastSuccessfulCall,
      rateLimitRemaining: this.rateLimitRemaining,
      rateLimitReset: this.rateLimitReset,
      responseTime,
    };
  }
}