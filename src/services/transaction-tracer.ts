import { NewRelicClient } from '../client/newrelic-client';
import { Logger } from '../utils/logger';
import { CacheManager } from './cache-manager';
import {
  TimeRange,
  NRQLResult
} from '../types/newrelic';

export interface TransactionTrace {
  id: string;
  name: string;
  duration: number;
  timestamp: string;
  url?: string;
  statusCode?: number;
  guid?: string;
  segments: TraceSegment[];
  attributes: Record<string, any>;
  userAttributes: Record<string, any>;
  agentAttributes: Record<string, any>;
}

export interface TraceSegment {
  name: string;
  duration: number;
  exclusive_duration: number;
  call_count: number;
  class_name?: string;
  method_name?: string;
  sql?: string;
  uri?: string;
  children: TraceSegment[];
  parameters?: Record<string, any>;
}

export interface TransactionSummary {
  name: string;
  count: number;
  average_duration: number;
  min_duration: number;
  max_duration: number;
  total_duration: number;
  error_count: number;
  error_rate: number;
  throughput: number;
  apdex_score?: number;
}

export interface DatabaseTrace {
  query: string;
  duration: number;
  call_count: number;
  total_time: number;
  database_name?: string;
  operation?: string;
  table?: string;
  stack_trace?: string[];
}

export interface ExternalTrace {
  host: string;
  library: string;
  duration: number;
  call_count: number;
  total_time: number;
  uri?: string;
  method?: string;
}

export interface TransactionTracerInterface {
  // Transaction trace retrieval
  getTransactionTrace(traceId: string): Promise<TransactionTrace | null>;
  getTransactionTraces(applicationId: string, limit?: number, timeRange?: TimeRange): Promise<TransactionTrace[]>;
  getSlowTransactionTraces(applicationId: string, limit?: number, timeRange?: TimeRange): Promise<TransactionTrace[]>;
  
  // Transaction analysis
  getTransactionSummary(applicationId: string, transactionName: string, timeRange?: TimeRange): Promise<TransactionSummary>;
  getTransactionBreakdown(applicationId: string, transactionName: string, timeRange?: TimeRange): Promise<TraceSegment[]>;
  
  // Database performance analysis
  getDatabaseTraces(applicationId: string, limit?: number, timeRange?: TimeRange): Promise<DatabaseTrace[]>;
  getSlowDatabaseQueries(applicationId: string, limit?: number, timeRange?: TimeRange): Promise<DatabaseTrace[]>;
  getDatabaseOperationBreakdown(applicationId: string, timeRange?: TimeRange): Promise<DatabaseOperationSummary[]>;
  
  // External service analysis
  getExternalTraces(applicationId: string, limit?: number, timeRange?: TimeRange): Promise<ExternalTrace[]>;
  getSlowExternalCalls(applicationId: string, limit?: number, timeRange?: TimeRange): Promise<ExternalTrace[]>;
  getExternalServiceBreakdown(applicationId: string, timeRange?: TimeRange): Promise<ExternalServiceSummary[]>;
  
  // Performance analysis
  analyzeTransactionPerformance(applicationId: string, transactionName: string, timeRange?: TimeRange): Promise<PerformanceAnalysis>;
  identifyBottlenecks(applicationId: string, transactionName: string, timeRange?: TimeRange): Promise<Bottleneck[]>;
  compareTransactionPerformance(applicationId: string, transactionName: string, baselineRange: TimeRange, comparisonRange: TimeRange): Promise<PerformanceComparison>;
}

export interface DatabaseOperationSummary {
  operation: string;
  database?: string;
  table?: string;
  count: number;
  total_time: number;
  average_time: number;
  max_time: number;
  percentage_of_total: number;
}

export interface ExternalServiceSummary {
  host: string;
  library: string;
  count: number;
  total_time: number;
  average_time: number;
  max_time: number;
  percentage_of_total: number;
}

export interface PerformanceAnalysis {
  transaction_name: string;
  total_time: number;
  application_time: number;
  database_time: number;
  external_time: number;
  gc_time?: number;
  segments: SegmentAnalysis[];
  recommendations: string[];
}

export interface SegmentAnalysis {
  name: string;
  time: number;
  percentage: number;
  call_count: number;
  average_time: number;
  type: 'database' | 'external' | 'application' | 'gc';
}

export interface Bottleneck {
  type: 'database' | 'external' | 'application' | 'gc';
  name: string;
  impact_score: number;
  time_spent: number;
  percentage_of_total: number;
  call_count: number;
  average_time: number;
  description: string;
  recommendations: string[];
}

export interface PerformanceComparison {
  transaction_name: string;
  baseline: PerformanceMetrics;
  comparison: PerformanceMetrics;
  changes: PerformanceChanges;
  significant_changes: SignificantChange[];
}

export interface PerformanceMetrics {
  average_duration: number;
  throughput: number;
  error_rate: number;
  apdex_score?: number;
  database_time: number;
  external_time: number;
  application_time: number;
}

export interface PerformanceChanges {
  duration_change: number;
  throughput_change: number;
  error_rate_change: number;
  apdex_change?: number;
  database_time_change: number;
  external_time_change: number;
  application_time_change: number;
}

export interface SignificantChange {
  metric: string;
  change: number;
  significance: 'high' | 'medium' | 'low';
  description: string;
}

export class TransactionTracer implements TransactionTracerInterface {
  private client: NewRelicClient;
  private logger: Logger;
  private cache: CacheManager;
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly TRACE_CACHE_TTL = 600; // 10 minutes for traces

  constructor(client: NewRelicClient, logger: Logger, cache: CacheManager) {
    this.client = client;
    this.logger = logger;
    this.cache = cache;
  }

  async getTransactionTrace(traceId: string): Promise<TransactionTrace | null> {
    try {
      const cacheKey = `transaction_trace_${traceId}`;
      
      // Try cache first
      const cached = await this.cache.get<TransactionTrace>(cacheKey);
      if (cached) {
        return cached;
      }
      
      this.logger.debug('Fetching transaction trace', { traceId });
      
      // Use REST API to get trace details
      const response = await this.client.get(`/application_instances/${traceId}/traces.json`);
      
      if (!response.traces || response.traces.length === 0) {
        return null;
      }
      
      const trace = this.mapTraceResponse(response.traces[0]);
      
      // Cache the result
      await this.cache.set(cacheKey, trace, this.TRACE_CACHE_TTL);
      
      return trace;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      this.logger.error('Failed to get transaction trace', error, { traceId });
      throw new Error(`Failed to get transaction trace: ${error.message}`);
    }
  }

  async getTransactionTraces(applicationId: string, limit: number = 20, timeRange?: TimeRange): Promise<TransactionTrace[]> {
    try {
      const cacheKey = `transaction_traces_${applicationId}_${limit}_${this.getTimeRangeKey(timeRange)}`;
      
      // Try cache first
      const cached = await this.cache.get<TransactionTrace[]>(cacheKey);
      if (cached) {
        return cached;
      }
      
      this.logger.info('Fetching transaction traces', { applicationId, limit, timeRange });
      
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      // Get trace data using NRQL
      const query = `
        SELECT name, duration, timestamp, guid, request.uri, httpResponseCode
        FROM Transaction 
        WHERE appId = ${applicationId} 
        ${since} ${until}
        ORDER BY timestamp DESC 
        LIMIT ${limit}
      `;
      
      const result = await this.client.executeNRQL(query);
      const traces = result.results.map(row => this.mapNRQLToTrace(row));
      
      // Cache the results
      await this.cache.set(cacheKey, traces, this.CACHE_TTL);
      
      this.logger.info('Retrieved transaction traces', { applicationId, count: traces.length });
      return traces;
    } catch (error) {
      this.logger.error('Failed to get transaction traces', error, { applicationId, limit, timeRange });
      throw new Error(`Failed to get transaction traces: ${error.message}`);
    }
  }

  async getSlowTransactionTraces(applicationId: string, limit: number = 10, timeRange?: TimeRange): Promise<TransactionTrace[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      const query = `
        SELECT name, duration, timestamp, guid, request.uri, httpResponseCode
        FROM Transaction 
        WHERE appId = ${applicationId} 
        ${since} ${until}
        ORDER BY duration DESC 
        LIMIT ${limit}
      `;
      
      const result = await this.client.executeNRQL(query);
      return result.results.map(row => this.mapNRQLToTrace(row));
    } catch (error) {
      this.logger.error('Failed to get slow transaction traces', error, { applicationId, limit, timeRange });
      throw new Error(`Failed to get slow transaction traces: ${error.message}`);
    }
  }

  async getTransactionSummary(applicationId: string, transactionName: string, timeRange?: TimeRange): Promise<TransactionSummary> {
    try {
      const cacheKey = `transaction_summary_${applicationId}_${transactionName}_${this.getTimeRangeKey(timeRange)}`;
      
      // Try cache first
      const cached = await this.cache.get<TransactionSummary>(cacheKey);
      if (cached) {
        return cached;
      }
      
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      const query = `
        SELECT 
          count(*) as count,
          average(duration) as average_duration,
          min(duration) as min_duration,
          max(duration) as max_duration,
          sum(duration) as total_duration,
          filter(count(*), WHERE error IS true) as error_count,
          percentage(count(*), WHERE error IS true) as error_rate,
          rate(count(*), 1 minute) as throughput,
          apdex(duration, t: 0.5) as apdex_score
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND name = '${transactionName}'
        ${since} ${until}
      `;
      
      const result = await this.client.executeNRQL(query);
      const row = result.results[0] || {};
      
      const summary: TransactionSummary = {
        name: transactionName,
        count: row.count || 0,
        average_duration: row.average_duration || 0,
        min_duration: row.min_duration || 0,
        max_duration: row.max_duration || 0,
        total_duration: row.total_duration || 0,
        error_count: row.error_count || 0,
        error_rate: row.error_rate || 0,
        throughput: row.throughput || 0,
        apdex_score: row.apdex_score
      };
      
      // Cache the result
      await this.cache.set(cacheKey, summary, this.CACHE_TTL);
      
      return summary;
    } catch (error) {
      this.logger.error('Failed to get transaction summary', error, { applicationId, transactionName, timeRange });
      throw new Error(`Failed to get transaction summary: ${error.message}`);
    }
  }

  async getTransactionBreakdown(applicationId: string, transactionName: string, timeRange?: TimeRange): Promise<TraceSegment[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      // Get breakdown by component type
      const query = `
        SELECT 
          average(duration) as duration,
          average(databaseDuration) as database_duration,
          average(externalDuration) as external_duration,
          count(*) as call_count
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND name = '${transactionName}'
        ${since} ${until}
      `;
      
      const result = await this.client.executeNRQL(query);
      const row = result.results[0] || {};
      
      const segments: TraceSegment[] = [];
      
      if (row.database_duration > 0) {
        segments.push({
          name: 'Database',
          duration: row.database_duration,
          exclusive_duration: row.database_duration,
          call_count: row.call_count || 1,
          children: []
        });
      }
      
      if (row.external_duration > 0) {
        segments.push({
          name: 'External Services',
          duration: row.external_duration,
          exclusive_duration: row.external_duration,
          call_count: row.call_count || 1,
          children: []
        });
      }
      
      const applicationTime = (row.duration || 0) - (row.database_duration || 0) - (row.external_duration || 0);
      if (applicationTime > 0) {
        segments.push({
          name: 'Application Code',
          duration: applicationTime,
          exclusive_duration: applicationTime,
          call_count: row.call_count || 1,
          children: []
        });
      }
      
      return segments;
    } catch (error) {
      this.logger.error('Failed to get transaction breakdown', error, { applicationId, transactionName, timeRange });
      throw new Error(`Failed to get transaction breakdown: ${error.message}`);
    }
  }

  async getDatabaseTraces(applicationId: string, limit: number = 20, timeRange?: TimeRange): Promise<DatabaseTrace[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      const query = `
        SELECT 
          databaseDuration as duration,
          databaseCallCount as call_count,
          name as transaction_name
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND databaseDuration IS NOT NULL
        ${since} ${until}
        ORDER BY databaseDuration DESC 
        LIMIT ${limit}
      `;
      
      const result = await this.client.executeNRQL(query);
      return result.results.map((row, index) => ({
        query: 'Query details not available from NRQL', // Would need trace details
        duration: row.duration || 0,
        call_count: row.call_count || 1,
        total_time: (row.duration || 0) * (row.call_count || 1),
        operation: 'SELECT' // Would need to parse from actual query
      }));
    } catch (error) {
      this.logger.error('Failed to get database traces', error, { applicationId, limit, timeRange });
      throw new Error(`Failed to get database traces: ${error.message}`);
    }
  }

  async getSlowDatabaseQueries(applicationId: string, limit: number = 10, timeRange?: TimeRange): Promise<DatabaseTrace[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      const query = `
        SELECT 
          max(databaseDuration) as duration,
          sum(databaseCallCount) as call_count,
          sum(databaseDuration * databaseCallCount) as total_time
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND databaseDuration IS NOT NULL
        ${since} ${until}
        FACET name
        ORDER BY max(databaseDuration) DESC 
        LIMIT ${limit}
      `;
      
      const result = await this.client.executeNRQL(query);
      return result.results.map(row => ({
        query: `Transaction: ${row.name}`,
        duration: row.duration || 0,
        call_count: row.call_count || 1,
        total_time: row.total_time || 0,
        operation: 'MIXED' // Multiple operations in transaction
      }));
    } catch (error) {
      this.logger.error('Failed to get slow database queries', error, { applicationId, limit, timeRange });
      throw new Error(`Failed to get slow database queries: ${error.message}`);
    }
  }

  async getDatabaseOperationBreakdown(applicationId: string, timeRange?: TimeRange): Promise<DatabaseOperationSummary[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      // This is a simplified implementation - real implementation would need more detailed trace data
      const query = `
        SELECT 
          count(*) as count,
          sum(databaseDuration) as total_time,
          average(databaseDuration) as average_time,
          max(databaseDuration) as max_time
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND databaseDuration IS NOT NULL
        ${since} ${until}
      `;
      
      const result = await this.client.executeNRQL(query);
      const row = result.results[0] || {};
      
      // Return a single summary since we don't have operation-level breakdown
      return [{
        operation: 'ALL_OPERATIONS',
        count: row.count || 0,
        total_time: row.total_time || 0,
        average_time: row.average_time || 0,
        max_time: row.max_time || 0,
        percentage_of_total: 100
      }];
    } catch (error) {
      this.logger.error('Failed to get database operation breakdown', error, { applicationId, timeRange });
      throw new Error(`Failed to get database operation breakdown: ${error.message}`);
    }
  }

  async getExternalTraces(applicationId: string, limit: number = 20, timeRange?: TimeRange): Promise<ExternalTrace[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      const query = `
        SELECT 
          externalDuration as duration,
          externalCallCount as call_count,
          host
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND externalDuration IS NOT NULL
        ${since} ${until}
        ORDER BY externalDuration DESC 
        LIMIT ${limit}
      `;
      
      const result = await this.client.executeNRQL(query);
      return result.results.map(row => ({
        host: row.host || 'unknown',
        library: 'HTTP', // Would need more detailed trace data
        duration: row.duration || 0,
        call_count: row.call_count || 1,
        total_time: (row.duration || 0) * (row.call_count || 1)
      }));
    } catch (error) {
      this.logger.error('Failed to get external traces', error, { applicationId, limit, timeRange });
      throw new Error(`Failed to get external traces: ${error.message}`);
    }
  }

  async getSlowExternalCalls(applicationId: string, limit: number = 10, timeRange?: TimeRange): Promise<ExternalTrace[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      const query = `
        SELECT 
          max(externalDuration) as duration,
          sum(externalCallCount) as call_count,
          sum(externalDuration * externalCallCount) as total_time
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND externalDuration IS NOT NULL
        ${since} ${until}
        FACET host
        ORDER BY max(externalDuration) DESC 
        LIMIT ${limit}
      `;
      
      const result = await this.client.executeNRQL(query);
      return result.results.map(row => ({
        host: row.host || 'unknown',
        library: 'HTTP',
        duration: row.duration || 0,
        call_count: row.call_count || 1,
        total_time: row.total_time || 0
      }));
    } catch (error) {
      this.logger.error('Failed to get slow external calls', error, { applicationId, limit, timeRange });
      throw new Error(`Failed to get slow external calls: ${error.message}`);
    }
  }

  async getExternalServiceBreakdown(applicationId: string, timeRange?: TimeRange): Promise<ExternalServiceSummary[]> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      const query = `
        SELECT 
          count(*) as count,
          sum(externalDuration) as total_time,
          average(externalDuration) as average_time,
          max(externalDuration) as max_time
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND externalDuration IS NOT NULL
        ${since} ${until}
        FACET host
      `;
      
      const result = await this.client.executeNRQL(query);
      const totalTime = result.results.reduce((sum, row) => sum + (row.total_time || 0), 0);
      
      return result.results.map(row => ({
        host: row.host || 'unknown',
        library: 'HTTP',
        count: row.count || 0,
        total_time: row.total_time || 0,
        average_time: row.average_time || 0,
        max_time: row.max_time || 0,
        percentage_of_total: totalTime > 0 ? ((row.total_time || 0) / totalTime) * 100 : 0
      }));
    } catch (error) {
      this.logger.error('Failed to get external service breakdown', error, { applicationId, timeRange });
      throw new Error(`Failed to get external service breakdown: ${error.message}`);
    }
  }

  async analyzeTransactionPerformance(applicationId: string, transactionName: string, timeRange?: TimeRange): Promise<PerformanceAnalysis> {
    try {
      const since = timeRange?.since || 'SINCE 1 hour ago';
      const until = timeRange?.until ? `UNTIL '${timeRange.until}'` : '';
      
      const query = `
        SELECT 
          average(duration) as total_time,
          average(databaseDuration) as database_time,
          average(externalDuration) as external_time,
          count(*) as call_count
        FROM Transaction 
        WHERE appId = ${applicationId} 
        AND name = '${transactionName}'
        ${since} ${until}
      `;
      
      const result = await this.client.executeNRQL(query);
      const row = result.results[0] || {};
      
      const totalTime = row.total_time || 0;
      const databaseTime = row.database_time || 0;
      const externalTime = row.external_time || 0;
      const applicationTime = totalTime - databaseTime - externalTime;
      
      const segments: SegmentAnalysis[] = [];
      
      if (databaseTime > 0) {
        segments.push({
          name: 'Database',
          time: databaseTime,
          percentage: (databaseTime / totalTime) * 100,
          call_count: row.call_count || 1,
          average_time: databaseTime,
          type: 'database'
        });
      }
      
      if (externalTime > 0) {
        segments.push({
          name: 'External Services',
          time: externalTime,
          percentage: (externalTime / totalTime) * 100,
          call_count: row.call_count || 1,
          average_time: externalTime,
          type: 'external'
        });
      }
      
      if (applicationTime > 0) {
        segments.push({
          name: 'Application Code',
          time: applicationTime,
          percentage: (applicationTime / totalTime) * 100,
          call_count: row.call_count || 1,
          average_time: applicationTime,
          type: 'application'
        });
      }
      
      const recommendations = this.generatePerformanceRecommendations(segments);
      
      return {
        transaction_name: transactionName,
        total_time: totalTime,
        application_time: applicationTime,
        database_time: databaseTime,
        external_time: externalTime,
        segments,
        recommendations
      };
    } catch (error) {
      this.logger.error('Failed to analyze transaction performance', error, { applicationId, transactionName, timeRange });
      throw new Error(`Failed to analyze transaction performance: ${error.message}`);
    }
  }

  async identifyBottlenecks(applicationId: string, transactionName: string, timeRange?: TimeRange): Promise<Bottleneck[]> {
    try {
      const analysis = await this.analyzeTransactionPerformance(applicationId, transactionName, timeRange);
      const bottlenecks: Bottleneck[] = [];
      
      // Identify segments that take more than 20% of total time
      for (const segment of analysis.segments) {
        if (segment.percentage > 20) {
          const impactScore = segment.percentage / 100;
          
          bottlenecks.push({
            type: segment.type,
            name: segment.name,
            impact_score: impactScore,
            time_spent: segment.time,
            percentage_of_total: segment.percentage,
            call_count: segment.call_count,
            average_time: segment.average_time,
            description: `${segment.name} accounts for ${segment.percentage.toFixed(1)}% of transaction time`,
            recommendations: this.getBottleneckRecommendations(segment.type, segment.percentage)
          });
        }
      }
      
      // Sort by impact score
      bottlenecks.sort((a, b) => b.impact_score - a.impact_score);
      
      return bottlenecks;
    } catch (error) {
      this.logger.error('Failed to identify bottlenecks', error, { applicationId, transactionName, timeRange });
      throw new Error(`Failed to identify bottlenecks: ${error.message}`);
    }
  }

  async compareTransactionPerformance(
    applicationId: string, 
    transactionName: string, 
    baselineRange: TimeRange, 
    comparisonRange: TimeRange
  ): Promise<PerformanceComparison> {
    try {
      const [baselineMetrics, comparisonMetrics] = await Promise.all([
        this.getPerformanceMetrics(applicationId, transactionName, baselineRange),
        this.getPerformanceMetrics(applicationId, transactionName, comparisonRange)
      ]);
      
      const changes: PerformanceChanges = {
        duration_change: this.calculatePercentageChange(baselineMetrics.average_duration, comparisonMetrics.average_duration),
        throughput_change: this.calculatePercentageChange(baselineMetrics.throughput, comparisonMetrics.throughput),
        error_rate_change: this.calculatePercentageChange(baselineMetrics.error_rate, comparisonMetrics.error_rate),
        database_time_change: this.calculatePercentageChange(baselineMetrics.database_time, comparisonMetrics.database_time),
        external_time_change: this.calculatePercentageChange(baselineMetrics.external_time, comparisonMetrics.external_time),
        application_time_change: this.calculatePercentageChange(baselineMetrics.application_time, comparisonMetrics.application_time),
        apdex_change: baselineMetrics.apdex_score && comparisonMetrics.apdex_score ? 
          this.calculatePercentageChange(baselineMetrics.apdex_score, comparisonMetrics.apdex_score) : undefined
      };
      
      const significantChanges = this.identifySignificantChanges(changes);
      
      return {
        transaction_name: transactionName,
        baseline: baselineMetrics,
        comparison: comparisonMetrics,
        changes,
        significant_changes: significantChanges
      };
    } catch (error) {
      this.logger.error('Failed to compare transaction performance', error, { applicationId, transactionName });
      throw new Error(`Failed to compare transaction performance: ${error.message}`);
    }
  }

  // Private helper methods
  private mapTraceResponse(trace: any): TransactionTrace {
    return {
      id: trace.id?.toString() || 'unknown',
      name: trace.name || 'Unknown Transaction',
      duration: trace.duration || 0,
      timestamp: trace.timestamp || new Date().toISOString(),
      url: trace.url,
      statusCode: trace.status_code,
      guid: trace.guid,
      segments: trace.segments ? this.mapSegments(trace.segments) : [],
      attributes: trace.attributes || {},
      userAttributes: trace.user_attributes || {},
      agentAttributes: trace.agent_attributes || {}
    };
  }

  private mapNRQLToTrace(row: any): TransactionTrace {
    return {
      id: row.guid || `${row.timestamp}_${row.name}`,
      name: row.name || 'Unknown Transaction',
      duration: row.duration || 0,
      timestamp: new Date(row.timestamp).toISOString(),
      url: row['request.uri'],
      statusCode: row.httpResponseCode,
      guid: row.guid,
      segments: [], // Would need additional API calls for detailed segments
      attributes: {},
      userAttributes: {},
      agentAttributes: {}
    };
  }

  private mapSegments(segments: any[]): TraceSegment[] {
    return segments.map(segment => ({
      name: segment.name || 'Unknown Segment',
      duration: segment.duration || 0,
      exclusive_duration: segment.exclusive_duration || 0,
      call_count: segment.call_count || 1,
      class_name: segment.class_name,
      method_name: segment.method_name,
      sql: segment.sql,
      uri: segment.uri,
      children: segment.children ? this.mapSegments(segment.children) : [],
      parameters: segment.parameters || {}
    }));
  }

  private async getPerformanceMetrics(applicationId: string, transactionName: string, timeRange: TimeRange): Promise<PerformanceMetrics> {
    const since = `SINCE '${timeRange.since}'`;
    const until = timeRange.until ? `UNTIL '${timeRange.until}'` : '';
    
    const query = `
      SELECT 
        average(duration) as average_duration,
        rate(count(*), 1 minute) as throughput,
        percentage(count(*), WHERE error IS true) as error_rate,
        apdex(duration, t: 0.5) as apdex_score,
        average(databaseDuration) as database_time,
        average(externalDuration) as external_time
      FROM Transaction 
      WHERE appId = ${applicationId} 
      AND name = '${transactionName}'
      ${since} ${until}
    `;
    
    const result = await this.client.executeNRQL(query);
    const row = result.results[0] || {};
    
    const databaseTime = row.database_time || 0;
    const externalTime = row.external_time || 0;
    const totalTime = row.average_duration || 0;
    const applicationTime = totalTime - databaseTime - externalTime;
    
    return {
      average_duration: totalTime,
      throughput: row.throughput || 0,
      error_rate: row.error_rate || 0,
      apdex_score: row.apdex_score,
      database_time: databaseTime,
      external_time: externalTime,
      application_time: applicationTime
    };
  }

  private calculatePercentageChange(baseline: number, comparison: number): number {
    if (baseline === 0) return comparison > 0 ? 100 : 0;
    return ((comparison - baseline) / baseline) * 100;
  }

  private identifySignificantChanges(changes: PerformanceChanges): SignificantChange[] {
    const significantChanges: SignificantChange[] = [];
    
    const metrics = [
      { key: 'duration_change', name: 'Response Time', value: changes.duration_change },
      { key: 'throughput_change', name: 'Throughput', value: changes.throughput_change },
      { key: 'error_rate_change', name: 'Error Rate', value: changes.error_rate_change },
      { key: 'database_time_change', name: 'Database Time', value: changes.database_time_change },
      { key: 'external_time_change', name: 'External Time', value: changes.external_time_change },
      { key: 'application_time_change', name: 'Application Time', value: changes.application_time_change }
    ];
    
    for (const metric of metrics) {
      const absChange = Math.abs(metric.value);
      let significance: 'high' | 'medium' | 'low';
      
      if (absChange >= 50) {
        significance = 'high';
      } else if (absChange >= 20) {
        significance = 'medium';
      } else if (absChange >= 10) {
        significance = 'low';
      } else {
        continue; // Skip insignificant changes
      }
      
      significantChanges.push({
        metric: metric.name,
        change: metric.value,
        significance,
        description: `${metric.name} changed by ${metric.value.toFixed(1)}%`
      });
    }
    
    return significantChanges;
  }

  private generatePerformanceRecommendations(segments: SegmentAnalysis[]): string[] {
    const recommendations: string[] = [];
    
    for (const segment of segments) {
      if (segment.percentage > 50) {
        switch (segment.type) {
          case 'database':
            recommendations.push('Consider optimizing database queries or adding indexes');
            recommendations.push('Review database connection pooling configuration');
            break;
          case 'external':
            recommendations.push('Optimize external service calls or implement caching');
            recommendations.push('Consider using asynchronous calls where possible');
            break;
          case 'application':
            recommendations.push('Profile application code to identify CPU-intensive operations');
            recommendations.push('Consider code optimization or algorithm improvements');
            break;
        }
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Transaction performance appears to be well-balanced');
    }
    
    return recommendations;
  }

  private getBottleneckRecommendations(type: string, percentage: number): string[] {
    const recommendations: string[] = [];
    
    switch (type) {
      case 'database':
        recommendations.push('Optimize slow database queries');
        recommendations.push('Add appropriate database indexes');
        recommendations.push('Consider database connection pooling');
        if (percentage > 50) {
          recommendations.push('Consider database query caching');
        }
        break;
      case 'external':
        recommendations.push('Optimize external service calls');
        recommendations.push('Implement response caching where appropriate');
        recommendations.push('Consider circuit breaker pattern for resilience');
        if (percentage > 50) {
          recommendations.push('Evaluate if external calls can be made asynchronously');
        }
        break;
      case 'application':
        recommendations.push('Profile application code for optimization opportunities');
        recommendations.push('Review algorithms and data structures');
        if (percentage > 50) {
          recommendations.push('Consider code refactoring or performance tuning');
        }
        break;
    }
    
    return recommendations;
  }

  private getTimeRangeKey(timeRange?: TimeRange): string {
    if (!timeRange) {
      return 'default';
    }
    return `${timeRange.since}_${timeRange.until || 'now'}`;
  }
}