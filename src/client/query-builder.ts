/**
 * Query Builder
 * Utility for building NRQL and GraphQL queries
 */

import { Logger } from '../interfaces/services';

export interface NRQLQueryOptions {
  select?: string[];
  from: string;
  where?: Record<string, any>;
  facet?: string[];
  orderBy?: string;
  limit?: number;
  since?: string;
  until?: string;
  timeseries?: string;
  compare?: string;
}

export interface GraphQLQueryOptions {
  entityGuids?: string[];
  accountId?: number;
  timeRange?: {
    since?: string;
    until?: string;
  };
  limit?: number;
}

export class QueryBuilder {
  constructor(private logger: Logger) {}

  // Build NRQL query from options
  buildNRQL(options: NRQLQueryOptions): string {
    let query = '';

    // SELECT clause
    if (options.select && options.select.length > 0) {
      query += `SELECT ${options.select.join(', ')}`;
    } else {
      query += 'SELECT *';
    }

    // FROM clause
    query += ` FROM ${options.from}`;

    // WHERE clause
    if (options.where && Object.keys(options.where).length > 0) {
      const whereConditions = this.buildWhereConditions(options.where);
      query += ` WHERE ${whereConditions}`;
    }

    // FACET clause
    if (options.facet && options.facet.length > 0) {
      query += ` FACET ${options.facet.join(', ')}`;
    }

    // TIMESERIES clause
    if (options.timeseries) {
      query += ` TIMESERIES ${options.timeseries}`;
    }

    // ORDER BY clause
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
    }

    // LIMIT clause
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    // SINCE clause
    if (options.since) {
      query += ` SINCE ${options.since}`;
    }

    // UNTIL clause
    if (options.until) {
      query += ` UNTIL ${options.until}`;
    }

    // COMPARE WITH clause
    if (options.compare) {
      query += ` COMPARE WITH ${options.compare}`;
    }

    this.logger.debug('Built NRQL query', { query, options });
    return query;
  }

  private buildWhereConditions(where: Record<string, any>): string {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(where)) {
      if (value === null) {
        conditions.push(`${key} IS NULL`);
      } else if (value === undefined) {
        conditions.push(`${key} IS NOT NULL`);
      } else if (Array.isArray(value)) {
        const quotedValues = value.map(v => this.quoteValue(v)).join(', ');
        conditions.push(`${key} IN (${quotedValues})`);
      } else if (typeof value === 'object' && value !== null) {
        // Handle operators like { $gt: 100 }, { $like: '%error%' }
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case '$gt':
              conditions.push(`${key} > ${this.quoteValue(operatorValue)}`);
              break;
            case '$gte':
              conditions.push(`${key} >= ${this.quoteValue(operatorValue)}`);
              break;
            case '$lt':
              conditions.push(`${key} < ${this.quoteValue(operatorValue)}`);
              break;
            case '$lte':
              conditions.push(`${key} <= ${this.quoteValue(operatorValue)}`);
              break;
            case '$ne':
              conditions.push(`${key} != ${this.quoteValue(operatorValue)}`);
              break;
            case '$like':
              conditions.push(`${key} LIKE ${this.quoteValue(operatorValue)}`);
              break;
            case '$not':
              conditions.push(`NOT ${key} = ${this.quoteValue(operatorValue)}`);
              break;
            default:
              this.logger.warn('Unknown operator in where clause', { operator, key, value: operatorValue });
          }
        }
      } else {
        conditions.push(`${key} = ${this.quoteValue(value)}`);
      }
    }

    return conditions.join(' AND ');
  }

  private quoteValue(value: any): string {
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    } else {
      return `'${String(value)}'`;
    }
  }

  // Build common NRQL queries
  buildApplicationMetricsQuery(appName: string, timeRange?: { since?: string; until?: string }): string {
    const options: NRQLQueryOptions = {
      select: [
        'average(duration) as avg_response_time',
        'rate(count(*), 1 minute) as throughput',
        'percentage(count(*), WHERE error IS true) as error_rate',
        'apdex(duration, t: 0.5) as apdex_score'
      ],
      from: 'Transaction',
      where: { appName },
      timeseries: '1 minute',
      since: timeRange?.since || '1 hour ago',
      until: timeRange?.until,
    };

    return this.buildNRQL(options);
  }

  buildErrorAnalysisQuery(appName: string, timeRange?: { since?: string; until?: string }): string {
    const options: NRQLQueryOptions = {
      select: [
        'count(*) as error_count',
        'latest(message) as latest_message',
        'latest(stack) as latest_stack'
      ],
      from: 'TransactionError',
      where: { appName },
      facet: ['`error.class`', '`error.message`'],
      orderBy: 'error_count DESC',
      limit: 20,
      since: timeRange?.since || '1 hour ago',
      until: timeRange?.until,
    };

    return this.buildNRQL(options);
  }

  buildSlowTransactionsQuery(appName: string, threshold: number = 1.0, timeRange?: { since?: string; until?: string }): string {
    const options: NRQLQueryOptions = {
      select: ['name', 'duration', 'timestamp'],
      from: 'Transaction',
      where: {
        appName,
        duration: { $gt: threshold }
      },
      orderBy: 'duration DESC',
      limit: 100,
      since: timeRange?.since || '1 hour ago',
      until: timeRange?.until,
    };

    return this.buildNRQL(options);
  }

  buildDatabaseQuery(appName: string, timeRange?: { since?: string; until?: string }): string {
    const options: NRQLQueryOptions = {
      select: [
        'average(databaseDuration) as avg_db_time',
        'max(databaseDuration) as max_db_time',
        'count(*) as query_count'
      ],
      from: 'Transaction',
      where: {
        appName,
        databaseDuration: { $gt: 0 }
      },
      facet: ['databaseType'],
      timeseries: '5 minutes',
      since: timeRange?.since || '1 hour ago',
      until: timeRange?.until,
    };

    return this.buildNRQL(options);
  }

  buildInfrastructureQuery(hostname?: string, timeRange?: { since?: string; until?: string }): string {
    const options: NRQLQueryOptions = {
      select: [
        'average(cpuPercent) as avg_cpu',
        'average(memoryUsedPercent) as avg_memory',
        'average(diskUsedPercent) as avg_disk'
      ],
      from: 'SystemSample',
      where: hostname ? { hostname } : undefined,
      timeseries: '1 minute',
      since: timeRange?.since || '1 hour ago',
      until: timeRange?.until,
    };

    return this.buildNRQL(options);
  }

  // Build GraphQL queries for entities
  buildEntitySearchQuery(searchTerm: string, entityTypes?: string[]): string {
    const typeFilter = entityTypes ? `, type: [${entityTypes.map(t => `"${t}"`).join(', ')}]` : '';
    
    return `
      query {
        actor {
          entitySearch(query: "${searchTerm}"${typeFilter}) {
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
                  runningAgentVersions {
                    maxVersion
                    minVersion
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
        }
      }
    `;
  }

  buildGoldenMetricsQuery(entityGuids: string[], timeRange?: { since?: string; until?: string }): string {
    const guidsArray = entityGuids.map(guid => `"${guid}"`).join(', ');
    const sinceParam = timeRange?.since ? `, since: ${new Date(timeRange.since).getTime()}` : '';
    const untilParam = timeRange?.until ? `, until: ${new Date(timeRange.until).getTime()}` : '';
    
    return `
      query {
        actor {
          entities(guids: [${guidsArray}]) {
            guid
            name
            goldenMetrics(${sinceParam}${untilParam}) {
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
  }

  // Validate NRQL query syntax
  validateNRQLSyntax(query: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic syntax validation
    if (!query.trim()) {
      errors.push('Query cannot be empty');
      return { valid: false, errors };
    }

    const upperQuery = query.toUpperCase();

    // Must start with SELECT
    if (!upperQuery.trim().startsWith('SELECT')) {
      errors.push('Query must start with SELECT');
    }

    // Must have FROM clause
    if (!upperQuery.includes(' FROM ')) {
      errors.push('Query must include FROM clause');
    }

    // Check for balanced parentheses
    const openParens = (query.match(/\(/g) || []).length;
    const closeParens = (query.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unbalanced parentheses in query');
    }

    // Check for balanced quotes
    const singleQuotes = (query.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      errors.push('Unbalanced single quotes in query');
    }

    // Check for common keywords in correct order
    const keywordOrder = ['SELECT', 'FROM', 'WHERE', 'FACET', 'TIMESERIES', 'ORDER BY', 'LIMIT', 'SINCE', 'UNTIL'];
    let lastKeywordIndex = -1;
    
    for (const keyword of keywordOrder) {
      const index = upperQuery.indexOf(keyword);
      if (index !== -1) {
        if (index < lastKeywordIndex) {
          errors.push(`Keyword ${keyword} appears in wrong order`);
        }
        lastKeywordIndex = index;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Get query suggestions based on partial input
  getQuerySuggestions(partialQuery: string): string[] {
    const suggestions: string[] = [];
    const upperPartial = partialQuery.toUpperCase().trim();

    if (!upperPartial || upperPartial === 'SELECT') {
      suggestions.push(
        'SELECT * FROM Transaction',
        'SELECT count(*) FROM Transaction',
        'SELECT average(duration) FROM Transaction',
        'SELECT percentage(count(*), WHERE error IS true) FROM Transaction'
      );
    } else if (upperPartial.includes('FROM') && !upperPartial.includes('WHERE')) {
      suggestions.push(
        `${partialQuery} WHERE appName = 'YourApp'`,
        `${partialQuery} WHERE duration > 1.0`,
        `${partialQuery} WHERE error IS true`,
        `${partialQuery} SINCE 1 hour ago`
      );
    } else if (upperPartial.includes('WHERE') && !upperPartial.includes('SINCE')) {
      suggestions.push(
        `${partialQuery} SINCE 1 hour ago`,
        `${partialQuery} SINCE 1 day ago`,
        `${partialQuery} FACET name`,
        `${partialQuery} LIMIT 100`
      );
    }

    return suggestions;
  }

  // Get common event types
  getCommonEventTypes(): string[] {
    return [
      'Transaction',
      'TransactionError',
      'PageView',
      'PageAction',
      'BrowserInteraction',
      'Mobile',
      'MobileSession',
      'MobileCrash',
      'SystemSample',
      'ProcessSample',
      'NetworkSample',
      'StorageSample',
      'InfrastructureEvent',
      'Log',
      'Span',
      'DistributedTrace',
    ];
  }

  // Get common attributes for event types
  getCommonAttributes(eventType: string): string[] {
    const attributeMap: Record<string, string[]> = {
      Transaction: [
        'appName', 'name', 'duration', 'timestamp', 'error', 'httpResponseCode',
        'databaseDuration', 'databaseCallCount', 'externalDuration', 'externalCallCount'
      ],
      TransactionError: [
        'appName', 'transactionName', 'error.class', 'error.message', 'timestamp'
      ],
      PageView: [
        'appName', 'name', 'duration', 'timestamp', 'city', 'countryCode', 'deviceType'
      ],
      SystemSample: [
        'hostname', 'cpuPercent', 'memoryUsedPercent', 'diskUsedPercent', 'timestamp'
      ],
      Log: [
        'hostname', 'message', 'level', 'timestamp', 'service', 'environment'
      ],
    };

    return attributeMap[eventType] || [];
  }
}