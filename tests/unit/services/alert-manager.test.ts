import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AlertManager } from '../../../src/services/alert-manager';
import { NewRelicClient } from '../../../src/client/newrelic-client';
import { Logger } from '../../../src/utils/logger';
import { CacheManager } from '../../../src/services/cache-manager';
import {
  AlertPolicy,
  AlertPolicyInput,
  AlertCondition,
  AlertConditionInput,
  NotificationChannel,
  NotificationChannelInput,
} from '../../../src/types/newrelic';

// Mock dependencies
vi.mock('../../../src/client/newrelic-client');
vi.mock('../../../src/utils/logger');
vi.mock('../../../src/services/cache-manager');

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let mockClient: vi.Mocked<NewRelicClient>;
  let mockLogger: vi.Mocked<Logger>;
  let mockCache: vi.Mocked<CacheManager>;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any;

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      keys: vi.fn(),
    } as any;

    alertManager = new AlertManager(mockClient, mockLogger, mockCache);
  });

  describe('Policy Management', () => {
    describe('createPolicy', () => {
      it('should create a new alert policy successfully', async () => {
        const policyInput: AlertPolicyInput = {
          name: 'Test Policy',
          incident_preference: 'PER_POLICY',
        };

        const mockResponse = {
          policy: {
            id: 123,
            name: 'Test Policy',
            incident_preference: 'PER_POLICY',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        };

        mockClient.post.mockResolvedValue(mockResponse);

        const result = await alertManager.createPolicy(policyInput);

        expect(mockClient.post).toHaveBeenCalledWith('/alerts_policies.json', {
          policy: {
            name: 'Test Policy',
            incident_preference: 'PER_POLICY',
          },
        });

        expect(result).toEqual({
          id: '123',
          name: 'Test Policy',
          incident_preference: 'PER_POLICY',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        });

        expect(mockCache.delete).toHaveBeenCalledWith('alert_policies');
        expect(mockLogger.info).toHaveBeenCalledWith('Creating alert policy', {
          policyName: 'Test Policy',
        });
      });

      it('should throw error for invalid policy input', async () => {
        const policyInput: AlertPolicyInput = {
          name: '',
          incident_preference: 'PER_POLICY',
        };

        await expect(alertManager.createPolicy(policyInput)).rejects.toThrow(
          'Policy name is required'
        );
      });

      it('should handle API errors gracefully', async () => {
        const policyInput: AlertPolicyInput = {
          name: 'Test Policy',
        };

        const error = new Error('API Error');
        mockClient.post.mockRejectedValue(error);

        await expect(alertManager.createPolicy(policyInput)).rejects.toThrow(
          'Failed to create alert policy: API Error'
        );
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to create alert policy', error, {
          policy: policyInput,
        });
      });
    });

    describe('updatePolicy', () => {
      it('should update an existing alert policy', async () => {
        const policyId = '123';
        const updates: Partial<AlertPolicyInput> = {
          name: 'Updated Policy Name',
        };

        const existingPolicy: AlertPolicy = {
          id: '123',
          name: 'Original Policy',
          incident_preference: 'PER_POLICY',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        };

        const mockResponse = {
          policy: {
            id: 123,
            name: 'Updated Policy Name',
            incident_preference: 'PER_POLICY',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T01:00:00Z',
          },
        };

        mockCache.get.mockResolvedValue(existingPolicy);
        mockClient.put.mockResolvedValue(mockResponse);

        const result = await alertManager.updatePolicy(policyId, updates);

        expect(mockClient.put).toHaveBeenCalledWith(`/alerts_policies/${policyId}.json`, {
          policy: {
            name: 'Updated Policy Name',
            incident_preference: 'PER_POLICY',
          },
        });

        expect(result.name).toBe('Updated Policy Name');
        expect(mockCache.delete).toHaveBeenCalledWith('alert_policies');
        expect(mockCache.delete).toHaveBeenCalledWith(`alert_policy_${policyId}`);
      });

      it('should throw error if policy not found', async () => {
        const policyId = '999';
        const updates: Partial<AlertPolicyInput> = {
          name: 'Updated Policy Name',
        };

        mockCache.get.mockResolvedValue(null);
        mockClient.get.mockRejectedValue({ status: 404 });

        await expect(alertManager.updatePolicy(policyId, updates)).rejects.toThrow(
          'Alert policy with ID 999 not found'
        );
      });
    });

    describe('deletePolicy', () => {
      it.skip('should delete an alert policy and its conditions', async () => {
        const policyId = '123';

        const existingPolicy: AlertPolicy = {
          id: '123',
          name: 'Test Policy',
          incident_preference: 'PER_POLICY',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        };

        const conditions: AlertCondition[] = [
          {
            id: '456',
            type: 'apm_app_metric',
            name: 'Test Condition',
            enabled: true,
            entities: ['789'],
            metric: 'response_time_web',
            condition_scope: 'application',
            terms: [
              {
                duration: 5,
                operator: 'above',
                priority: 'critical',
                threshold: 1.0,
                time_function: 'all',
              },
            ],
          },
        ];

        mockCache.get.mockResolvedValueOnce(existingPolicy);
        mockCache.get.mockResolvedValueOnce(conditions);
        mockClient.delete.mockResolvedValue({});

        const result = await alertManager.deletePolicy(policyId);

        expect(result).toBe(true);
        expect(mockClient.delete).toHaveBeenCalledWith(`/alerts_policies/${policyId}.json`);
        expect(mockCache.delete).toHaveBeenCalledWith('alert_policies');
        expect(mockCache.delete).toHaveBeenCalledWith(`alert_policy_${policyId}`);
        expect(mockCache.delete).toHaveBeenCalledWith(`alert_conditions_${policyId}`);
      });

      it('should return false if policy not found', async () => {
        const policyId = '999';

        mockCache.get.mockResolvedValue(null);
        mockClient.get.mockRejectedValue({ status: 404 });

        const result = await alertManager.deletePolicy(policyId);

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('Alert policy not found for deletion', {
          policyId,
        });
      });
    });

    describe('getPolicies', () => {
      it('should retrieve all alert policies', async () => {
        const mockPolicies = [
          {
            id: 123,
            name: 'Policy 1',
            incident_preference: 'PER_POLICY',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
          {
            id: 124,
            name: 'Policy 2',
            incident_preference: 'PER_CONDITION',
            created_at: '2023-01-02T00:00:00Z',
            updated_at: '2023-01-02T00:00:00Z',
          },
        ];

        const mockResponse = { policies: mockPolicies };

        mockCache.get.mockResolvedValue(null);
        mockClient.get.mockResolvedValue(mockResponse);

        const result = await alertManager.getPolicies();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('123');
        expect(result[1].id).toBe('124');
        expect(mockClient.get).toHaveBeenCalledWith('/alerts_policies.json');
        expect(mockCache.set).toHaveBeenCalledWith('alert_policies', result, 300);
      });

      it('should return cached policies if available', async () => {
        const cachedPolicies: AlertPolicy[] = [
          {
            id: '123',
            name: 'Cached Policy',
            incident_preference: 'PER_POLICY',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ];

        mockCache.get.mockResolvedValue(cachedPolicies);

        const result = await alertManager.getPolicies();

        expect(result).toEqual(cachedPolicies);
        expect(mockClient.get).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved alert policies from cache');
      });

      it('should apply filters when provided', async () => {
        const filters = { name: 'Test Policy', enabled: true };
        const mockResponse = { policies: [] };

        mockCache.get.mockResolvedValue(null);
        mockClient.get.mockResolvedValue(mockResponse);

        await alertManager.getPolicies(filters);

        expect(mockClient.get).toHaveBeenCalledWith(
          '/alerts_policies.json?filter%5Bname%5D=Test+Policy&filter%5Benabled%5D=true'
        );
      });
    });
  });

  describe('Condition Management', () => {
    describe('createCondition', () => {
      it('should create a new alert condition successfully', async () => {
        const policyId = '123';
        const conditionInput: AlertConditionInput = {
          type: 'apm_app_metric',
          name: 'Test Condition',
          enabled: true,
          entities: ['789'],
          metric: 'response_time_web',
          condition_scope: 'application',
          terms: [
            {
              duration: 5,
              operator: 'above',
              priority: 'critical',
              threshold: 1.0,
              time_function: 'all',
            },
          ],
        };

        const mockResponse = {
          condition: {
            id: 456,
            type: 'apm_app_metric',
            name: 'Test Condition',
            enabled: true,
            entities: ['789'],
            metric: 'response_time_web',
            condition_scope: 'application',
            terms: [
              {
                duration: 5,
                operator: 'above',
                priority: 'critical',
                threshold: 1.0,
                time_function: 'all',
              },
            ],
          },
        };

        mockClient.post.mockResolvedValue(mockResponse);

        const result = await alertManager.createCondition(policyId, conditionInput);

        expect(mockClient.post).toHaveBeenCalledWith(
          `/alerts_conditions/policies/${policyId}.json`,
          {
            condition: {
              type: 'apm_app_metric',
              name: 'Test Condition',
              enabled: true,
              entities: ['789'],
              metric: 'response_time_web',
              condition_scope: 'application',
              terms: [
                {
                  duration: 5,
                  operator: 'above',
                  priority: 'critical',
                  threshold: 1.0,
                  time_function: 'all',
                },
              ],
              user_defined: undefined,
            },
          }
        );

        expect(result.id).toBe('456');
        expect(result.name).toBe('Test Condition');
        expect(mockCache.delete).toHaveBeenCalledWith(`alert_conditions_${policyId}`);
      });

      it('should validate condition input', async () => {
        const policyId = '123';
        const invalidCondition: AlertConditionInput = {
          type: 'apm_app_metric',
          name: '',
          entities: [],
          metric: 'response_time_web',
          terms: [],
        };

        await expect(alertManager.createCondition(policyId, invalidCondition)).rejects.toThrow(
          'Condition name is required'
        );
      });

      it('should validate term parameters', async () => {
        const policyId = '123';
        const conditionWithInvalidTerm: AlertConditionInput = {
          type: 'apm_app_metric',
          name: 'Test Condition',
          entities: ['789'],
          metric: 'response_time_web',
          terms: [
            {
              duration: 2, // Invalid: less than 5 minutes
              operator: 'above',
              priority: 'critical',
              threshold: 1.0,
              time_function: 'all',
            },
          ],
        };

        await expect(
          alertManager.createCondition(policyId, conditionWithInvalidTerm)
        ).rejects.toThrow('Term duration must be at least 5 minutes');
      });
    });

    describe('getConditions', () => {
      it('should retrieve conditions for a policy', async () => {
        const policyId = '123';
        const mockConditions = [
          {
            id: 456,
            type: 'apm_app_metric',
            name: 'Condition 1',
            enabled: true,
            entities: ['789'],
            metric: 'response_time_web',
            condition_scope: 'application',
            terms: [
              {
                duration: 5,
                operator: 'above',
                priority: 'critical',
                threshold: 1.0,
                time_function: 'all',
              },
            ],
          },
        ];

        const mockResponse = { conditions: mockConditions };

        mockCache.get.mockResolvedValue(null);
        mockClient.get.mockResolvedValue(mockResponse);

        const result = await alertManager.getConditions(policyId);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('456');
        expect(mockClient.get).toHaveBeenCalledWith(
          `/alerts_conditions.json?policy_id=${policyId}`
        );
        expect(mockCache.set).toHaveBeenCalledWith(`alert_conditions_${policyId}`, result, 300);
      });

      it('should return cached conditions if available', async () => {
        const policyId = '123';
        const cachedConditions: AlertCondition[] = [
          {
            id: '456',
            type: 'apm_app_metric',
            name: 'Cached Condition',
            enabled: true,
            entities: ['789'],
            metric: 'response_time_web',
            condition_scope: 'application',
            terms: [
              {
                duration: 5,
                operator: 'above',
                priority: 'critical',
                threshold: 1.0,
                time_function: 'all',
              },
            ],
          },
        ];

        mockCache.get.mockResolvedValue(cachedConditions);

        const result = await alertManager.getConditions(policyId);

        expect(result).toEqual(cachedConditions);
        expect(mockClient.get).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved alert conditions from cache', {
          policyId,
        });
      });
    });
  });

  describe('Notification Channel Management', () => {
    describe('createNotificationChannel', () => {
      it('should create an email notification channel', async () => {
        const channelInput: NotificationChannelInput = {
          name: 'Test Email Channel',
          type: 'email',
          configuration: {
            recipients: 'test@example.com',
          },
        };

        const mockResponse = {
          channel: {
            id: 789,
            name: 'Test Email Channel',
            type: 'email',
            configuration: {
              recipients: 'test@example.com',
            },
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        };

        mockClient.post.mockResolvedValue(mockResponse);

        const result = await alertManager.createNotificationChannel(channelInput);

        expect(mockClient.post).toHaveBeenCalledWith('/alerts_channels.json', {
          channel: {
            name: 'Test Email Channel',
            type: 'email',
            configuration: {
              recipients: 'test@example.com',
            },
          },
        });

        expect(result.id).toBe('789');
        expect(result.type).toBe('email');
        expect(mockCache.delete).toHaveBeenCalledWith('notification_channels');
      });

      it('should validate channel configuration based on type', async () => {
        const invalidEmailChannel: NotificationChannelInput = {
          name: 'Invalid Email Channel',
          type: 'email',
          configuration: {}, // Missing recipients
        };

        await expect(alertManager.createNotificationChannel(invalidEmailChannel)).rejects.toThrow(
          'Email recipients are required'
        );

        const invalidSlackChannel: NotificationChannelInput = {
          name: 'Invalid Slack Channel',
          type: 'slack',
          configuration: {}, // Missing url
        };

        await expect(alertManager.createNotificationChannel(invalidSlackChannel)).rejects.toThrow(
          'Slack webhook URL is required'
        );

        const invalidWebhookChannel: NotificationChannelInput = {
          name: 'Invalid Webhook Channel',
          type: 'webhook',
          configuration: {}, // Missing base_url
        };

        await expect(alertManager.createNotificationChannel(invalidWebhookChannel)).rejects.toThrow(
          'Webhook base URL is required'
        );
      });
    });

    describe('getNotificationChannels', () => {
      it('should retrieve all notification channels', async () => {
        const mockChannels = [
          {
            id: 789,
            name: 'Email Channel',
            type: 'email',
            configuration: { recipients: 'test@example.com' },
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
          {
            id: 790,
            name: 'Slack Channel',
            type: 'slack',
            configuration: { url: 'https://hooks.slack.com/webhook' },
            created_at: '2023-01-02T00:00:00Z',
            updated_at: '2023-01-02T00:00:00Z',
          },
        ];

        const mockResponse = { channels: mockChannels };

        mockCache.get.mockResolvedValue(null);
        mockClient.get.mockResolvedValue(mockResponse);

        const result = await alertManager.getNotificationChannels();

        expect(result).toHaveLength(2);
        expect(result[0].type).toBe('email');
        expect(result[1].type).toBe('slack');
        expect(mockClient.get).toHaveBeenCalledWith('/alerts_channels.json');
        expect(mockCache.set).toHaveBeenCalledWith('notification_channels', result, 300);
      });
    });

    describe('associateChannelWithPolicy', () => {
      it('should associate a notification channel with a policy', async () => {
        const policyId = '123';
        const channelId = '789';

        mockClient.put.mockResolvedValue({});

        const result = await alertManager.associateChannelWithPolicy(policyId, channelId);

        expect(result).toBe(true);
        expect(mockClient.put).toHaveBeenCalledWith(
          `/alerts_policy_channels.json?policy_id=${policyId}&channel_ids=${channelId}`
        );
        expect(mockCache.delete).toHaveBeenCalledWith(`alert_policy_${policyId}`);
        expect(mockCache.delete).toHaveBeenCalledWith('alert_policies');
      });
    });

    describe('disassociateChannelFromPolicy', () => {
      it('should disassociate a notification channel from a policy', async () => {
        const policyId = '123';
        const channelId = '789';

        mockClient.delete.mockResolvedValue({});

        const result = await alertManager.disassociateChannelFromPolicy(policyId, channelId);

        expect(result).toBe(true);
        expect(mockClient.delete).toHaveBeenCalledWith(
          `/alerts_policy_channels.json?policy_id=${policyId}&channel_id=${channelId}`
        );
        expect(mockCache.delete).toHaveBeenCalledWith(`alert_policy_${policyId}`);
        expect(mockCache.delete).toHaveBeenCalledWith('alert_policies');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const policyInput: AlertPolicyInput = {
        name: 'Test Policy',
      };

      const networkError = new Error('Network timeout');
      mockClient.post.mockRejectedValue(networkError);

      await expect(alertManager.createPolicy(policyInput)).rejects.toThrow(
        'Failed to create alert policy: Network timeout'
      );
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create alert policy', networkError, {
        policy: policyInput,
      });
    });

    it('should handle API validation errors', async () => {
      const conditionInput: AlertConditionInput = {
        type: 'apm_app_metric',
        name: 'Test Condition',
        entities: ['invalid-entity'],
        metric: 'invalid_metric',
        terms: [
          {
            duration: 5,
            operator: 'above',
            priority: 'critical',
            threshold: 1.0,
            time_function: 'all',
          },
        ],
      };

      const validationError = {
        status: 422,
        message: 'Invalid entity ID',
      };
      mockClient.post.mockRejectedValue(validationError);

      await expect(alertManager.createCondition('123', conditionInput)).rejects.toThrow(
        'Failed to create alert condition: Invalid entity ID'
      );
    });
  });
});
