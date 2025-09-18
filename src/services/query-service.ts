/**
 * Query Service
 * Handles NRQL query processing and execution
 */

import { 
  NRQLQuery, 
  NRQLResult, 
  ValidationResult, 
  EntityType 
} from '../types/newrelic';
import { QueryService, QueryBuilderParams } from '../interfaces/services';
import { NewRelicClient } from '../interfaces/newrelic-client';
import { CacheManager, Logger } from '../interfaces/services';
import { QueryBuilder } from '../client/query-builder';
import { ResponseParser } from '../client/response-parser';

export class QueryServiceImpl implements QueryService {
  private queryBuilder: QueryBuilder;
  private responseParser: ResponseParser;

  constructor(
    private newRelicClient: NewRelicClient,
    private cacheManager: CacheManager,
    private logger: Logger
  ) {
    this.queryBuilder = new QueryBuilder(logger);
    this.responseParser = new ResponseParser(logger);
  }

  async executeQuery(query: NRQLQuery): Promise<NRQLResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Executing NRQL query', { 
        query: query.query.substring(0, 100) + '...',
        accountId: query.accountId 
      });

      // Validate query first
      const validation = await this.validateQuery(query.query);
      if (!validation.valid) {
        const errorMessages = validation.errors.map(error => 
          typeof error === 'string' ? error : error.message
        );
        throw new Error(`Invalid NRQL query: ${errorMessages.join(', ')}`);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(query);
      const cachedResult = await this.cacheManager.get<NRQLResult>(cacheKey);
      
      if (cachedResult) {
        this.logger.debug('Query result found in cache', { cacheKey });
        const duration = Date.now() - startTime;
        this.logger.logQueryExecution(query.query, cachedResult.results.length, duration);
        return cachedResult;
      }

      // Execute query
      const result = await this.newRelicClient.executeNRQL(query);
      
      // Process and format results
      const processedResult = this.processQueryResult(result, query);
      
      // Cache the result
      await this.cacheManager.set(cacheKey, processedResult, 300); // 5 minutes TTL
      
      const duration = Date.now() - startTime;
      this.logger.info('NRQL query executed successfully', {
        resultCount: processedResult.results.length,
        duration,
        cached: false,
      });
      
      this.logger.logQueryExecution(query.query, processedResult.results.length, duration);
      
      return processedResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('NRQL query execution failed', error as Error, {
        query: query.query,
        duration,
      });
      throw error;
    }
  }

  async validateQuery(query: string): Promise<ValidationResult> {
    try {
      this.logger.debug('Validating NRQL query', { query: query.substring(0, 100) + '...' });

      // First, perform client-side syntax validation
      const syntaxValidation = this.queryBuilder.validateNRQLSyntax(query);
      if (!syntaxValidation.valid) {
        return {
          valid: false,
          errors: syntaxValidation.errors.map(error => ({
            line: 1,
            column: 1,
            message: error,
            severity: 'error' as const,
          })),
          suggestions: this.queryBuilder.getQuerySuggestions(query),
        };
      }

      // Then, validate with NewRelic API
      const apiValidation = await this.newRelicClient.validateQuery(query);
      
      this.logger.debug('Query validation completed', { 
        valid: apiValidation.valid,
        errorCount: apiValidation.errors.length 
      });
      
      return apiValidation;
    } catch (error) {
      this.logger.error('Query validation failed', error as Error, { query });
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
    try {
      this.logger.debug('Getting query suggestions', { partialQuery });

      // Get suggestions from query builder
      const builderSuggestions = this.queryBuilder.getQuerySuggestions(partialQuery);
      
      // Get suggestions from NewRelic API
      const apiSuggestions = await this.newRelicClient.getQuerySuggestions(partialQuery);
      
      // Combine and deduplicate suggestions
      const allSuggestions = [...builderSuggestions, ...apiSuggestions];
      const uniqueSuggestions = Array.from(new Set(allSuggestions));
      
      this.logger.debug('Query suggestions generated', { 
        count: uniqueSuggestions.length 
      });
      
      return uniqueSuggestions;
    } catch (error) {
      this.logger.error('Failed to get query suggestions', error as Error, { partialQuery });
      return this.queryBuilder.getQuerySuggestions(partialQuery);
    }
  }

  async getMetricNames(entityType?: string): Promise<string[]> {
    try {
      this.logger.debug('Getting metric names', { entityType });

      // Check cache first
      const cacheKey = `metrics:${entityType || 'all'}`;
      const cachedMetrics = await this.cacheManager.get<string[]>(cacheKey);
      
      if (cachedMetrics) {
        this.logger.debug('Metric names found in cache', { count: cachedMetrics.length });
        return cachedMetrics;
      }

      // Get metrics from NewRelic API
      const apiMetrics = await this.newRelicClient.getMetricNames(entityType);
      
      // Get common attributes from query builder
      const commonAttributes = entityType ? 
        this.queryBuilder.getCommonAttributes(entityType) : 
        this.queryBuilder.getCommonEventTypes().flatMap(type => 
          this.queryBuilder.getCommonAttributes(type)
        );
      
      // Combine and deduplicate
      const allMetrics = [...apiMetrics, ...commonAttributes];
      const uniqueMetrics = Array.from(new Set(allMetrics)).sort();
      
      // Cache the result
      await this.cacheManager.set(cacheKey, uniqueMetrics, 3600); // 1 hour TTL
      
      this.logger.debug('Metric names retrieved', { count: uniqueMetrics.length });
      
      return uniqueMetrics;
    } catch (error) {
      this.logger.error('Failed to get metric names', error as Error, { entityType });
      
      // Fallback to query builder metrics
      return entityType ? 
        this.queryBuilder.getCommonAttributes(entityType) : 
        this.queryBuilder.getCommonEventTypes().flatMap(type => 
          this.queryBuilder.getCommonAttributes(type)
        );
    }
  }

  async getEntityTypes(): Promise<EntityType[]> {
    try {
      this.logger.debug('Getting entity types');

      // Check cache first
      const cacheKey = 'entity-types';
      const cachedTypes = await this.cacheManager.get<EntityType[]>(cacheKey);
      
      if (cachedTypes) {
        this.logger.debug('Entity types found in cache', { count: cachedTypes.length });
        return cachedTypes;
      }

      // Get entity types from NewRelic API
      const entityTypes = await this.newRelicClient.getEntityTypes();
      
      // Cache the result
      await this.cacheManager.set(cacheKey, entityTypes, 3600); // 1 hour TTL
      
      this.logger.debug('Entity types retrieved', { count: entityTypes.length });
      
      return entityTypes;
    } catch (error) {
      this.logger.error('Failed to get entity types', error as Error);
      
      // Fallback to default entity types
      return [
        { name: 'Application', domain: 'APM', type: 'APPLICATION' },
        { name: 'Host', domain: 'INFRA', type: 'HOST' },
        { name: 'Browser Application', domain: 'BROWSER', type: 'BROWSER_APPLICATION' },
        { name: 'Mobile Application', domain: 'MOBILE', type: 'MOBILE_APPLICATION' },
      ];
    }
  }

  buildQuery(params: QueryBuilderParams): string {
    try {
      this.logger.debug('Building NRQL query', { params });

      const query = this.queryBuilder.buildNRQL({
        select: params.select,
        from: params.from,
        where: params.where,
        facet: params.groupBy,
        orderBy: params.orderBy,
        limit: params.limit,
        since: params.since,
        until: params.until,
      });

      this.logger.debug('NRQL query built', { query });
      
      return query;
    } catch (error) {
      this.logger.error('Failed to build query', error as Error, { params });
      throw error;
    }
  }

  // Helper methods

  private generateCacheKey(query: NRQLQuery): string {
    const keyData = {
      query: query.query,
      accountId: query.accountId,
      timeout: query.timeout,
      limit: query.limit,
    };
    
    return `nrql:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  private processQueryResult(result: NRQLResult, originalQuery: NRQLQuery): NRQLResult {
    try {
      // Add query metadata
      const processedResult = {
        ...result,
        query: originalQuery.query,
        accountId: originalQuery.accountId,
        executedAt: new Date().toISOString(),
      };

      // Process results based on query type
      if (this.isTimeSeriesQuery(originalQuery.query)) {
        (processedResult as any).timeSeries = this.responseParser.parseTimeSeriesData(result.results);
      }

      if (this.isFacetedQuery(originalQuery.query)) {
        (processedResult as any).facetedData = this.responseParser.parseFacetedData(result.results);
      }

      // Add result summary
      (processedResult as any).summary = {
        totalResults: result.results.length,
        hasMoreResults: result.results.length === (originalQuery.limit || 100),
        executionTime: result.performanceStats?.wallClockTime || 0,
        dataScanned: result.performanceStats?.inspectedCount || 0,
      };

      return processedResult;
    } catch (error) {
      this.logger.error('Failed to process query result', error as Error);
      return result;
    }
  }

  private isTimeSeriesQuery(query: string): boolean {
    return query.toUpperCase().includes('TIMESERIES');
  }

  private isFacetedQuery(query: string): boolean {
    return query.toUpperCase().includes('FACET');
  }

  // Query optimization methods

  async optimizeQuery(query: string): Promise<string> {
    try {
      this.logger.debug('Optimizing NRQL query', { query: query.substring(0, 100) + '...' });

      let optimizedQuery = query;

      // Add LIMIT if not present and query doesn't have aggregation
      if (!query.toUpperCase().includes('LIMIT') && 
          !this.hasAggregation(query) && 
          !query.toUpperCase().includes('COUNT(')) {
        optimizedQuery += ' LIMIT 100';
      }

      // Suggest more specific time ranges for better performance
      if (!query.toUpperCase().includes('SINCE') && 
          !query.toUpperCase().includes('UNTIL')) {
        optimizedQuery += ' SINCE 1 hour ago';
      }

      // Add index hints for common patterns
      if (query.toUpperCase().includes('WHERE APPNAME')) {
        // AppName is typically indexed, this is already optimal
      }

      this.logger.debug('Query optimization completed', { 
        original: query.length,
        optimized: optimizedQuery.length 
      });

      return optimizedQuery;
    } catch (error) {
      this.logger.error('Query optimization failed', error as Error, { query });
      return query;
    }
  }

  private hasAggregation(query: string): boolean {
    const aggregationFunctions = [
      'COUNT', 'SUM', 'AVERAGE', 'MIN', 'MAX', 
      'PERCENTAGE', 'APDEX', 'RATE', 'STDDEV'
    ];
    
    const upperQuery = query.toUpperCase();
    return aggregationFunctions.some(func => upperQuery.includes(func + '('));
  }

  // Query analysis methods

  async analyzeQuery(query: string): Promise<any> {
    try {
      this.logger.debug('Analyzing NRQL query', { query: query.substring(0, 100) + '...' });

      const analysis = {
        syntax: this.queryBuilder.validateNRQLSyntax(query),
        complexity: this.calculateQueryComplexity(query),
        estimatedCost: this.estimateQueryCost(query),
        suggestions: await this.getOptimizationSuggestions(query),
        eventTypes: this.extractEventTypes(query),
        attributes: this.extractAttributes(query),
        timeRange: this.extractTimeRange(query),
        hasAggregation: this.hasAggregation(query),
        isTimeSeries: this.isTimeSeriesQuery(query),
        isFaceted: this.isFacetedQuery(query),
      };

      this.logger.debug('Query analysis completed', { 
        complexity: analysis.complexity,
        estimatedCost: analysis.estimatedCost 
      });

      return analysis;
    } catch (error) {
      this.logger.error('Query analysis failed', error as Error, { query });
      throw error;
    }
  }

  private calculateQueryComplexity(query: string): 'low' | 'medium' | 'high' {
    let complexity = 0;
    const upperQuery = query.toUpperCase();

    // Base complexity
    complexity += 1;

    // Add complexity for various features
    if (upperQuery.includes('JOIN')) complexity += 3;
    if (upperQuery.includes('FACET')) complexity += 2;
    if (upperQuery.includes('TIMESERIES')) complexity += 2;
    if (upperQuery.includes('COMPARE WITH')) complexity += 2;
    if (upperQuery.includes('WHERE')) complexity += 1;
    if (upperQuery.includes('ORDER BY')) complexity += 1;

    // Count aggregation functions
    const aggregations = (upperQuery.match(/\b(COUNT|SUM|AVERAGE|MIN|MAX|PERCENTAGE|APDEX|RATE)\s*\(/g) || []).length;
    complexity += aggregations;

    if (complexity <= 3) return 'low';
    if (complexity <= 6) return 'medium';
    return 'high';
  }

  private estimateQueryCost(query: string): 'low' | 'medium' | 'high' {
    const upperQuery = query.toUpperCase();
    let cost = 0;

    // Time range impact
    if (upperQuery.includes('SINCE 1 HOUR AGO') || upperQuery.includes('SINCE 60 MINUTES AGO')) {
      cost += 1;
    } else if (upperQuery.includes('SINCE 1 DAY AGO') || upperQuery.includes('SINCE 24 HOURS AGO')) {
      cost += 2;
    } else if (upperQuery.includes('SINCE 1 WEEK AGO') || upperQuery.includes('SINCE 7 DAYS AGO')) {
      cost += 3;
    } else if (!upperQuery.includes('SINCE')) {
      cost += 4; // No time limit is expensive
    }

    // LIMIT impact
    if (upperQuery.includes('LIMIT')) {
      const limitMatch = upperQuery.match(/LIMIT\s+(\d+)/);
      if (limitMatch) {
        const limit = parseInt(limitMatch[1], 10);
        if (limit > 1000) cost += 2;
        else if (limit > 100) cost += 1;
      }
    } else {
      cost += 2; // No limit is expensive
    }

    // Complex operations
    if (upperQuery.includes('FACET')) cost += 1;
    if (upperQuery.includes('TIMESERIES')) cost += 1;
    if (upperQuery.includes('JOIN')) cost += 3;

    if (cost <= 2) return 'low';
    if (cost <= 5) return 'medium';
    return 'high';
  }

  private async getOptimizationSuggestions(query: string): Promise<string[]> {
    const suggestions: string[] = [];
    const upperQuery = query.toUpperCase();

    if (!upperQuery.includes('LIMIT')) {
      suggestions.push('Add LIMIT clause to reduce data transfer');
    }

    if (!upperQuery.includes('SINCE')) {
      suggestions.push('Add SINCE clause to limit time range');
    }

    if (upperQuery.includes('SELECT *')) {
      suggestions.push('Select specific attributes instead of using SELECT *');
    }

    if (upperQuery.includes('WHERE') && !upperQuery.includes('APPNAME')) {
      suggestions.push('Consider filtering by appName for better performance');
    }

    return suggestions;
  }

  private extractEventTypes(query: string): string[] {
    const fromMatch = query.match(/FROM\s+(\w+)/gi);
    return fromMatch ? fromMatch.map(match => match.split(/\s+/)[1]) : [];
  }

  private extractAttributes(query: string): string[] {
    const attributes: string[] = [];
    
    // Extract from SELECT clause
    const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
    if (selectMatch) {
      const selectClause = selectMatch[1];
      if (selectClause !== '*') {
        const attrs = selectClause.split(',').map(attr => attr.trim().split(/\s+/)[0]);
        attributes.push(...attrs);
      }
    }

    // Extract from WHERE clause
    const whereMatches = query.match(/WHERE\s+(.+?)(?:\s+(?:FACET|TIMESERIES|ORDER|LIMIT|SINCE|UNTIL)|$)/i);
    if (whereMatches) {
      const whereClause = whereMatches[1];
      const attrMatches = whereClause.match(/\b\w+\b(?=\s*[=<>!])/g);
      if (attrMatches) {
        attributes.push(...attrMatches);
      }
    }

    return Array.from(new Set(attributes));
  }

  private extractTimeRange(query: string): { since?: string; until?: string } {
    const timeRange: { since?: string; until?: string } = {};
    
    const sinceMatch = query.match(/SINCE\s+(.+?)(?:\s+(?:UNTIL|COMPARE|$))/i);
    if (sinceMatch) {
      timeRange.since = sinceMatch[1].trim();
    }

    const untilMatch = query.match(/UNTIL\s+(.+?)(?:\s+(?:COMPARE|$))/i);
    if (untilMatch) {
      timeRange.until = untilMatch[1].trim();
    }

    return timeRange;
  }
}