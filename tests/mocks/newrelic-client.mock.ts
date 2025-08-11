/**
 * NewRelic Client Mock
 * Mock implementation for testing
 */

import { vi } from 'vitest';
import { NewRelicClient } from '../../src/interfaces/newrelic-client';
import {
  Application,
  AlertPolicy,
  AlertCondition,
  NotificationChannel,
  Incident,
  IncidentDetails,
  NRQLResult,
  GraphQLResult,
  ValidationResult,
  EntityType,
} from '../../src/types/newrelic';

export const createMockNewRelicClient = (): NewRelicClient => {
  return {
    // Authentication
    authenticate: vi.fn().mockResolvedValue(true),
    validatePermissions: vi.fn().mockResolvedValue(['read', 'write']),
    getAccountAccess: vi.fn().mockResolvedValue(['123456']),

    // GraphQL/NerdGraph queries
    executeNRQL: vi.fn().mockResolvedValue({
      results: [],
      metadata: {
        eventType: 'Transaction',
        eventTypes: ['Transaction'],
        contents: [],
        messages: [],
      },
      performanceStats: {
        inspectedCount: 0,
        omittedCount: 0,
        matchCount: 0,
        wallClockTime: 100,
      },
    } as NRQLResult),
    executeGraphQL: vi.fn().mockResolvedValue({
      data: {},
    } as GraphQLResult),

    // Applications
    getApplications: vi.fn().mockResolvedValue([] as Application[]),
    getApplication: vi.fn().mockResolvedValue({} as Application),

    // Alert Policies
    getAlertPolicies: vi.fn().mockResolvedValue([] as AlertPolicy[]),
    getAlertPolicy: vi.fn().mockResolvedValue({} as AlertPolicy),
    createAlertPolicy: vi.fn().mockResolvedValue({} as AlertPolicy),
    updateAlertPolicy: vi.fn().mockResolvedValue({} as AlertPolicy),
    deleteAlertPolicy: vi.fn().mockResolvedValue(true),

    // Alert Conditions
    getAlertConditions: vi.fn().mockResolvedValue([] as AlertCondition[]),
    getAlertCondition: vi.fn().mockResolvedValue({} as AlertCondition),
    createAlertCondition: vi.fn().mockResolvedValue({} as AlertCondition),
    updateAlertCondition: vi.fn().mockResolvedValue({} as AlertCondition),
    deleteAlertCondition: vi.fn().mockResolvedValue(true),

    // Notification Channels
    getNotificationChannels: vi.fn().mockResolvedValue([] as NotificationChannel[]),
    getNotificationChannel: vi.fn().mockResolvedValue({} as NotificationChannel),
    createNotificationChannel: vi.fn().mockResolvedValue({} as NotificationChannel),
    updateNotificationChannel: vi.fn().mockResolvedValue({} as NotificationChannel),
    deleteNotificationChannel: vi.fn().mockResolvedValue(true),

    // Incidents
    getIncidents: vi.fn().mockResolvedValue([] as Incident[]),
    getIncident: vi.fn().mockResolvedValue({} as IncidentDetails),
    acknowledgeIncident: vi.fn().mockResolvedValue(true),
    closeIncident: vi.fn().mockResolvedValue(true),

    // Query utilities
    validateQuery: vi.fn().mockResolvedValue({
      valid: true,
      errors: [],
      suggestions: [],
    } as ValidationResult),
    getQuerySuggestions: vi.fn().mockResolvedValue([]),
    getMetricNames: vi.fn().mockResolvedValue([]),
    getEntityTypes: vi.fn().mockResolvedValue([] as EntityType[]),

    // Health and status
    checkConnection: vi.fn().mockResolvedValue(true),
    getApiStatus: vi.fn().mockResolvedValue({
      connected: true,
      lastSuccessfulCall: new Date().toISOString(),
      rateLimitRemaining: 100,
      rateLimitReset: new Date().toISOString(),
      responseTime: 100,
    }),
  };
};