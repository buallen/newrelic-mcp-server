/**
 * GraphQL Client Tests
 * Unit tests for GraphQL client functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios from 'axios';
import { GraphQLClient, GraphQLClientConfig } from '../../../src/client/graphql-client';
import { Logger } from '../../../src/interfaces/services';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('GraphQLClient', () => {
  let client: GraphQLClient;
  let mockLogger: Logger;
  let config: GraphQLClientConfig;
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
      endpoint: 'https://api.newrelic.com/graphql',
      apiKey: 'test-api-key',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    };

    mockAxiosInstance = {
      post: vi.fn(),
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

    client = new GraphQLClient(config, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create HTTP client with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: config.endpoint,
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'API-Key': config.apiKey,
        },
      });
    });

    it('should set up request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('executeQuery', () => {
    it('should execute GraphQL query successfully', async () => {
      const mockResponse = {
        data: {
          data: {
            actor: {
              user: {
                id: '123',
                name: 'Test User',
                email: 'test@example.com',
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const query = `
        query {
          actor {
            user {
              id
              name
              email
            }
          }
        }
      `;

      const result = await client.executeQuery(query);

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('', {
        query,
        variables: undefined,
      });
    });

    it('should execute GraphQL query with variables', async () => {
      const mockResponse = {
        data: {
          data: {
            actor: {
              account: {
                id: 123456,
                name: 'Test Account',
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const query = `
        query($accountId: Int!) {
          actor {
            account(id: $accountId) {
              id
              name
            }
          }
        }
      `;

      const variables = { accountId: 123456 };

      const result = await client.executeQuery(query, variables);

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('', {
        query,
        variables,
      });
    });

    it('should handle GraphQL query errors', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValue(error);

      const query = 'query { invalid }';

      await expect(client.executeQuery(query)).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalledWith('GraphQL query execution failed', error);
    });
  });

  describe('executeNRQL', () => {
    it('should execute NRQL query successfully', async () => {
      const mockResponse = {
        data: {
          data: {
            actor: {
              account: {
                nrql: {
                  results: [{ count: 100 }],
                  metadata: {
                    eventType: 'Transaction',
                    eventTypes: ['Transaction'],
                    facets: ['appName'],
                    messages: [],
                  },
                  totalResult: { count: 100 },
                  performanceStats: {
                    inspectedCount: 1000,
                    omittedCount: 0,
                    matchCount: 100,
                    wallClockTime: 150,
                  },
                },
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const query = {
        query: 'SELECT count(*) FROM Transaction',
        accountId: '123456',
        timeout: 30000,
      };

      const result = await client.executeNRQL(query);

      expect(result.results).toEqual([{ count: 100 }]);
      expect(result.metadata.eventType).toBe('Transaction');
      expect(result.performanceStats.wallClockTime).toBe(150);
    });

    it('should handle NRQL query errors', async () => {
      const mockResponse = {
        data: {
          errors: [{ message: 'Invalid NRQL syntax' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const query = {
        query: 'INVALID NRQL',
        accountId: '123456',
      };

      await expect(client.executeNRQL(query)).rejects.toThrow('NRQL query failed: Invalid NRQL syntax');
    });
  });

  describe('getEntities', () => {
    it('should fetch entities by GUIDs', async () => {
      const mockResponse = {
        data: {
          data: {
            actor: {
              entities: [
                {
                  guid: 'entity-1',
                  name: 'App 1',
                  type: 'APPLICATION',
                  domain: 'APM',
                  entityType: 'APM_APPLICATION_ENTITY',
                  applicationId: 123,
                  language: 'Java',
                },
                {
                  guid: 'entity-2',
                  name: 'Host 1',
                  type: 'HOST',
                  domain: 'INFRA',
                  entityType: 'INFRASTRUCTURE_HOST_ENTITY',
                  hostId: 456,
                  operatingSystem: 'Linux',
                },
              ],
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const entityGuids = ['entity-1', 'entity-2'];
      const result = await client.getEntities(entityGuids);

      expect(result).toHaveLength(2);
      expect(result[0].guid).toBe('entity-1');
      expect(result[1].guid).toBe('entity-2');
    });
  });

  describe('searchEntities', () => {
    it('should search entities by query', async () => {
      const mockResponse = {
        data: {
          data: {
            actor: {
              entitySearch: {
                results: {
                  entities: [
                    {
                      guid: 'entity-1',
                      name: 'My App',
                      type: 'APPLICATION',
                      domain: 'APM',
                      entityType: 'APM_APPLICATION_ENTITY',
                      permalink: 'https://one.newrelic.com/...',
                      reporting: true,
                      applicationId: 123,
                      language: 'Java',
                    },
                  ],
                },
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.searchEntities('name LIKE "My App"', ['APPLICATION']);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My App');
      expect(result[0].applicationId).toBe(123);
    });
  });

  describe('getGoldenMetrics', () => {
    it('should fetch golden metrics for entities', async () => {
      const mockResponse = {
        data: {
          data: {
            actor: {
              entities: [
                {
                  guid: 'entity-1',
                  name: 'My App',
                  goldenMetrics: {
                    metrics: [
                      {
                        name: 'throughput',
                        displayName: 'Throughput',
                        unit: 'requests_per_minute',
                        query: 'SELECT rate(count(*), 1 minute) FROM Transaction',
                      },
                      {
                        name: 'responseTime',
                        displayName: 'Response Time',
                        unit: 'seconds',
                        query: 'SELECT average(duration) FROM Transaction',
                      },
                    ],
                  },
                  goldenTags: [
                    {
                      key: 'environment',
                      values: ['production', 'staging'],
                    },
                  ],
                },
              ],
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.getGoldenMetrics(['entity-1'], {
        since: '1 hour ago',
        until: 'now',
      });

      expect(result).toHaveLength(1);
      expect(result[0].goldenMetrics.metrics).toHaveLength(2);
      expect(result[0].goldenTags).toHaveLength(1);
    });
  });

  describe('validateNRQL', () => {
    it('should validate NRQL query successfully', async () => {
      const mockResponse = {
        data: {
          data: {
            actor: {
              account: {
                nrql: {
                  metadata: {
                    messages: [],
                  },
                },
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.validateNRQL('SELECT * FROM Transaction', 123456);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect NRQL validation errors', async () => {
      const mockResponse = {
        data: {
          data: {
            actor: {
              account: {
                nrql: {
                  metadata: {
                    messages: [
                      {
                        level: 'ERROR',
                        description: 'Invalid syntax near FROM',
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.validateNRQL('SELECT * FORM Transaction', 123456);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid syntax near FROM');
    });

    it('should handle GraphQL errors during validation', async () => {
      const mockResponse = {
        data: {
          errors: [{ message: 'Account not found' }],
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.validateNRQL('SELECT * FROM Transaction', 999999);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Account not found');
    });
  });

  describe('getEventTypes', () => {
    it('should fetch event types for account', async () => {
      const mockResponse = {
        data: {
          data: {
            actor: {
              account: {
                reportingEventTypes: [
                  'Transaction',
                  'TransactionError',
                  'PageView',
                  'SystemSample',
                ],
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.getEventTypes(123456);

      expect(result).toEqual([
        'Transaction',
        'TransactionError',
        'PageView',
        'SystemSample',
      ]);
    });
  });

  describe('utility methods', () => {
    it('should update API key', () => {
      const newApiKey = 'new-api-key';
      
      client.updateApiKey(newApiKey);

      expect(mockAxiosInstance.defaults.headers['API-Key']).toBe(newApiKey);
      expect(mockLogger.debug).toHaveBeenCalledWith('GraphQL client API key updated');
    });

    it('should test connection successfully', async () => {
      const mockResponse = {
        data: {
          data: {
            actor: {
              user: {
                id: '123',
                name: 'Test User',
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.testConnection();

      expect(result).toBe(true);
    });

    it('should handle connection test failure', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      const result = await client.testConnection();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'GraphQL connection test failed',
        expect.any(Error)
      );
    });
  });
});