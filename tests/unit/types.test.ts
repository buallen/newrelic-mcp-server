/**
 * Types Test
 * Basic tests to ensure type definitions are working correctly
 */

import { describe, it, expect } from 'vitest';
import { MCPRequest, MCPResponse, ErrorType } from '../../src/types/mcp';
import { Application, AlertPolicy, NRQLQuery } from '../../src/types/newrelic';

describe('MCP Types', () => {
  it('should create valid MCP request', () => {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: '1',
      method: 'test',
      params: { test: true },
    };

    expect(request.jsonrpc).toBe('2.0');
    expect(request.id).toBe('1');
    expect(request.method).toBe('test');
    expect(request.params).toEqual({ test: true });
  });

  it('should create valid MCP response', () => {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: '1',
      result: { success: true },
    };

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('1');
    expect(response.result).toEqual({ success: true });
  });

  it('should have all required error types', () => {
    expect(ErrorType.AUTHENTICATION_ERROR).toBe('AUTHENTICATION_ERROR');
    expect(ErrorType.AUTHORIZATION_ERROR).toBe('AUTHORIZATION_ERROR');
    expect(ErrorType.RATE_LIMIT_ERROR).toBe('RATE_LIMIT_ERROR');
    expect(ErrorType.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ErrorType.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorType.QUERY_SYNTAX_ERROR).toBe('QUERY_SYNTAX_ERROR');
    expect(ErrorType.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
    expect(ErrorType.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('NewRelic Types', () => {
  it('should create valid Application type', () => {
    const app: Application = {
      id: '123',
      name: 'Test App',
      language: 'Node.js',
      health_status: 'green',
      reporting: true,
      last_reported_at: '2024-01-01T00:00:00Z',
      application_summary: {
        response_time: 100,
        throughput: 1000,
        error_rate: 0.01,
        apdex_target: 0.5,
        apdex_score: 0.95,
      },
    };

    expect(app.id).toBe('123');
    expect(app.name).toBe('Test App');
    expect(app.health_status).toBe('green');
    expect(app.application_summary.response_time).toBe(100);
  });

  it('should create valid AlertPolicy type', () => {
    const policy: AlertPolicy = {
      id: '456',
      name: 'Test Policy',
      incident_preference: 'PER_POLICY',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(policy.id).toBe('456');
    expect(policy.name).toBe('Test Policy');
    expect(policy.incident_preference).toBe('PER_POLICY');
  });

  it('should create valid NRQL query', () => {
    const query: NRQLQuery = {
      query: 'SELECT * FROM Transaction',
      accountId: '123456',
      timeout: 30000,
      limit: 100,
    };

    expect(query.query).toBe('SELECT * FROM Transaction');
    expect(query.accountId).toBe('123456');
    expect(query.timeout).toBe(30000);
    expect(query.limit).toBe(100);
  });
});
