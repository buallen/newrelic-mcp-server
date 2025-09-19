import { NewRelicClient } from '../client/newrelic-client';
import { Logger } from '../utils/logger';
import { CacheManager } from './cache-manager';
import {
  Application,
  ApplicationSummary,
  Entity,
  EntityMetrics,
  TimeRange,
  RelativeTimeRange,
  NRQLResult,
  ErrorEvent,
  EntityType,
} from '../types/newrelic';

export interface APMServiceInterface {
  // Application management
  getApplications(): Promise<Application[]>;
  getApplication(applicationId: string): Promise<Application | null>;
  getApplicationsByName(name: string): Promise<Application[]>;
  getApplicationHealth(applicationId: string): Promise<ApplicationSummary>;

  // Performance metrics
  getApplicationMetrics(applicationId: string, timeRange?: TimeRange): Promise<EntityMetrics>;
  getResponseTimeMetrics(applicationId: string, timeRange?: TimeRange): Promise<number[]>;
  getThroughputMetrics(applicationId: string, timeRange?: TimeRange): Promise<number[]>;
  getErrorRateMetrics(applicationId: string, timeRange?: TimeRange): Promise<number[]>;
  getApdexMetrics(applicationId: string, timeRange?: TimeRange): Promise<number[]>;

  // Transaction data
  getTransactionNames(applicationId: string): Promise<string[]>;
  getTransactionMetrics(
    applicationId: string,
    transactionName: string,
    timeRange?: TimeRange
  ): Promise<EntityMetrics>;
  getSlowTransactions(
    applicationId: string,
    limit?: number,
    timeRange?: TimeRange
  ): Promise<TransactionTrace[]>;

  // Error tracking
  getErrorEvents(
    applicationId: string,
    timeRange?: TimeRange,
    limit?: number
  ): Promise<ErrorEvent[]>;
  getErrorGroups(applicationId: string, timeRange?: TimeRange): Promise<ErrorGroup[]>;
  getErrorDetails(applicationId: string, errorId: string): Promise<ErrorDetails>;

  // Database performance
  getDatabaseMetrics(applicationId: string, timeRange?: TimeRange): Promise<DatabaseMetrics>;
  getSlowQueries(
    applicationId: string,
    limit?: number,
    timeRange?: TimeRange
  ): Promise<SlowQuery[]>;

  // External services
  getExternalServices(applicationId: string, timeRange?: TimeRange): Promise<ExternalService[]>;
  getExternalServiceMetrics(
    applicationId: string,
    serviceName: string,
    timeRange?: TimeRange
  ): Promise<EntityMetrics>;

  // Infrastructure correlation
  getHostMetrics(applicationId: string, timeRange?: TimeRange): Promise<HostMetrics[]>;
  getContainerMetrics(applicationId: string, timeRange?: TimeRange): Promise<ContainerMetrics[]>;
}

export interface TransactionTrace {
  id: string;
  name: string;
  duration: number;
  timestamp: string;
  url?: string;
  statusCode?: number;
  segments: TraceSegment[];
}

export interface TraceSegment {
  name: string;
  duration: number;
  exclusive_duration: number;
  call_count: number;
  class_name?: string;
  method_name?: string;
  children?: TraceSegment[];
}

export interface ErrorGroup {
  id: string;
  message: string;
  error_class: string;
  count: number;
  first_seen: string;
  last_seen: string;
  rate: number;
}

export interface ErrorDetails {
  id: string;
  message: string;
  error_class: string;
  stack_trace: string;
  timestamp: string;
  transaction_name?: string;
  request_uri?: string;
  request_params?: Record<string, any>;
  custom_attributes?: Record<string, any>;
}

export interface DatabaseMetrics {
  total_time: number;
  call_count: number;
  average_response_time: number;
  throughput: number;
  operations: DatabaseOperation[];
}

export interface DatabaseOperation {
  operation: string;
  table?: string;
  call_count: number;
  total_time: number;
  average_time: number;
}

export interface SlowQuery {
  id: string;
  query: string;
  duration: number;
  call_count: number;
  total_time: number;
  timestamp: string;
  database_name?: string;
  table_name?: string;
}

export interface ExternalService {
  name: string;
  host: string;
  response_time: number;
  throughput: number;
  error_rate: number;
  call_count: number;
}

export interface HostMetrics {
  hostname: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_io: number;
  load_average: number;
}

export interface ContainerMetrics {
  container_id: string;
  container_name: string;
  image: string;
  cpu_usage: number;
  memory_usage: number;
  memory_limit: number;
  network_io: number;
  disk_io: number;
}

export class APMService implements APMServiceInterface {
  private client: NewRelicClient;
  private logger: Logger;
  private cache: CacheManager;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly METRICS_CACHE_TTL = 60; // 1 minute for metrics

  constructor(client: NewRelicClient, logger: Logger, cache: CacheManager) {
    this.client = client;
    this.logger = logger;
    this.cache = cache;
  }

  async getApplications(): Promise<Application[]> {
    try {
      const cacheKey = 'apm_applications';

      // Try cache first
      const cached = await this.cache.get<Application[]>(cacheKey);
      if (cached) {
        this.logger.debug('Retrieved applications from cache');
        return cached;
      }

      this.logger.info('Fetching APM applications');

      const response = await this.client.get('/applications.json');
      const applications = response.applications.map(this.mapApplicationResponse);

      // Cache the results
      await this.cache.set(cacheKey, applications, this.CACHE_TTL);

      this.logger.info('Retrieved APM applications', { count: applications.length });
      return applications;
    } catch (error) {
      this.logger.error('Failed to get applications', error as Error);
      throw new Error(`Failed to get applications: ${error.message}`);
    }
  }

  async getApplication(applicationId: string): Promise<Application | null> {
    try {
      const cacheKey = `apm_application_${applicationId}`;

      // Try cache first
      const cached = await this.cache.get<Application>(cacheKey);
      if (cached) {
        return cached;
      }

      this.logger.debug('Fetching application', { applicationId });

      const response = await this.client.get(`/applications/${applicationId}.json`);
      const application = this.mapApplicationResponse(response.application);

      // Cache the result
      await this.cache.set(cacheKey, application, this.CACHE_TTL);

      return application;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      this.logger.error('Failed to get application', error, { applicationId });
      throw new Error(`Failed to get application: ${error.message}`);
    }
  }

  async getApplicationsByName(name: string): Promise<Application[]> {
    try {
      this.logger.info('Searching applications by name', { name });

      const response = await this.client.get(
        `/applications.json?filter[name]=${encodeURIComponent(name)}`
      );
      const applications = response.applications.map(this.mapApplicationResponse);

      this.logger.info('Found applications by name', { name, count: applications.length });
      return applications;
    } catch (error) {
      this.logger.error('Failed to search applications by name', error, { name });
      throw new Error(`Failed to search applications by name: ${error.message}`);
    }
  }

  async getApplicationHealth(applicationId: string): Promise<ApplicationSummary> {
    try {
      const cacheKey = `apm_health_${applicationId}`;

      // Try cache first (shorter TTL for health data)
      const cached = await this.cache.get<ApplicationSummary>(cacheKey);
      if (cached) {
        return cached;
      }

      this.logger.debug('Fetching application health', { applicationId });

      const response = await this.client.get(`/applications/${applicationId}.json`);
      const health = response.application.application_summary;

      // Cache with shorter TTL
      await this.cache.set(cacheKey, health, this.METRICS_CACHE_TTL);

      return health;
    } catch (error) {
      this.logger.error('Failed to get application health', error, { applicationId });
      throw new Error(`Failed to get application health: ${error.message}`);
    }
  }

  async getApplicationMetrics(
    applicationId: string,
    timeRange?: TimeRange
  ): Promise<EntityMetrics> {
    try {
      const cacheKey = `apm_metrics_${applicationId}_${this.getTimeRangeKey(timeRange)}`;

      // Try cache first
      const cached = await this.cache.get<EntityMetrics>(cacheKey);
      if (cached) {
        return cached;
      }

      this.logger.debug('Fetching application metrics', { applicationId, timeRange });

      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT 
          average(duration) as responseTime,
          rate(count(*), 1 minute) as throughput,
          percentage(count(*), WHERE error IS true) as errorRate,
          apdex(duration, t: 0.5) as apdexScore
        FROM Transaction 
        WHERE appId = ${applicationId} 
        ${since} ${until}
      `;

      const result = await this.client.executeNRQL(query);
      const metrics = this.parseMetricsFromNRQL(result);

      // Cache with shorter TTL for metrics
      await this.cache.set(cacheKey, metrics, this.METRICS_CACHE_TTL);

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get application metrics', error, { applicationId, timeRange });
      throw new Error(`Failed to get application metrics: ${error.message}`);
    }
  }

  async getResponseTimeMetrics(applicationId: string, timeRange?: TimeRange): Promise<number[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT average(duration) 
        FROM Transaction 
        WHERE appId = ${applicationId} 
        ${since} ${until}
        TIMESERIES 5 minutes
      `;

      const result = await this.client.executeNRQL(query);
      return this.extractTimeSeriesValues(result);
    } catch (error) {
      this.logger.error('Failed to get response time metrics', error, { applicationId, timeRange });
      throw new Error(`Failed to get response time metrics: ${error.message}`);
    }
  }

  async getThroughputMetrics(applicationId: string, timeRange?: TimeRange): Promise<number[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT rate(count(*), 1 minute) 
        FROM Transaction 
        WHERE appId = ${applicationId} 
        ${since} ${until}
        TIMESERIES 5 minutes
      `;

      const result = await this.client.executeNRQL(query);
      return this.extractTimeSeriesValues(result);
    } catch (error) {
      this.logger.error('Failed to get throughput metrics', error, { applicationId, timeRange });
      throw new Error(`Failed to get throughput metrics: ${error.message}`);
    }
  }

  async getErrorRateMetrics(applicationId: string, timeRange?: TimeRange): Promise<number[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT percentage(count(*), WHERE error IS true) 
        FROM Transaction 
        WHERE appId = ${applicationId} 
        ${since} ${until}
        TIMESERIES 5 minutes
      `;

      const result = await this.client.executeNRQL(query);
      return this.extractTimeSeriesValues(result);
    } catch (error) {
      this.logger.error('Failed to get error rate metrics', error, { applicationId, timeRange });
      throw new Error(`Failed to get error rate metrics: ${error.message}`);
    }
  }

  async getApdexMetrics(applicationId: string, timeRange?: TimeRange): Promise<number[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT apdex(duration, t: 0.5) 
        FROM Transaction 
        WHERE appId = ${applicationId} 
        ${since} ${until}
        TIMESERIES 5 minutes
      `;

      const result = await this.client.executeNRQL(query);
      return this.extractTimeSeriesValues(result);
    } catch (error) {
      this.logger.error('Failed to get apdex metrics', error, { applicationId, timeRange });
      throw new Error(`Failed to get apdex metrics: ${error.message}`);
    }
  }

  async getTransactionNames(applicationId: string): Promise<string[]> {
    try {
      const cacheKey = `apm_transactions_${applicationId}`;

      // Try cache first
      const cached = await this.cache.get<string[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const query = `
        SELECT uniques(name) 
        FROM Transaction 
        WHERE appId = ${applicationId} 
        SINCE 1 day ago
      `;

      const result = await this.client.executeNRQL(query);
      const transactionNames = result.results[0]?.members || [];

      // Cache the results
      await this.cache.set(cacheKey, transactionNames, this.CACHE_TTL);

      return transactionNames;
    } catch (error) {
      this.logger.error('Failed to get transaction names', error, { applicationId });
      throw new Error(`Failed to get transaction names: ${error.message}`);
    }
  }

  async getTransactionMetrics(
    applicationId: string,
    transactionName: string,
    timeRange?: TimeRange
  ): Promise<EntityMetrics> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT 
          average(duration) as responseTime,
          rate(count(*), 1 minute) as throughput,
          percentage(count(*), WHERE error IS true) as errorRate
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND name = '${transactionName}'
        ${since} ${until}
      `;

      const result = await this.client.executeNRQL(query);
      return this.parseMetricsFromNRQL(result);
    } catch (error) {
      this.logger.error('Failed to get transaction metrics', error, {
        applicationId,
        transactionName,
        timeRange,
      });
      throw new Error(`Failed to get transaction metrics: ${error.message}`);
    }
  }

  async getSlowTransactions(
    applicationId: string,
    limit: number = 10,
    timeRange?: TimeRange
  ): Promise<TransactionTrace[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT name, duration, timestamp 
        FROM Transaction 
        WHERE appId = ${applicationId} 
        ${since} ${until}
        ORDER BY duration DESC 
        LIMIT ${limit}
      `;

      const result = await this.client.executeNRQL(query);
      return result.results.map(row => ({
        id: `${row.timestamp}_${row.name}`,
        name: row.name,
        duration: row.duration,
        timestamp: new Date(row.timestamp).toISOString(),
        segments: [], // Would need additional API calls to get detailed segments
      }));
    } catch (error) {
      this.logger.error('Failed to get slow transactions', error, {
        applicationId,
        limit,
        timeRange,
      });
      throw new Error(`Failed to get slow transactions: ${error.message}`);
    }
  }

  async getErrorEvents(
    applicationId: string,
    timeRange?: TimeRange,
    limit: number = 100
  ): Promise<ErrorEvent[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT message, error.class, timestamp, transactionName 
        FROM TransactionError 
        WHERE appId = ${applicationId} 
        ${since} ${until}
        LIMIT ${limit}
      `;

      const result = await this.client.executeNRQL(query);
      return result.results.map(row => ({
        timestamp: new Date(row.timestamp).toISOString(),
        message: row.message || 'Unknown error',
        stackTrace: '', // Would need additional API call for full stack trace
        entityGuid: applicationId,
        entityName: '', // Would need to resolve from application ID
        attributes: {
          errorClass: row['error.class'],
          transactionName: row.transactionName,
        },
      }));
    } catch (error) {
      this.logger.error('Failed to get error events', error, { applicationId, timeRange, limit });
      throw new Error(`Failed to get error events: ${error.message}`);
    }
  }

  async getErrorGroups(applicationId: string, timeRange?: TimeRange): Promise<ErrorGroup[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT 
          count(*) as count,
          rate(count(*), 1 minute) as rate,
          earliest(timestamp) as first_seen,
          latest(timestamp) as last_seen
        FROM TransactionError 
        WHERE appId = ${applicationId} 
        ${since} ${until}
        FACET message, error.class
      `;

      const result = await this.client.executeNRQL(query);
      return result.results.map((row, index) => ({
        id: `error_group_${index}`,
        message: row.message || 'Unknown error',
        error_class: row['error.class'] || 'Unknown',
        count: row.count,
        rate: row.rate,
        first_seen: new Date(row.first_seen).toISOString(),
        last_seen: new Date(row.last_seen).toISOString(),
      }));
    } catch (error) {
      this.logger.error('Failed to get error groups', error, { applicationId, timeRange });
      throw new Error(`Failed to get error groups: ${error.message}`);
    }
  }

  async getErrorDetails(applicationId: string, errorId: string): Promise<ErrorDetails> {
    try {
      // This would typically require a specific error trace API call
      // For now, we'll return a placeholder implementation
      throw new Error('Error details retrieval not yet implemented');
    } catch (error) {
      this.logger.error('Failed to get error details', error, { applicationId, errorId });
      throw new Error(`Failed to get error details: ${error.message}`);
    }
  }

  async getDatabaseMetrics(applicationId: string, timeRange?: TimeRange): Promise<DatabaseMetrics> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT 
          sum(databaseDuration) as total_time,
          count(*) as call_count,
          average(databaseDuration) as average_response_time,
          rate(count(*), 1 minute) as throughput
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND databaseDuration IS NOT NULL
        ${since} ${until}
      `;

      const result = await this.client.executeNRQL(query);
      const row = result.results[0] || {};

      return {
        total_time: row.total_time || 0,
        call_count: row.call_count || 0,
        average_response_time: row.average_response_time || 0,
        throughput: row.throughput || 0,
        operations: [], // Would need additional queries to get operation breakdown
      };
    } catch (error) {
      this.logger.error('Failed to get database metrics', error, { applicationId, timeRange });
      throw new Error(`Failed to get database metrics: ${error.message}`);
    }
  }

  async getSlowQueries(
    applicationId: string,
    limit: number = 10,
    timeRange?: TimeRange
  ): Promise<SlowQuery[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT databaseDuration, timestamp, databaseCallCount 
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND databaseDuration IS NOT NULL
        ${since} ${until}
        ORDER BY databaseDuration DESC 
        LIMIT ${limit}
      `;

      const result = await this.client.executeNRQL(query);
      return result.results.map((row, index) => ({
        id: `slow_query_${index}`,
        query: 'Query details not available', // Would need database trace data
        duration: row.databaseDuration,
        call_count: row.databaseCallCount || 1,
        total_time: row.databaseDuration,
        timestamp: new Date(row.timestamp).toISOString(),
      }));
    } catch (error) {
      this.logger.error('Failed to get slow queries', error, { applicationId, limit, timeRange });
      throw new Error(`Failed to get slow queries: ${error.message}`);
    }
  }

  async getExternalServices(
    applicationId: string,
    timeRange?: TimeRange
  ): Promise<ExternalService[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT 
          average(externalDuration) as response_time,
          rate(count(*), 1 minute) as throughput,
          count(*) as call_count
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND externalDuration IS NOT NULL
        ${since} ${until}
        FACET host
      `;

      const result = await this.client.executeNRQL(query);
      return result.results.map(row => ({
        name: row.host || 'Unknown Service',
        host: row.host || 'unknown',
        response_time: row.response_time || 0,
        throughput: row.throughput || 0,
        error_rate: 0, // Would need additional query for error rate
        call_count: row.call_count || 0,
      }));
    } catch (error) {
      this.logger.error('Failed to get external services', error, { applicationId, timeRange });
      throw new Error(`Failed to get external services: ${error.message}`);
    }
  }

  async getExternalServiceMetrics(
    applicationId: string,
    serviceName: string,
    timeRange?: TimeRange
  ): Promise<EntityMetrics> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT 
          average(externalDuration) as responseTime,
          rate(count(*), 1 minute) as throughput
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND host = '${serviceName}'
        ${since} ${until}
      `;

      const result = await this.client.executeNRQL(query);
      return this.parseMetricsFromNRQL(result);
    } catch (error) {
      this.logger.error('Failed to get external service metrics', error, {
        applicationId,
        serviceName,
        timeRange,
      });
      throw new Error(`Failed to get external service metrics: ${error.message}`);
    }
  }

  async getHostMetrics(applicationId: string, timeRange?: TimeRange): Promise<HostMetrics[]> {
    try {
      // This would typically require Infrastructure API integration
      // For now, return empty array as placeholder
      this.logger.warn('Host metrics not yet implemented', { applicationId });
      return [];
    } catch (error) {
      this.logger.error('Failed to get host metrics', error, { applicationId, timeRange });
      throw new Error(`Failed to get host metrics: ${error.message}`);
    }
  }

  async getContainerMetrics(
    applicationId: string,
    timeRange?: TimeRange
  ): Promise<ContainerMetrics[]> {
    try {
      // This would typically require Infrastructure API integration
      // For now, return empty array as placeholder
      this.logger.warn('Container metrics not yet implemented', { applicationId });
      return [];
    } catch (error) {
      this.logger.error('Failed to get container metrics', error, { applicationId, timeRange });
      throw new Error(`Failed to get container metrics: ${error.message}`);
    }
  }

  // Private helper methods
  private mapApplicationResponse(app: any): Application {
    return {
      id: app.id.toString(),
      name: app.name,
      language: app.language || 'unknown',
      health_status: app.health_status || 'gray',
      reporting: app.reporting || false,
      last_reported_at: app.last_reported_at || '',
      application_summary: {
        response_time: app.application_summary?.response_time || 0,
        throughput: app.application_summary?.throughput || 0,
        error_rate: app.application_summary?.error_rate || 0,
        apdex_target: app.application_summary?.apdex_target || 0.5,
        apdex_score: app.application_summary?.apdex_score || 0,
      },
    };
  }

  private parseMetricsFromNRQL(result: NRQLResult): EntityMetrics {
    const row = result.results[0] || {};
    return {
      responseTime: row.responseTime || row.average_duration || 0,
      throughput: row.throughput || row.rate || 0,
      errorRate: row.errorRate || row.error_rate || 0,
      apdexScore: row.apdexScore || row.apdex || 0,
    };
  }

  private extractTimeSeriesValues(result: NRQLResult): number[] {
    if (!result.results || !Array.isArray(result.results)) {
      return [];
    }

    return result.results.map(row => {
      // Extract the first numeric value from each row
      const values = Object.values(row).filter(v => typeof v === 'number');
      return values[0] || 0;
    });
  }

  private getTimeRangeKey(timeRange?: TimeRange): string {
    if (!timeRange) {
      return 'default';
    }
    return `${timeRange.since}_${timeRange.until || 'now'}`;
  }
}
