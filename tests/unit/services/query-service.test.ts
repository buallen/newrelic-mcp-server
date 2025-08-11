/**
 * Query Service Tests
 * Unit tests for NRQL query processing functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryServiceImpl } from '../../../src/services/query-service';
import { NewRelicClient } from '../../../src/interfaces/newrelic-client';
import { CacheManager, Logger } from '../../../src/interfaces/services';
import { NRQLQuery, NRQLResult, ValidationResult } from '../../../src/types/newrelic';

describe('QueryService', () => {
  let queryService: QueryServiceImpl;
  let mockNewRelicClient: NewRelicClient;
  let mockCacheManager: CacheManager;
  let mockLogger: Logger;

  beforeEach(() => {
    mockNewRelicClient = {
      authenticate: vi.fn(),
      validatePermissions: vi.fn(),
      getAccountAccess: vi.fn(),
      executeNRQL: vi.fn(),
      executeGraphQL: vi.fn(),
      getApplications: vi.fn(),
      getApplication: vi.fn(),
      getAlertPolicies: vi.fn(),
      getAlertPolicy: vi.fn(),
      createAlertPolicy: vi.fn(),
      updateAlertPolicy: vi.fn(),
      deleteAlertPolicy: vi.fn(),
      getAlertConditions: vi.fn(),
      getAlertCondition: vi.fn(),
      createAlertCondition: vi.fn(),
      updateAlertCondition: vi.fn(),
      deleteAlertCondition: vi.fn(),
      getNotificationChannels: vi.fn(),
      getNotificationChannel: vi.fn(),
      createNotificationChannel: vi.fn(),
      updateNotificationChannel: vi.fn(),
      deleteNotificationChannel: vi.fn(),
      getIncidents: vi.fn(),
      getIncident: vi.fn(),
      acknowledgeIncident: vi.fn(),
      closeIncident: vi.fn(),
      validateQuery: vi.fn(),
      getQuerySuggestions: vi.fn(),
      getMetricNames: vi.fn(),
      getEntityTypes: vi.fn(),
      checkConnection: vi.fn(),
      getApiStatus: vi.fn(),
    };

    mockCacheManager = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      exists: vi.fn(),
      ttl: vi.fn(),
      mget: vi.fn(),
      mset: vi.fn(),
      keys: vi.fn(),
      deletePattern: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      logAPICall: vi.fn(),
      logIncidentAnalysis: vi.fn(),
      logQueryExecution: vi.fn(),
    };

    queryService = new QueryServiceImpl(mockNewRelicClient, mockCacheManager, mockLogger);
  });

  describe('executeQuery', () => {
    it('should execute NRQL query successfully', async () => {
      const query: NRQLQuery = {
        query: 'SELECT count(*) FROM Transaction SINCE 1 hour ago',
        accountId: '123456',
      };

      const mockResult: NRQLResult = {
        results: [{ count: 100 }],
        metadata: {
          eventType: 'Transaction',
          eventTypes: ['Transaction'],
          contents: [],
          messages: [],
        },
        performanceStats: {
          inspectedCount: 1000,
          omittedCount: 0,
          matchCount: 1,
          wallClockTime: 150,
        },
      };

      mockNewRelicClient.validateQuery = vi.fn().mockResolvedValue({
        valid: true,
        errors: [],
        suggestions: [],
      });
      mockCacheManager.get = vi.fn().mockResolvedValue(null);
      mockNewRelicClient.executeNRQL = vi.fn().mockResolvedValue(mockResult);
      mockCacheManager.set = vi.fn().mockResolvedValue(undefined);

      const result = await queryService.executeQuery(query);

      expect(result.results).toEqual([{ count: 100 }]);
      expect(result.metadata.eventType).toBe('Transaction');
      expect(mockNewRelicClient.executeNRQL).toHaveBeenCalledWith(query);
      expect(mockCacheManager.set).toHaveBeenCalled();
      expect(mockLogger.logQueryExecution).toHaveBeenCalled();
    });

    it('should return cached result when available', async () => {
      const query: NRQLQuery = {
        query: 'SELECT count(*) FROM Transaction SINCE 1 hour ago',
        accountId: '123456',
      };

      const cachedResult: NRQLResult = {
        results: [{ count: 50 }],
        metadata: {
          eventType: 'Transaction',
          eventTypes: ['Transaction'],
          contents: [],
          messages: [],
        },
        performanceStats: {
          inspectedCount: 500,
          omittedCount: 0,
          matchCount: 1,
          wallClockTime: 75,
        },
      };

      mockNewRelicClient.validateQuery = vi.fn().mockResolvedValue({
        valid: true,
        errors: [],
        suggestions: [],
      });
      mockCacheManager.get = vi.fn().mockResolvedValue(cachedResult);

      const result = await queryService.executeQuery(query);

      expect(result).toEqual(cachedResult);
      expect(mockNewRelicClient.executeNRQL).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Query result found in cache',
        expect.any(Object)
      );
    });

    it('should handle invalid query', async () => {
      const query: NRQLQuery = {
        query: 'INVALID QUERY',
        accountId: '123456',
      };

      mockNewRelicClient.validateQuery = vi.fn().mockResolvedValue({
        valid: false,
        errors: [
          {
            line: 1,
            column: 1,
            message: 'Invalid syntax',
            severity: 'error',
          },
        ],
        suggestions: [],
      });

      await expect(queryService.executeQuery(query)).rejects.toThrow(
        'Invalid NRQL query:'
      );

      expect(mockNewRelicClient.executeNRQL).not.toHaveBeenCalled();
    });

    it('should handle query execution errors', async () => {
      const query: NRQLQuery = {
        query: 'SELECT count(*) FROM Transaction SINCE 1 hour ago',
        accountId: '123456',
      };

      mockNewRelicClient.validateQuery = vi.fn().mockResolvedValue({
        valid: true,
        errors: [],
        suggestions: [],
      });
      mockCacheManager.get = vi.fn().mockResolvedValue(null);
      mockNewRelicClient.executeNRQL = vi.fn().mockRejectedValue(
        new Error('Network error')
      );

      await expect(queryService.executeQuery(query)).rejects.toThrow('Network error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'NRQL query execution failed',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('validateQuery', () => {
    it('should validate query successfully', async () => {
      const query = 'SELECT count(*) FROM Transaction SINCE 1 hour ago';

      mockNewRelicClient.validateQuery = vi.fn().mockResolvedValue({
        valid: true,
        errors: [],
        suggestions: [],
      });

      const result = await queryService.validateQuery(query);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockNewRelicClient.validateQuery).toHaveBeenCalledWith(query);
    });

    it('should detect syntax errors', async () => {
      const query = 'SELECT count(*) FORM Transaction'; // Typo: FORM instead of FROM

      const result = await queryService.validateQuery(query);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.suggestions).toBeInstanceOf(Array);
    });

    it('should handle validation errors', async () => {
      const query = 'SELECT count(*) FROM Transaction';

      mockNewRelicClient.validateQuery = vi.fn().mockRejectedValue(
        new Error('Validation service unavailable')
      );

      const result = await queryService.validateQuery(query);

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe('Validation service unavailable');
    });
  });

  describe('getQuerySuggestions', () => {
    it('should get query suggestions', async () => {
      const partialQuery = 'SELECT count(*) FROM';

      const apiSuggestions = ['SELECT count(*) FROM PageView'];

      mockNewRelicClient.getQuerySuggestions = vi.fn().mockResolvedValue(apiSuggestions);

      const result = await queryService.getQuerySuggestions(partialQuery);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('SELECT count(*) FROM PageView');
      expect(mockNewRelicClient.getQuerySuggestions).toHaveBeenCalledWith(partialQuery);
    });

    it('should handle suggestion errors gracefully', async () => {
      const partialQuery = 'SELECT';

      mockNewRelicClient.getQuerySuggestions = vi.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      const result = await queryService.getQuerySuggestions(partialQuery);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get query suggestions',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('getMetricNames', () => {
    it('should get metric names from API and cache', async () => {
      const entityType = 'Transaction';
      const apiMetrics = ['duration', 'throughput'];

      mockCacheManager.get = vi.fn().mockResolvedValue(null);
      mockNewRelicClient.getMetricNames = vi.fn().mockResolvedValue(apiMetrics);
      mockCacheManager.set = vi.fn().mockResolvedValue(undefined);

      const result = await queryService.getMetricNames(entityType);

      expect(result).toContain('duration');
      expect(result).toContain('throughput');
      expect(mockNewRelicClient.getMetricNames).toHaveBeenCalledWith(entityType);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should return cached metric names', async () => {
      const entityType = 'Transaction';
      const cachedMetrics = ['cached_duration', 'cached_throughput'];

      mockCacheManager.get = vi.fn().mockResolvedValue(cachedMetrics);

      const result = await queryService.getMetricNames(entityType);

      expect(result).toEqual(cachedMetrics);
      expect(mockNewRelicClient.getMetricNames).not.toHaveBeenCalled();
    });

    it('should fallback to query builder metrics on error', async () => {
      const entityType = 'Transaction';

      mockCacheManager.get = vi.fn().mockResolvedValue(null);
      mockNewRelicClient.getMetricNames = vi.fn().mockRejectedValue(
        new Error('API error')
      );

      const result = await queryService.getMetricNames(entityType);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get metric names',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('getEntityTypes', () => {
    it('should get entity types from API and cache', async () => {
      const entityTypes = [
        { name: 'Application', domain: 'APM', type: 'APPLICATION' },
        { name: 'Host', domain: 'INFRA', type: 'HOST' },
      ];

      mockCacheManager.get = vi.fn().mockResolvedValue(null);
      mockNewRelicClient.getEntityTypes = vi.fn().mockResolvedValue(entityTypes);
      mockCacheManager.set = vi.fn().mockResolvedValue(undefined);

      const result = await queryService.getEntityTypes();

      expect(result).toEqual(entityTypes);
      expect(mockNewRelicClient.getEntityTypes).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should return cached entity types', async () => {
      const cachedTypes = [
        { name: 'Cached App', domain: 'APM', type: 'APPLICATION' },
      ];

      mockCacheManager.get = vi.fn().mockResolvedValue(cachedTypes);

      const result = await queryService.getEntityTypes();

      expect(result).toEqual(cachedTypes);
      expect(mockNewRelicClient.getEntityTypes).not.toHaveBeenCalled();
    });
  });

  describe('buildQuery', () => {
    it('should build NRQL query from parameters', () => {
      const params = {
        select: ['count(*)', 'average(duration)'],
        from: 'Transaction',
        where: { appName: 'MyApp' },
        groupBy: ['name'],
        orderBy: 'count DESC',
        limit: 100,
        since: '1 hour ago',
      };

      const result = queryService.buildQuery(params);

      expect(result).toContain('SELECT count(*), average(duration)');
      expect(result).toContain('FROM Transaction');
      expect(result).toContain("WHERE appName = 'MyApp'");
      expect(result).toContain('FACET name');
      expect(result).toContain('ORDER BY count DESC');
      expect(result).toContain('LIMIT 100');
      expect(result).toContain('SINCE 1 hour ago');
    });

    it('should handle build errors', () => {
      const invalidParams = {
        select: [],
        from: '', // Invalid empty from
      };

      // The query builder should handle empty from gracefully
      const result = queryService.buildQuery(invalidParams);
      expect(result).toContain('FROM '); // Should still contain FROM clause
    });
  });

  describe('query optimization', () => {
    it('should optimize query by adding LIMIT', async () => {
      const query = 'SELECT * FROM Transaction WHERE appName = "MyApp"';
      
      const result = await queryService.optimizeQuery(query);

      expect(result).toContain('LIMIT 100');
    });

    it('should optimize query by adding time range', async () => {
      const query = 'SELECT count(*) FROM Transaction';
      
      const result = await queryService.optimizeQuery(query);

      expect(result).toContain('SINCE 1 hour ago');
    });

    it('should not modify already optimized queries', async () => {
      const query = 'SELECT count(*) FROM Transaction SINCE 1 hour ago LIMIT 50';
      
      const result = await queryService.optimizeQuery(query);

      expect(result).toBe(query);
    });
  });

  describe('query analysis', () => {
    it('should analyze query complexity', async () => {
      const simpleQuery = 'SELECT count(*) FROM Transaction SINCE 1 hour ago';
      
      const analysis = await queryService.analyzeQuery(simpleQuery);

      expect(analysis).toHaveProperty('syntax');
      expect(analysis).toHaveProperty('complexity');
      expect(analysis).toHaveProperty('estimatedCost');
      expect(analysis).toHaveProperty('suggestions');
      expect(analysis).toHaveProperty('eventTypes');
      expect(analysis).toHaveProperty('attributes');
      expect(analysis).toHaveProperty('timeRange');
      expect(analysis.complexity).toBe('low');
    });

    it('should detect complex queries', async () => {
      const complexQuery = `
        SELECT count(*) 
        FROM Transaction 
        JOIN PageView ON Transaction.sessionId = PageView.sessionId
        FACET appName, name 
        TIMESERIES 1 minute 
        COMPARE WITH 1 week ago
      `;
      
      const analysis = await queryService.analyzeQuery(complexQuery);

      expect(analysis.complexity).toBe('high');
      expect(analysis.hasAggregation).toBe(true);
      expect(analysis.isTimeSeries).toBe(true);
      expect(analysis.isFaceted).toBe(true);
    });

    it('should estimate query cost', async () => {
      const expensiveQuery = 'SELECT * FROM Transaction'; // No time limit, no LIMIT
      
      const analysis = await queryService.analyzeQuery(expensiveQuery);

      expect(analysis.estimatedCost).toBe('high');
      expect(analysis.suggestions).toContain('Add LIMIT clause to reduce data transfer');
      expect(analysis.suggestions).toContain('Add SINCE clause to limit time range');
    });
  });
});