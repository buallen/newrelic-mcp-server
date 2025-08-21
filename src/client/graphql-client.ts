/**
 * GraphQL Client
 * Specialized client for NewRelic GraphQL/NerdGraph API
 */

import axios, { AxiosInstance } from 'axios';
import { GraphQLResult, NRQLQuery, NRQLResult } from '../types/newrelic';
import { Logger } from '../interfaces/services';

export interface GraphQLClientConfig {
  endpoint: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export class GraphQLClient {
  private httpClient: AxiosInstance;

  constructor(
    private config: GraphQLClientConfig,
    private logger: Logger
  ) {
    this.httpClient = this.createHttpClient();
  }

  private createHttpClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'API-Key': this.config.apiKey,
      },
    });

    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        this.logger.debug('GraphQL request', {
          url: config.url,
          query: config.data?.query?.substring(0, 100) + '...',
        });
        return config;
      },
      (error) => {
        this.logger.error('GraphQL request interceptor error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => {
        this.logger.debug('GraphQL response received', {
          status: response.status,
          hasErrors: !!response.data?.errors,
        });
        return response;
      },
      (error) => {
        this.logger.error('GraphQL request failed', error, {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
        });
        return Promise.reject(error);
      }
    );

    return client;
  }

  async executeQuery(query: string, variables?: Record<string, unknown>): Promise<GraphQLResult> {
    try {
      const response = await this.httpClient.post('', {
        query,
        variables,
      });

      return response.data;
    } catch (error) {
      this.logger.error('GraphQL query execution failed', error as Error);
      throw error;
    }
  }

  async executeNRQL(query: NRQLQuery): Promise<NRQLResult> {
    const graphqlQuery = `
      query($accountId: Int!, $nrql: Nrql!, $timeout: Seconds) {
        actor {
          account(id: $accountId) {
            nrql(query: $nrql, timeout: $timeout) {
              results
              metadata {
                eventType
                eventTypes
                facets
                messages {
                  level
                  description
                }
                timeWindow {
                  begin
                  end
                  compareWith
                }
              }
              totalResult {
                count
              }
              performanceStats {
                inspectedCount
                omittedCount
                matchCount
                wallClockTime
              }
            }
          }
        }
      }
    `;

    const variables = {
      accountId: parseInt(query.accountId || '0', 10),
      nrql: query.query,
      timeout: query.timeout ? Math.floor(query.timeout / 1000) : undefined,
    };

    try {
      const result = await this.executeQuery(graphqlQuery, variables);

      if (result.errors) {
        throw new Error(`NRQL query failed: ${result.errors[0].message}`);
      }

      const nrqlData = result.data?.actor?.account?.nrql;
      if (!nrqlData) {
        throw new Error('No NRQL data returned');
      }

      return {
        results: nrqlData.results || [],
        metadata: {
          eventType: nrqlData.metadata?.eventType || '',
          eventTypes: nrqlData.metadata?.eventTypes || [],
          contents: nrqlData.metadata?.facets?.map((facet: string) => ({
            function: 'facet',
            attribute: facet,
            simple: true,
          })) || [],
          messages: nrqlData.metadata?.messages || [],
        },
        performanceStats: {
          inspectedCount: nrqlData.performanceStats?.inspectedCount || 0,
          omittedCount: nrqlData.performanceStats?.omittedCount || 0,
          matchCount: nrqlData.performanceStats?.matchCount || nrqlData.results?.length || 0,
          wallClockTime: nrqlData.performanceStats?.wallClockTime || 0,
          userTime: nrqlData.performanceStats?.userTime || 0,
          systemTime: nrqlData.performanceStats?.systemTime || 0,
        },
      };
    } catch (error) {
      this.logger.error('NRQL execution via GraphQL failed', error as Error, { query });
      throw error;
    }
  }

  // Entity queries
  async getEntities(entityGuids: string[]): Promise<any[]> {
    const query = `
      query($guids: [EntityGuid!]!) {
        actor {
          entities(guids: $guids) {
            guid
            name
            type
            domain
            entityType
            ... on ApmApplicationEntity {
              applicationId
              language
              runningAgentVersions {
                maxVersion
                minVersion
              }
              settings {
                apdexTarget
                serverSideConfig
              }
            }
            ... on InfrastructureHostEntity {
              hostId
              operatingSystem
            }
            ... on BrowserApplicationEntity {
              applicationId
              servingApmApplicationId
            }
          }
        }
      }
    `;

    const variables = { guids: entityGuids };

    try {
      const result = await this.executeQuery(query, variables);
      
      if (result.errors) {
        throw new Error(`Entity query failed: ${result.errors[0].message}`);
      }

      return result.data?.actor?.entities || [];
    } catch (error) {
      this.logger.error('Entity query failed', error as Error, { entityGuids });
      throw error;
    }
  }

  // Search entities
  async searchEntities(searchQuery: string, entityTypes?: string[]): Promise<any[]> {
    const query = `
      query($query: String!, $types: [EntityType]) {
        actor {
          entitySearch(query: $query, type: $types) {
            results {
              entities {
                guid
                name
                type
                domain
                entityType
                permalink
                reporting
                ... on ApmApplicationEntity {
                  applicationId
                  language
                }
                ... on InfrastructureHostEntity {
                  hostId
                }
                ... on BrowserApplicationEntity {
                  applicationId
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      query: searchQuery,
      types: entityTypes,
    };

    try {
      const result = await this.executeQuery(query, variables);
      
      if (result.errors) {
        throw new Error(`Entity search failed: ${result.errors[0].message}`);
      }

      return result.data?.actor?.entitySearch?.results?.entities || [];
    } catch (error) {
      this.logger.error('Entity search failed', error as Error, { searchQuery, entityTypes });
      throw error;
    }
  }

  // Get golden metrics for entities
  async getGoldenMetrics(entityGuids: string[], timeRange?: { since?: string; until?: string }): Promise<any[]> {
    const query = `
      query($guids: [EntityGuid!]!, $since: EpochMilliseconds, $until: EpochMilliseconds) {
        actor {
          entities(guids: $guids) {
            guid
            name
            goldenMetrics(since: $since, until: $until) {
              metrics {
                name
                displayName
                unit
                query
              }
            }
            goldenTags {
              key
              values
            }
          }
        }
      }
    `;

    const variables = {
      guids: entityGuids,
      since: timeRange?.since ? new Date(timeRange.since).getTime() : undefined,
      until: timeRange?.until ? new Date(timeRange.until).getTime() : undefined,
    };

    try {
      const result = await this.executeQuery(query, variables);
      
      if (result.errors) {
        throw new Error(`Golden metrics query failed: ${result.errors[0].message}`);
      }

      return result.data?.actor?.entities || [];
    } catch (error) {
      this.logger.error('Golden metrics query failed', error as Error, { entityGuids });
      throw error;
    }
  }

  // Get alert violations
  async getAlertViolations(entityGuids: string[], timeRange?: { since?: string; until?: string }): Promise<any[]> {
    const query = `
      query($guids: [EntityGuid!]!, $since: EpochMilliseconds, $until: EpochMilliseconds) {
        actor {
          entities(guids: $guids) {
            guid
            name
            alertViolations(since: $since, until: $until) {
              violationId
              violationUrl
              label
              level
              state
              openedAt
              closedAt
              agentUrl
              description
            }
          }
        }
      }
    `;

    const variables = {
      guids: entityGuids,
      since: timeRange?.since ? new Date(timeRange.since).getTime() : undefined,
      until: timeRange?.until ? new Date(timeRange.until).getTime() : undefined,
    };

    try {
      const result = await this.executeQuery(query, variables);
      
      if (result.errors) {
        throw new Error(`Alert violations query failed: ${result.errors[0].message}`);
      }

      return result.data?.actor?.entities || [];
    } catch (error) {
      this.logger.error('Alert violations query failed', error as Error, { entityGuids });
      throw error;
    }
  }

  // Get account information
  async getAccountInfo(accountId: number): Promise<any> {
    const query = `
      query($accountId: Int!) {
        actor {
          account(id: $accountId) {
            id
            name
            licenseKey
            reportingEventTypes
          }
        }
      }
    `;

    const variables = { accountId };

    try {
      const result = await this.executeQuery(query, variables);
      
      if (result.errors) {
        throw new Error(`Account info query failed: ${result.errors[0].message}`);
      }

      return result.data?.actor?.account;
    } catch (error) {
      this.logger.error('Account info query failed', error as Error, { accountId });
      throw error;
    }
  }

  // Get user information
  async getUserInfo(): Promise<any> {
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

    try {
      const result = await this.executeQuery(query);
      
      if (result.errors) {
        throw new Error(`User info query failed: ${result.errors[0].message}`);
      }

      return result.data?.actor?.user;
    } catch (error) {
      this.logger.error('User info query failed', error as Error);
      throw error;
    }
  }

  // Validate NRQL query
  async validateNRQL(query: string, accountId: number): Promise<{ valid: boolean; errors: string[] }> {
    const validationQuery = `
      query($accountId: Int!, $nrql: Nrql!) {
        actor {
          account(id: $accountId) {
            nrql(query: $nrql) {
              metadata {
                messages {
                  level
                  description
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      accountId,
      nrql: `${query} LIMIT 1`, // Add LIMIT 1 to minimize data transfer
    };

    try {
      const result = await this.executeQuery(validationQuery, variables);
      
      if (result.errors) {
        return {
          valid: false,
          errors: result.errors.map(error => error.message),
        };
      }

      const messages = result.data?.actor?.account?.nrql?.metadata?.messages || [];
      const errors = messages
        .filter((msg: any) => msg.level === 'ERROR')
        .map((msg: any) => msg.description);

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      this.logger.error('NRQL validation failed', error as Error, { query });
      return {
        valid: false,
        errors: [(error as Error).message],
      };
    }
  }

  // Get available event types for an account
  async getEventTypes(accountId: number): Promise<string[]> {
    const query = `
      query($accountId: Int!) {
        actor {
          account(id: $accountId) {
            reportingEventTypes
          }
        }
      }
    `;

    const variables = { accountId };

    try {
      const result = await this.executeQuery(query, variables);
      
      if (result.errors) {
        throw new Error(`Event types query failed: ${result.errors[0].message}`);
      }

      return result.data?.actor?.account?.reportingEventTypes || [];
    } catch (error) {
      this.logger.error('Event types query failed', error as Error, { accountId });
      throw error;
    }
  }

  // Update API key
  updateApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.httpClient.defaults.headers['API-Key'] = apiKey;
    this.logger.debug('GraphQL client API key updated');
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.getUserInfo();
      return true;
    } catch (error) {
      this.logger.error('GraphQL connection test failed', error as Error);
      return false;
    }
  }
}