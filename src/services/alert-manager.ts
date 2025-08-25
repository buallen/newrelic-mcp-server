import { NewRelicClient } from '../client/newrelic-client';
import { Logger } from '../utils/logger';
import { CacheManager } from './cache-manager';
import {
  AlertPolicy,
  AlertPolicyInput,
  AlertCondition,
  AlertConditionInput,
  NotificationChannel,
  NotificationChannelInput,
  PolicyFilters,
  AlertTerm,
  UserDefinedMetric
} from '../types/newrelic';

export interface AlertManagerInterface {
  // Policy management
  createPolicy(policy: AlertPolicyInput): Promise<AlertPolicy>;
  updatePolicy(policyId: string, updates: Partial<AlertPolicyInput>): Promise<AlertPolicy>;
  deletePolicy(policyId: string): Promise<boolean>;
  getPolicies(filters?: PolicyFilters): Promise<AlertPolicy[]>;
  getPolicy(policyId: string): Promise<AlertPolicy | null>;
  
  // Condition management
  createCondition(policyId: string, condition: AlertConditionInput): Promise<AlertCondition>;
  updateCondition(conditionId: string, updates: Partial<AlertConditionInput>): Promise<AlertCondition>;
  deleteCondition(conditionId: string): Promise<boolean>;
  getConditions(policyId: string): Promise<AlertCondition[]>;
  
  // Notification channels
  getNotificationChannels(): Promise<NotificationChannel[]>;
  createNotificationChannel(channel: NotificationChannelInput): Promise<NotificationChannel>;
  updateNotificationChannel(channelId: string, updates: Partial<NotificationChannelInput>): Promise<NotificationChannel>;
  deleteNotificationChannel(channelId: string): Promise<boolean>;
  
  // Policy-Channel associations
  associateChannelWithPolicy(policyId: string, channelId: string): Promise<boolean>;
  disassociateChannelFromPolicy(policyId: string, channelId: string): Promise<boolean>;
}

export class AlertManager implements AlertManagerInterface {
  private client: NewRelicClient;
  private logger: Logger;
  private cache: CacheManager;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(client: NewRelicClient, logger: Logger, cache: CacheManager) {
    this.client = client;
    this.logger = logger;
    this.cache = cache;
  }

  async createPolicy(policy: AlertPolicyInput): Promise<AlertPolicy> {
    try {
      this.logger.info('Creating alert policy', { policyName: policy.name });
      
      // Validate policy input
      this.validatePolicyInput(policy);
      
      // Create policy via REST API
      const response = await this.client.post('/alerts_policies.json', {
        policy: {
          name: policy.name,
          incident_preference: policy.incident_preference || 'PER_POLICY'
        }
      });

      const createdPolicy = response.policy;
      
      // Clear policies cache
      await this.cache.delete('alert_policies');
      
      this.logger.info('Alert policy created successfully', { 
        policyId: createdPolicy.id,
        policyName: createdPolicy.name 
      });
      
      return this.mapPolicyResponse(createdPolicy);
    } catch (error) {
      this.logger.error('Failed to create alert policy', error, { policy });
      throw new Error(`Failed to create alert policy: ${error.message}`);
    }
  }

  async updatePolicy(policyId: string, updates: Partial<AlertPolicyInput>): Promise<AlertPolicy> {
    try {
      this.logger.info('Updating alert policy', { policyId, updates });
      
      // Get existing policy first
      const existingPolicy = await this.getPolicy(policyId);
      if (!existingPolicy) {
        throw new Error(`Alert policy with ID ${policyId} not found`);
      }
      
      // Merge updates with existing policy
      const updatedPolicyData = {
        name: updates.name || existingPolicy.name,
        incident_preference: updates.incident_preference || existingPolicy.incident_preference
      };
      
      const response = await this.client.put(`/alerts_policies/${policyId}.json`, {
        policy: updatedPolicyData
      });

      const updatedPolicy = response.policy;
      
      // Clear caches
      await this.cache.delete('alert_policies');
      await this.cache.delete(`alert_policy_${policyId}`);
      
      this.logger.info('Alert policy updated successfully', { 
        policyId: updatedPolicy.id,
        policyName: updatedPolicy.name 
      });
      
      return this.mapPolicyResponse(updatedPolicy);
    } catch (error) {
      this.logger.error('Failed to update alert policy', error, { policyId, updates });
      throw new Error(`Failed to update alert policy: ${error.message}`);
    }
  }

  async deletePolicy(policyId: string): Promise<boolean> {
    try {
      this.logger.info('Deleting alert policy', { policyId });
      
      // Check if policy exists
      const existingPolicy = await this.getPolicy(policyId);
      if (!existingPolicy) {
        this.logger.warn('Alert policy not found for deletion', { policyId });
        return false;
      }
      
      // Delete all conditions associated with this policy first
      const conditions = await this.getConditions(policyId);
      for (const condition of conditions) {
        await this.deleteCondition(condition.id);
      }
      
      // Delete the policy
      await this.client.delete(`/alerts_policies/${policyId}.json`);
      
      // Clear caches
      await this.cache.delete('alert_policies');
      await this.cache.delete(`alert_policy_${policyId}`);
      await this.cache.delete(`alert_conditions_${policyId}`);
      
      this.logger.info('Alert policy deleted successfully', { policyId });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete alert policy', error, { policyId });
      throw new Error(`Failed to delete alert policy: ${error.message}`);
    }
  }

  async getPolicies(filters?: PolicyFilters): Promise<AlertPolicy[]> {
    try {
      const cacheKey = filters ? `alert_policies_${JSON.stringify(filters)}` : 'alert_policies';
      
      // Try to get from cache first
      const cached = await this.cache.get<AlertPolicy[]>(cacheKey);
      if (cached) {
        this.logger.debug('Retrieved alert policies from cache');
        return cached;
      }
      
      this.logger.info('Fetching alert policies', { filters });
      
      let url = '/alerts_policies.json';
      const params = new URLSearchParams();
      
      if (filters?.name) {
        params.append('filter[name]', filters.name);
      }
      if (filters?.enabled !== undefined) {
        params.append('filter[enabled]', filters.enabled.toString());
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await this.client.get(url);
      const policies = response.policies.map(this.mapPolicyResponse);
      
      // Cache the results
      await this.cache.set(cacheKey, policies, this.CACHE_TTL);
      
      this.logger.info('Retrieved alert policies', { count: policies.length });
      return policies;
    } catch (error) {
      this.logger.error('Failed to get alert policies', error, { filters });
      throw new Error(`Failed to get alert policies: ${error.message}`);
    }
  }

  async getPolicy(policyId: string): Promise<AlertPolicy | null> {
    try {
      const cacheKey = `alert_policy_${policyId}`;
      
      // Try cache first
      const cached = await this.cache.get<AlertPolicy>(cacheKey);
      if (cached) {
        return cached;
      }
      
      this.logger.debug('Fetching alert policy', { policyId });
      
      const response = await this.client.get(`/alerts_policies/${policyId}.json`);
      const policy = this.mapPolicyResponse(response.policy);
      
      // Cache the result
      await this.cache.set(cacheKey, policy, this.CACHE_TTL);
      
      return policy;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      this.logger.error('Failed to get alert policy', error, { policyId });
      throw new Error(`Failed to get alert policy: ${error.message}`);
    }
  }

  async createCondition(policyId: string, condition: AlertConditionInput): Promise<AlertCondition> {
    try {
      this.logger.info('Creating alert condition', { policyId, conditionName: condition.name });
      
      // Validate condition input
      this.validateConditionInput(condition);
      
      // Create condition via REST API
      const conditionData = {
        type: condition.type,
        name: condition.name,
        enabled: condition.enabled !== false,
        entities: condition.entities,
        metric: condition.metric,
        condition_scope: condition.condition_scope || 'application',
        terms: condition.terms,
        user_defined: condition.user_defined
      };
      
      const response = await this.client.post(`/alerts_conditions/policies/${policyId}.json`, {
        condition: conditionData
      });

      const createdCondition = response.condition;
      
      // Clear conditions cache for this policy
      await this.cache.delete(`alert_conditions_${policyId}`);
      
      this.logger.info('Alert condition created successfully', { 
        conditionId: createdCondition.id,
        conditionName: createdCondition.name,
        policyId 
      });
      
      return this.mapConditionResponse(createdCondition);
    } catch (error) {
      this.logger.error('Failed to create alert condition', error, { policyId, condition });
      throw new Error(`Failed to create alert condition: ${error.message}`);
    }
  }

  async updateCondition(conditionId: string, updates: Partial<AlertConditionInput>): Promise<AlertCondition> {
    try {
      this.logger.info('Updating alert condition', { conditionId, updates });
      
      // Get existing condition to find policy ID
      const existingCondition = await this.getConditionById(conditionId);
      if (!existingCondition) {
        throw new Error(`Alert condition with ID ${conditionId} not found`);
      }
      
      // Merge updates with existing condition
      const updatedConditionData = {
        type: updates.type || existingCondition.type,
        name: updates.name || existingCondition.name,
        enabled: updates.enabled !== undefined ? updates.enabled : existingCondition.enabled,
        entities: updates.entities || existingCondition.entities,
        metric: updates.metric || existingCondition.metric,
        condition_scope: updates.condition_scope || existingCondition.condition_scope,
        terms: updates.terms || existingCondition.terms,
        user_defined: updates.user_defined || existingCondition.user_defined
      };
      
      const response = await this.client.put(`/alerts_conditions/${conditionId}.json`, {
        condition: updatedConditionData
      });

      const updatedCondition = response.condition;
      
      // Clear relevant caches
      await this.cache.delete(`alert_condition_${conditionId}`);
      // We don't know the policy ID from the response, so clear all condition caches
      const cacheKeys = await this.cache.keys('alert_conditions_*');
      for (const key of cacheKeys) {
        await this.cache.delete(key);
      }
      
      this.logger.info('Alert condition updated successfully', { 
        conditionId: updatedCondition.id,
        conditionName: updatedCondition.name 
      });
      
      return this.mapConditionResponse(updatedCondition);
    } catch (error) {
      this.logger.error('Failed to update alert condition', error, { conditionId, updates });
      throw new Error(`Failed to update alert condition: ${error.message}`);
    }
  }

  async deleteCondition(conditionId: string): Promise<boolean> {
    try {
      this.logger.info('Deleting alert condition', { conditionId });
      
      // Check if condition exists
      const existingCondition = await this.getConditionById(conditionId);
      if (!existingCondition) {
        this.logger.warn('Alert condition not found for deletion', { conditionId });
        return false;
      }
      
      // Delete the condition
      await this.client.delete(`/alerts_conditions/${conditionId}.json`);
      
      // Clear caches
      await this.cache.delete(`alert_condition_${conditionId}`);
      const cacheKeys = await this.cache.keys('alert_conditions_*');
      for (const key of cacheKeys) {
        await this.cache.delete(key);
      }
      
      this.logger.info('Alert condition deleted successfully', { conditionId });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete alert condition', error, { conditionId });
      throw new Error(`Failed to delete alert condition: ${error.message}`);
    }
  }

  async getConditions(policyId: string): Promise<AlertCondition[]> {
    try {
      const cacheKey = `alert_conditions_${policyId}`;
      
      // Try cache first
      const cached = await this.cache.get<AlertCondition[]>(cacheKey);
      if (cached) {
        this.logger.debug('Retrieved alert conditions from cache', { policyId });
        return cached;
      }
      
      this.logger.info('Fetching alert conditions', { policyId });
      
      const response = await this.client.get(`/alerts_conditions.json?policy_id=${policyId}`);
      const conditions = response.conditions.map(this.mapConditionResponse);
      
      // Cache the results
      await this.cache.set(cacheKey, conditions, this.CACHE_TTL);
      
      this.logger.info('Retrieved alert conditions', { policyId, count: conditions.length });
      return conditions;
    } catch (error) {
      this.logger.error('Failed to get alert conditions', error, { policyId });
      throw new Error(`Failed to get alert conditions: ${error.message}`);
    }
  }

  async getNotificationChannels(): Promise<NotificationChannel[]> {
    try {
      const cacheKey = 'notification_channels';
      
      // Try cache first
      const cached = await this.cache.get<NotificationChannel[]>(cacheKey);
      if (cached) {
        this.logger.debug('Retrieved notification channels from cache');
        return cached;
      }
      
      this.logger.info('Fetching notification channels');
      
      const response = await this.client.get('/alerts_channels.json');
      const channels = response.channels.map(this.mapChannelResponse);
      
      // Cache the results
      await this.cache.set(cacheKey, channels, this.CACHE_TTL);
      
      this.logger.info('Retrieved notification channels', { count: channels.length });
      return channels;
    } catch (error) {
      this.logger.error('Failed to get notification channels', error as Error);
      throw new Error(`Failed to get notification channels: ${error.message}`);
    }
  }

  async createNotificationChannel(channel: NotificationChannelInput): Promise<NotificationChannel> {
    try {
      this.logger.info('Creating notification channel', { channelName: channel.name, type: channel.type });
      
      // Validate channel input
      this.validateChannelInput(channel);
      
      const channelData = {
        name: channel.name,
        type: channel.type,
        configuration: channel.configuration
      };
      
      const response = await this.client.post('/alerts_channels.json', {
        channel: channelData
      });

      const createdChannel = response.channel;
      
      // Clear channels cache
      await this.cache.delete('notification_channels');
      
      this.logger.info('Notification channel created successfully', { 
        channelId: createdChannel.id,
        channelName: createdChannel.name 
      });
      
      return this.mapChannelResponse(createdChannel);
    } catch (error) {
      this.logger.error('Failed to create notification channel', error, { channel });
      throw new Error(`Failed to create notification channel: ${error.message}`);
    }
  }

  async updateNotificationChannel(channelId: string, updates: Partial<NotificationChannelInput>): Promise<NotificationChannel> {
    try {
      this.logger.info('Updating notification channel', { channelId, updates });
      
      const updatedChannelData = {
        name: updates.name,
        configuration: updates.configuration
      };
      
      // Remove undefined values
      Object.keys(updatedChannelData).forEach(key => {
        if (updatedChannelData[key] === undefined) {
          delete updatedChannelData[key];
        }
      });
      
      const response = await this.client.put(`/alerts_channels/${channelId}.json`, {
        channel: updatedChannelData
      });

      const updatedChannel = response.channel;
      
      // Clear caches
      await this.cache.delete('notification_channels');
      await this.cache.delete(`notification_channel_${channelId}`);
      
      this.logger.info('Notification channel updated successfully', { 
        channelId: updatedChannel.id,
        channelName: updatedChannel.name 
      });
      
      return this.mapChannelResponse(updatedChannel);
    } catch (error) {
      this.logger.error('Failed to update notification channel', error, { channelId, updates });
      throw new Error(`Failed to update notification channel: ${error.message}`);
    }
  }

  async deleteNotificationChannel(channelId: string): Promise<boolean> {
    try {
      this.logger.info('Deleting notification channel', { channelId });
      
      await this.client.delete(`/alerts_channels/${channelId}.json`);
      
      // Clear caches
      await this.cache.delete('notification_channels');
      await this.cache.delete(`notification_channel_${channelId}`);
      
      this.logger.info('Notification channel deleted successfully', { channelId });
      return true;
    } catch (error) {
      if (error.status === 404) {
        this.logger.warn('Notification channel not found for deletion', { channelId });
        return false;
      }
      this.logger.error('Failed to delete notification channel', error, { channelId });
      throw new Error(`Failed to delete notification channel: ${error.message}`);
    }
  }

  async associateChannelWithPolicy(policyId: string, channelId: string): Promise<boolean> {
    try {
      this.logger.info('Associating notification channel with policy', { policyId, channelId });
      
      await this.client.put(`/alerts_policy_channels.json?policy_id=${policyId}&channel_ids=${channelId}`);
      
      // Clear relevant caches
      await this.cache.delete(`alert_policy_${policyId}`);
      await this.cache.delete('alert_policies');
      
      this.logger.info('Channel associated with policy successfully', { policyId, channelId });
      return true;
    } catch (error) {
      this.logger.error('Failed to associate channel with policy', error, { policyId, channelId });
      throw new Error(`Failed to associate channel with policy: ${error.message}`);
    }
  }

  async disassociateChannelFromPolicy(policyId: string, channelId: string): Promise<boolean> {
    try {
      this.logger.info('Disassociating notification channel from policy', { policyId, channelId });
      
      await this.client.delete(`/alerts_policy_channels.json?policy_id=${policyId}&channel_id=${channelId}`);
      
      // Clear relevant caches
      await this.cache.delete(`alert_policy_${policyId}`);
      await this.cache.delete('alert_policies');
      
      this.logger.info('Channel disassociated from policy successfully', { policyId, channelId });
      return true;
    } catch (error) {
      this.logger.error('Failed to disassociate channel from policy', error, { policyId, channelId });
      throw new Error(`Failed to disassociate channel from policy: ${error.message}`);
    }
  }

  // Private helper methods
  private async getConditionById(conditionId: string): Promise<AlertCondition | null> {
    try {
      const cacheKey = `alert_condition_${conditionId}`;
      
      // Try cache first
      const cached = await this.cache.get<AlertCondition>(cacheKey);
      if (cached) {
        return cached;
      }
      
      const response = await this.client.get(`/alerts_conditions/${conditionId}.json`);
      const condition = this.mapConditionResponse(response.condition);
      
      // Cache the result
      await this.cache.set(cacheKey, condition, this.CACHE_TTL);
      
      return condition;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private validatePolicyInput(policy: AlertPolicyInput): void {
    if (!policy.name || policy.name.trim().length === 0) {
      throw new Error('Policy name is required');
    }
    
    if (policy.incident_preference && 
        !['PER_POLICY', 'PER_CONDITION', 'PER_CONDITION_AND_TARGET'].includes(policy.incident_preference)) {
      throw new Error('Invalid incident preference');
    }
  }

  private validateConditionInput(condition: AlertConditionInput): void {
    if (!condition.name || condition.name.trim().length === 0) {
      throw new Error('Condition name is required');
    }
    
    if (!condition.type) {
      throw new Error('Condition type is required');
    }
    
    if (!condition.entities || condition.entities.length === 0) {
      throw new Error('At least one entity is required');
    }
    
    if (!condition.metric) {
      throw new Error('Metric is required');
    }
    
    if (!condition.terms || condition.terms.length === 0) {
      throw new Error('At least one term is required');
    }
    
    // Validate terms
    for (const term of condition.terms) {
      if (!term.duration || term.duration < 5) {
        throw new Error('Term duration must be at least 5 minutes');
      }
      
      if (!term.operator || !['above', 'below', 'equal'].includes(term.operator)) {
        throw new Error('Invalid term operator');
      }
      
      if (term.threshold === undefined || term.threshold === null) {
        throw new Error('Term threshold is required');
      }
      
      if (!term.time_function || !['all', 'any'].includes(term.time_function)) {
        throw new Error('Invalid term time function');
      }
    }
  }

  private validateChannelInput(channel: NotificationChannelInput): void {
    if (!channel.name || channel.name.trim().length === 0) {
      throw new Error('Channel name is required');
    }
    
    if (!channel.type) {
      throw new Error('Channel type is required');
    }
    
    if (!channel.configuration) {
      throw new Error('Channel configuration is required');
    }
    
    // Validate configuration based on channel type
    switch (channel.type) {
      case 'email':
        if (!channel.configuration.recipients) {
          throw new Error('Email recipients are required');
        }
        break;
      case 'slack':
        if (!channel.configuration.url) {
          throw new Error('Slack webhook URL is required');
        }
        break;
      case 'webhook':
        if (!channel.configuration.base_url) {
          throw new Error('Webhook base URL is required');
        }
        break;
    }
  }

  private mapPolicyResponse(policy: any): AlertPolicy {
    return {
      id: policy.id.toString(),
      name: policy.name,
      incident_preference: policy.incident_preference,
      created_at: policy.created_at,
      updated_at: policy.updated_at
    };
  }

  private mapConditionResponse(condition: any): AlertCondition {
    return {
      id: condition.id.toString(),
      type: condition.type,
      name: condition.name,
      enabled: condition.enabled,
      entities: condition.entities,
      metric: condition.metric,
      condition_scope: condition.condition_scope,
      terms: condition.terms,
      user_defined: condition.user_defined
    };
  }

  private mapChannelResponse(channel: any): NotificationChannel {
    return {
      id: channel.id.toString(),
      name: channel.name,
      type: channel.type,
      configuration: channel.configuration,
      created_at: channel.created_at,
      updated_at: channel.updated_at
    };
  }
}