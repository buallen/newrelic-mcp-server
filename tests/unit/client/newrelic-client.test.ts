/**
 * NewRelic Client Tests
 * Unit tests for NewRelic API client functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios from 'axios';
import { NewRelicClientImpl } from '../../../src/client/newrelic-client';
import { NewRelicClientConfig } from '../../../src/interfaces/newrelic-client';
import { Logger } from '../../../src/interfaces/services';
import { AlertPolicyInput, AlertConditionInput } from '../../../src/types/newrelic';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('NewRelicClient', () => {
  let client: NewRelicClientImpl;
  let mockLogger: Logger;
  let config: NewRelicClientConfig;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      logAPICall: vi.fn(),
      logIncidentAnalysis: vi.fn(),
      logQueryExecution: vi.fn(),
    };

    config = {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.newrelic.com',
      graphqlUrl: 'https://api.newrelic.com/graphql',
      defaultAccountId: '123456',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      rateLimitPerMinute: 60,
    };

    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
      defaults: {
        headers: {},
      },
      interceptors: {
        request: {
          use: vi.fn(),
        },
        response: {
          use: vi.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    client = new NewRelicClientImpl(config, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create HTTP client with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: config.baseUrl,
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': config.apiKey,
        },
      });
    });

    it('should set up request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('authentication', () => {
    it('should authenticate successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { applications: [] },
      });

      const result = await client.authenticate('new-api-key');

      expect(result).toBe(true);
      expect(mockAxiosInstance.defaults.headers['Api-Key']).toBe('new-api-key');
      expect(mockLogger.info).toHaveBeenCalledWith('Authentication successful');
    });

    it('should handle authentication failure', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Unauthorized'));

      const result = await client.authenticate('invalid-key');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Authentication failed',
        expect.any(Error)
      );
    });

    it('should validate permissions', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { applications: [] } }) // read test
        .mockResolvedValueOnce({ data: { policies: [] } }); // write test

      const permissions = await client.validatePermissions();

      expect(permissions).toEqual(['read', 'write']);
    });

    it('should get account access', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          applications: [
            { account_id: 123456 },
            { account_id: 789012 },
            { account_id: 123456 }, // duplicate
          ],
        },
      });

      const accounts = await client.getAccountAccess('test-key');

      expect(accounts).toEqual(['123456', '789012']);
    });
  });

  describe('NRQL queries', () => {
    it('should execute NRQL query successfully', async () => {
      const mockGraphQLResponse = {
        data: {
          actor: {
            account: {
              nrql: {
                results: [{ count: 100 }],
                metadata: {
                  eventType: 'Transaction',
                  eventTypes: ['Transaction'],
                  messages: [],
                },
                totalResult: { count: 100 },
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: mockGraphQLResponse,
      });

      const result = await client.executeNRQL({
        query: 'SELECT count(*) FROM Transaction',
        accountId: '123456',
      });

      expect(result.results).toEqual([{ count: 100 }]);
      expect(result.metadata.eventType).toBe('Transaction');
      expect(result.performanceStats.matchCount).toBe(1);
    });

    it('should handle NRQL query errors', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          errors: [{ message: 'Invalid query syntax' }],
        },
      });

      await expect(
        client.executeNRQL({ query: 'INVALID QUERY' })
      ).rejects.toThrow('NRQL query failed: Invalid query syntax');
    });

    it('should validate query successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          data: {
            actor: {
              account: {
                nrql: {
                  results: [],
                  metadata: {},
                  totalResult: { count: 0 },
                },
              },
            },
          },
        },
      });

      const result = await client.validateQuery('SELECT * FROM Transaction');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle query validation errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Syntax error'));

      const result = await client.validateQuery('INVALID QUERY');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Syntax error');
    });
  });

  describe('applications', () => {
    it('should fetch applications', async () => {
      const mockApplications = [
        { id: '1', name: 'App 1' },
        { id: '2', name: 'App 2' },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { applications: mockApplications },
      });

      const result = await client.getApplications();

      expect(result).toEqual(mockApplications);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/applications.json');
    });

    it('should fetch single application', async () => {
      const mockApplication = { id: '1', name: 'App 1' };

      mockAxiosInstance.get.mockResolvedValue({
        data: { application: mockApplication },
      });

      const result = await client.getApplication('1');

      expect(result).toEqual(mockApplication);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/applications/1.json');
    });
  });

  describe('alert policies', () => {
    it('should fetch alert policies', async () => {
      const mockPolicies = [
        { id: '1', name: 'Policy 1' },
        { id: '2', name: 'Policy 2' },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { policies: mockPolicies },
      });

      const result = await client.getAlertPolicies();

      expect(result).toEqual(mockPolicies);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/alert_policies.json', {
        params: {},
      });
    });

    it('should create alert policy', async () => {
      const policyInput: AlertPolicyInput = {
        name: 'Test Policy',
        incident_preference: 'PER_CONDITION',
      };

      const mockCreatedPolicy = { id: '1', ...policyInput };

      mockAxiosInstance.post.mockResolvedValue({
        data: { policy: mockCreatedPolicy },
      });

      const result = await client.createAlertPolicy(policyInput);

      expect(result).toEqual(mockCreatedPolicy);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v2/alert_policies.json', {
        policy: policyInput,
      });
    });

    it('should update alert policy', async () => {
      const updates = { name: 'Updated Policy' };
      const mockUpdatedPolicy = { id: '1', ...updates };

      mockAxiosInstance.put.mockResolvedValue({
        data: { policy: mockUpdatedPolicy },
      });

      const result = await client.updateAlertPolicy('1', updates);

      expect(result).toEqual(mockUpdatedPolicy);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/v2/alert_policies/1.json', {
        policy: updates,
      });
    });

    it('should delete alert policy', async () => {
      mockAxiosInstance.delete.mockResolvedValue({});

      const result = await client.deleteAlertPolicy('1');

      expect(result).toBe(true);
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/v2/alert_policies/1.json');
    });
  });

  describe('alert conditions', () => {
    it('should fetch alert conditions', async () => {
      const mockConditions = [
        { id: '1', name: 'Condition 1' },
        { id: '2', name: 'Condition 2' },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { conditions: mockConditions },
      });

      const result = await client.getAlertConditions('policy-1');

      expect(result).toEqual(mockConditions);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/alert_conditions.json', {
        params: { policy_id: 'policy-1' },
      });
    });

    it('should create alert condition', async () => {
      const conditionInput: AlertConditionInput = {
        type: 'apm_app_metric',
        name: 'Test Condition',
        enabled: true,
        entities: ['app-1'],
        metric: 'response_time_web',
        condition_scope: 'application',
        terms: [{
          duration: '5',
          operator: 'above',
          priority: 'critical',
          threshold: '1.0',
          time_function: 'all',
        }],
      };

      const mockCreatedCondition = { id: '1', ...conditionInput };

      mockAxiosInstance.post.mockResolvedValue({
        data: { condition: mockCreatedCondition },
      });

      const result = await client.createAlertCondition('policy-1', conditionInput);

      expect(result).toEqual(mockCreatedCondition);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v2/alert_conditions.json', {
        condition: {
          ...conditionInput,
          policy_id: 'policy-1',
        },
      });
    });
  });

  describe('incidents', () => {
    it('should fetch incidents', async () => {
      const mockIncidents = [
        { id: '1', state: 'open' },
        { id: '2', state: 'closed' },
      ];

      mockAxiosInstance.get.mockResolvedValue({
        data: { incidents: mockIncidents },
      });

      const result = await client.getIncidents();

      expect(result).toEqual(mockIncidents);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v2/alert_incidents.json', {
        params: {},
      });
    });

    it('should acknowledge incident', async () => {
      mockAxiosInstance.put.mockResolvedValue({});

      const result = await client.acknowledgeIncident('1');

      expect(result).toBe(true);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/v2/alert_incidents/1.json', {
        incident: { state: 'acknowledged' },
      });
    });

    it('should close incident', async () => {
      mockAxiosInstance.put.mockResolvedValue({});

      const result = await client.closeIncident('1');

      expect(result).toBe(true);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/v2/alert_incidents/1.json', {
        incident: { state: 'closed' },
      });
    });
  });

  describe('health and status', () => {
    it('should check connection successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { applications: [] },
      });

      const result = await client.checkConnection();

      expect(result).toBe(true);
    });

    it('should handle connection failure', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await client.checkConnection();

      expect(result).toBe(false);
    });

    it('should get API status', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { applications: [] },
      });

      const status = await client.getApiStatus();

      expect(status.connected).toBe(true);
      expect(status.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling and retries', () => {
    it('should handle rate limiting', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
        },
        config: { __retryCount: 0 },
      };

      mockAxiosInstance.get.mockRejectedValue(rateLimitError);

      await expect(client.getApplications()).rejects.toMatchObject({
        response: { status: 429 },
      });

      // The rate limit warning is logged in the response interceptor
      // which is set up during client initialization, but not directly testable
      // in this unit test setup. We'll verify the error is properly rejected.
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle server errors', async () => {
      const serverError = {
        response: { status: 500 },
        message: 'Internal Server Error',
      };

      mockAxiosInstance.get.mockRejectedValue(serverError);

      await expect(client.getApplications()).rejects.toMatchObject({
        response: { status: 500 },
      });
    });
  });
});