/**
 * NewRelic API Integration Tests
 * Integration tests for NewRelic API client functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NewRelicClientImpl } from '../../src/client/newrelic-client';
import { GraphQLClient } from '../../src/client/graphql-client';
import { NewRelicClientConfig } from '../../src/interfaces/newrelic-client';
import { Logger } from '../../src/interfaces/services';

// Mock logger for integration tests
const mockLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  logAPICall: () => {},
  logIncidentAnalysis: () => {},
  logQueryExecution: () => {},
};

// Skip integration tests if no API key is provided
const skipIntegrationTests = !process.env.NEWRELIC_API_KEY || process.env.SKIP_INTEGRATION_TESTS === 'true';

describe.skipIf(skipIntegrationTests)('NewRelic API Integration', () => {
  let client: NewRelicClientImpl;
  let graphqlClient: GraphQLClient;
  let config: NewRelicClientConfig;

  beforeAll(() => {
    config = {
      apiKey: process.env.NEWRELIC_API_KEY!,
      baseUrl: process.env.NEWRELIC_BASE_URL || 'https://api.newrelic.com',
      graphqlUrl: process.env.NEWRELIC_GRAPHQL_URL || 'https://api.newrelic.com/graphql',
      defaultAccountId: process.env.NEWRELIC_ACCOUNT_ID,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      rateLimitPerMinute: 60,
    };

    client = new NewRelicClientImpl(config, mockLogger);
    graphqlClient = new GraphQLClient({
      endpoint: config.graphqlUrl,
      apiKey: config.apiKey,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts,
      retryDelay: config.retryDelay,
    }, mockLogger);
  });

  describe('Authentication', () => {
    it('should authenticate successfully with valid API key', async () => {
      const result = await client.authenticate(config.apiKey);
      expect(result).toBe(true);
    }, 10000);

    it('should validate permissions', async () => {
      const permissions = await client.validatePermissions();
      expect(permissions).toContain('read');
    }, 10000);

    it('should get account access', async () => {
      const accounts = await client.getAccountAccess(config.apiKey);
      expect(accounts).toBeInstanceOf(Array);
      expect(accounts.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Applications API', () => {
    it('should fetch applications list', async () => {
      const applications = await client.getApplications();
      expect(applications).toBeInstanceOf(Array);
      
      if (applications.length > 0) {
        const app = applications[0];
        expect(app).toHaveProperty('id');
        expect(app).toHaveProperty('name');
        expect(app).toHaveProperty('language');
        expect(app).toHaveProperty('health_status');
      }
    }, 15000);

    it('should fetch single application if applications exist', async () => {
      const applications = await client.getApplications();
      
      if (applications.length > 0) {
        const appId = applications[0].id;
        const application = await client.getApplication(appId);
        
        expect(application).toHaveProperty('id', appId);
        expect(application).toHaveProperty('name');
        expect(application).toHaveProperty('application_summary');
      }
    }, 15000);
  });

  describe('Alert Policies API', () => {
    let testPolicyId: string | null = null;

    afterAll(async () => {
      // Clean up test policy if created
      if (testPolicyId) {
        try {
          await client.deleteAlertPolicy(testPolicyId);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should fetch alert policies list', async () => {
      const policies = await client.getAlertPolicies();
      expect(policies).toBeInstanceOf(Array);
    }, 15000);

    it('should create, update, and delete alert policy', async () => {
      // Create policy
      const policyInput = {
        name: `Test Policy ${Date.now()}`,
        incident_preference: 'PER_CONDITION' as const,
      };

      const createdPolicy = await client.createAlertPolicy(policyInput);
      expect(createdPolicy).toHaveProperty('id');
      expect(createdPolicy.name).toBe(policyInput.name);
      
      testPolicyId = createdPolicy.id;

      // Update policy
      const updates = { name: `Updated ${policyInput.name}` };
      const updatedPolicy = await client.updateAlertPolicy(testPolicyId, updates);
      expect(updatedPolicy.name).toBe(updates.name);

      // Delete policy
      const deleteResult = await client.deleteAlertPolicy(testPolicyId);
      expect(deleteResult).toBe(true);
      
      testPolicyId = null; // Mark as cleaned up
    }, 30000);
  });

  describe('Incidents API', () => {
    it('should fetch incidents list', async () => {
      const incidents = await client.getIncidents();
      expect(incidents).toBeInstanceOf(Array);
      
      if (incidents.length > 0) {
        const incident = incidents[0];
        expect(incident).toHaveProperty('id');
        expect(incident).toHaveProperty('state');
        expect(incident).toHaveProperty('opened_at');
      }
    }, 15000);

    it('should fetch single incident if incidents exist', async () => {
      const incidents = await client.getIncidents();
      
      if (incidents.length > 0) {
        const incidentId = incidents[0].id;
        const incident = await client.getIncident(incidentId);
        
        expect(incident).toHaveProperty('id', incidentId);
        expect(incident).toHaveProperty('description');
      }
    }, 15000);
  });

  describe('GraphQL/NRQL Queries', () => {
    it('should execute simple NRQL query', async () => {
      if (!config.defaultAccountId) {
        console.log('Skipping NRQL test - no default account ID provided');
        return;
      }

      const query = {
        query: 'SELECT count(*) FROM Transaction SINCE 1 hour ago LIMIT 1',
        accountId: config.defaultAccountId,
      };

      const result = await client.executeNRQL(query);
      
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('performanceStats');
      expect(result.results).toBeInstanceOf(Array);
    }, 20000);

    it('should validate NRQL query', async () => {
      const validQuery = 'SELECT count(*) FROM Transaction';
      const result = await client.validateQuery(validQuery);
      
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result.errors).toBeInstanceOf(Array);
    }, 15000);

    it('should detect invalid NRQL query', async () => {
      const invalidQuery = 'SELECT count(*) FORM Transaction'; // Typo: FORM instead of FROM
      const result = await client.validateQuery(invalidQuery);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('GraphQL Client', () => {
    it('should test GraphQL connection', async () => {
      const connected = await graphqlClient.testConnection();
      expect(connected).toBe(true);
    }, 10000);

    it('should get user info via GraphQL', async () => {
      const userInfo = await graphqlClient.getUserInfo();
      
      expect(userInfo).toHaveProperty('id');
      expect(userInfo).toHaveProperty('name');
    }, 15000);

    it('should get account info via GraphQL', async () => {
      if (!config.defaultAccountId) {
        console.log('Skipping account info test - no default account ID provided');
        return;
      }

      const accountInfo = await graphqlClient.getAccountInfo(parseInt(config.defaultAccountId, 10));
      
      expect(accountInfo).toHaveProperty('id');
      expect(accountInfo).toHaveProperty('name');
    }, 15000);

    it('should get event types for account', async () => {
      if (!config.defaultAccountId) {
        console.log('Skipping event types test - no default account ID provided');
        return;
      }

      const eventTypes = await graphqlClient.getEventTypes(parseInt(config.defaultAccountId, 10));
      
      expect(eventTypes).toBeInstanceOf(Array);
      expect(eventTypes.length).toBeGreaterThan(0);
    }, 15000);

    it('should search entities', async () => {
      const entities = await graphqlClient.searchEntities('domain = "APM"', ['APPLICATION']);
      
      expect(entities).toBeInstanceOf(Array);
      
      if (entities.length > 0) {
        const entity = entities[0];
        expect(entity).toHaveProperty('guid');
        expect(entity).toHaveProperty('name');
        expect(entity).toHaveProperty('type');
      }
    }, 20000);
  });

  describe('Health and Status', () => {
    it('should check connection status', async () => {
      const connected = await client.checkConnection();
      expect(connected).toBe(true);
    }, 10000);

    it('should get API status', async () => {
      const status = await client.getApiStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('responseTime');
      expect(status.connected).toBe(true);
      expect(status.responseTime).toBeGreaterThanOrEqual(0);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle invalid API key', async () => {
      const invalidClient = new NewRelicClientImpl({
        ...config,
        apiKey: 'invalid-key',
      }, mockLogger);

      const result = await invalidClient.authenticate('invalid-key');
      expect(result).toBe(false);
    }, 10000);

    it('should handle network timeouts', async () => {
      const timeoutClient = new NewRelicClientImpl({
        ...config,
        timeout: 1, // 1ms timeout to force timeout
      }, mockLogger);

      await expect(timeoutClient.getApplications()).rejects.toThrow();
    }, 10000);

    it('should handle invalid account ID in NRQL', async () => {
      const query = {
        query: 'SELECT count(*) FROM Transaction',
        accountId: '999999999', // Invalid account ID
      };

      await expect(client.executeNRQL(query)).rejects.toThrow();
    }, 15000);
  });
});

// Helper function to run integration tests manually
export function runIntegrationTests() {
  if (skipIntegrationTests) {
    console.log('Integration tests skipped. Set NEWRELIC_API_KEY environment variable to run.');
    console.log('Example: NEWRELIC_API_KEY=your_key npm run test:integration');
    return;
  }
  
  console.log('Running NewRelic API integration tests...');
  console.log('API Key:', process.env.NEWRELIC_API_KEY ? 'Set' : 'Not set');
  console.log('Account ID:', process.env.NEWRELIC_ACCOUNT_ID || 'Not set');
}