#!/usr/bin/env node

/**
 * Simple NewRelic MCP Server
 * Lightweight MCP server focused on log querying with configurable LIMIT
 */

const axios = require('axios');

// Silence console output to avoid corrupting MCP JSON protocol
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

console.log = () => {};
console.warn = () => {};
console.error = () => {};

class SimpleNewRelicMCPServer {
  constructor() {
    this.apiKey = process.env.NEW_RELIC_API_KEY || process.env.NEWRELIC_API_KEY;
    this.accountId =
      process.env.NEW_RELIC_ACCOUNT_ID || process.env.NEWRELIC_ACCOUNT_ID || '464254';
    this.graphqlUrl = process.env.NEWRELIC_GRAPHQL_URL || 'https://api.newrelic.com/graphql';

    if (!this.apiKey) {
      throw new Error('NEW_RELIC_API_KEY environment variable is required');
    }
  }

  async handleRequest(requestData) {
    try {
      const request = JSON.parse(requestData);

      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        case 'tools/list':
          return this.handleToolsList(request);
        case 'tools/call':
          return this.handleToolCall(request);
        default:
          return this.createErrorResponse(request.id, -32601, 'Method not found');
      }
    } catch (error) {
      return this.createErrorResponse(null, -32700, 'Parse error');
    }
  }

  handleInitialize(request) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'newrelic-custom-mcp-server',
          version: '1.0.0',
        },
      },
    };
  }

  handleToolsList(request) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: [
          {
            name: 'nrql_query',
            description: 'Execute NRQL queries against NewRelic data with configurable limit',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The NRQL query to execute (do not include LIMIT clause)',
                },
                limit: {
                  oneOf: [
                    {
                      type: 'number',
                      description: 'Maximum number of results to return',
                      minimum: 1,
                      maximum: 10000,
                    },
                    {
                      type: 'string',
                      enum: ['MAX'],
                      description:
                        'Use MAX to get maximum possible results (up to NewRelic API limits)',
                    },
                  ],
                  default: 10,
                },
                accountId: {
                  type: 'string',
                  description: 'NewRelic account ID (optional)',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'log_query',
            description: 'Query NewRelic log data with common patterns and configurable limits',
            inputSchema: {
              type: 'object',
              properties: {
                query_type: {
                  type: 'string',
                  enum: [
                    'recent_logs',
                    'error_logs',
                    'application_logs',
                    'infrastructure_logs',
                    'custom_query',
                  ],
                  description: 'Type of log query to execute',
                },
                time_period: {
                  type: 'string',
                  enum: ['1 hour ago', '6 hours ago', '1 day ago', '3 days ago', '7 days ago'],
                  description: 'Time period for log retrieval',
                  default: '7 days ago',
                },
                limit: {
                  oneOf: [
                    {
                      type: 'number',
                      description: 'Maximum number of log entries to return',
                      minimum: 1,
                      maximum: 10000,
                    },
                    {
                      type: 'string',
                      enum: ['MAX'],
                      description:
                        'Use MAX to get maximum possible results (up to NewRelic API limits)',
                    },
                  ],
                  default: 100,
                },
                log_level: {
                  type: 'string',
                  enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'],
                  description: 'Filter logs by level (for error_logs type)',
                },
                hostname: {
                  type: 'string',
                  description: 'Filter logs by hostname',
                },
                application_name: {
                  type: 'string',
                  description: 'Filter logs by application name',
                },
                custom_nrql: {
                  type: 'string',
                  description: 'Custom NRQL query for log data (used with custom_query type)',
                },
                include_fields: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific fields to include in results',
                  default: ['timestamp', 'message', 'hostname', 'level'],
                },
              },
              required: ['query_type'],
            },
          },
        ],
      },
    };
  }

  async handleToolCall(request) {
    try {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'nrql_query':
          return await this.handleNRQLQuery(request, args);
        case 'log_query':
          return await this.handleLogQuery(request, args);
        default:
          return this.createErrorResponse(request.id, -32601, `Unknown tool: ${name}`);
      }
    } catch (error) {
      return this.createErrorResponse(request.id, -32000, error.message);
    }
  }

  async handleNRQLQuery(request, args) {
    const { query, limit = 10, accountId } = args;

    if (!query) {
      return this.createErrorResponse(request.id, -32602, 'Query parameter is required');
    }

    // Handle LIMIT logic
    let finalQuery = query;
    if (!query.toUpperCase().includes('LIMIT')) {
      if (limit === 'MAX') {
        // For MAX, use NewRelic's maximum LIMIT which is typically 2000 for most queries
        finalQuery += ` LIMIT 2000`;
      } else if (limit) {
        finalQuery += ` LIMIT ${limit}`;
      }
    }

    const result = await this.executeNRQLQuery(finalQuery, accountId || this.accountId);

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                query: finalQuery,
                results: result.results,
                metadata: result.metadata,
                performanceStats: result.performanceStats,
                summary: {
                  totalResults: result.results.length,
                  executionTime: result.performanceStats.wallClockTime,
                  dataScanned: result.performanceStats.inspectedCount,
                },
              },
              null,
              2
            ),
          },
        ],
      },
    };
  }

  async handleLogQuery(request, args) {
    const {
      query_type,
      time_period = '7 days ago',
      limit = 100,
      log_level,
      hostname,
      application_name,
      custom_nrql,
      include_fields = ['timestamp', 'message', 'hostname', 'level'],
    } = args;

    if (!query_type) {
      return this.createErrorResponse(request.id, -32602, 'query_type parameter is required');
    }

    let nrqlQuery;

    switch (query_type) {
      case 'recent_logs':
        nrqlQuery = this.buildRecentLogsQuery(
          include_fields,
          time_period,
          limit,
          hostname,
          application_name
        );
        break;
      case 'error_logs':
        nrqlQuery = this.buildErrorLogsQuery(
          include_fields,
          time_period,
          limit,
          log_level,
          hostname,
          application_name
        );
        break;
      case 'application_logs':
        nrqlQuery = this.buildApplicationLogsQuery(
          include_fields,
          time_period,
          limit,
          application_name,
          hostname
        );
        break;
      case 'infrastructure_logs':
        nrqlQuery = this.buildInfrastructureLogsQuery(include_fields, time_period, limit, hostname);
        break;
      case 'custom_query':
        if (!custom_nrql) {
          return this.createErrorResponse(
            request.id,
            -32602,
            'custom_nrql parameter required for custom_query type'
          );
        }
        nrqlQuery = custom_nrql;
        break;
      default:
        return this.createErrorResponse(
          request.id,
          -32602,
          `Unsupported query type: ${query_type}`
        );
    }

    const result = await this.executeNRQLQuery(nrqlQuery, this.accountId);

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                query_executed: nrqlQuery,
                result_count: result.results.length,
                logs: result.results,
                metadata: result.metadata,
              },
              null,
              2
            ),
          },
        ],
      },
    };
  }

  buildRecentLogsQuery(fields, timePeriod, limit, hostname, appName) {
    const selectFields = fields.join(', ');
    let whereClause = '';

    if (hostname) {
      whereClause += ` WHERE hostname = '${hostname}'`;
    }
    if (appName) {
      whereClause += whereClause ? ` AND` : ' WHERE';
      whereClause += ` apmApplicationNames LIKE '%${appName}%'`;
    }

    const finalLimit = limit === 'MAX' ? 2000 : limit;
    return `SELECT ${selectFields} FROM Log${whereClause} SINCE ${timePeriod} ORDER BY timestamp DESC LIMIT ${finalLimit}`;
  }

  buildErrorLogsQuery(fields, timePeriod, limit, logLevel, hostname, appName) {
    const selectFields = fields.join(', ');
    let whereClause = '';

    if (logLevel) {
      whereClause = ` WHERE level = '${logLevel}'`;
    } else {
      whereClause = ` WHERE level IN ('ERROR', 'CRITICAL', 'FATAL')`;
    }

    if (hostname) {
      whereClause += ` AND hostname = '${hostname}'`;
    }
    if (appName) {
      whereClause += ` AND apmApplicationNames LIKE '%${appName}%'`;
    }

    const finalLimit = limit === 'MAX' ? 2000 : limit;
    return `SELECT ${selectFields} FROM Log${whereClause} SINCE ${timePeriod} ORDER BY timestamp DESC LIMIT ${finalLimit}`;
  }

  buildApplicationLogsQuery(fields, timePeriod, limit, appName, hostname) {
    const selectFields = fields.join(', ');
    let whereClause = ' WHERE apmApplicationNames IS NOT NULL';

    if (appName) {
      whereClause += ` AND apmApplicationNames LIKE '%${appName}%'`;
    }
    if (hostname) {
      whereClause += ` AND hostname = '${hostname}'`;
    }

    const finalLimit = limit === 'MAX' ? 2000 : limit;
    return `SELECT ${selectFields} FROM Log${whereClause} SINCE ${timePeriod} ORDER BY timestamp DESC LIMIT ${finalLimit}`;
  }

  buildInfrastructureLogsQuery(fields, timePeriod, limit, hostname) {
    const selectFields = fields.join(', ');
    let whereClause = ` WHERE agentName = 'Infrastructure'`;

    if (hostname) {
      whereClause += ` AND hostname = '${hostname}'`;
    }

    const finalLimit = limit === 'MAX' ? 2000 : limit;
    return `SELECT ${selectFields} FROM Log${whereClause} SINCE ${timePeriod} ORDER BY timestamp DESC LIMIT ${finalLimit}`;
  }

  async executeNRQLQuery(query, accountId) {
    const graphqlQuery = `
      query($accountId: Int!, $nrql: Nrql!) {
        actor {
          account(id: $accountId) {
            nrql(query: $nrql) {
              results
              metadata {
                eventTypes
                facets
                messages
              }
              totalResult
            }
          }
        }
      }
    `;

    const variables = {
      accountId: parseInt(accountId),
      nrql: query,
    };

    const response = await axios.post(
      this.graphqlUrl,
      {
        query: graphqlQuery,
        variables: variables,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'API-Key': this.apiKey,
        },
        timeout: 15000,
      }
    );

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    const nrqlData = response.data.data?.actor?.account?.nrql;
    if (!nrqlData) {
      throw new Error('No data returned from NewRelic API');
    }

    return {
      results: nrqlData.results,
      metadata: nrqlData.metadata,
      performanceStats: {
        wallClockTime: 0,
        inspectedCount: nrqlData.results.length,
        omittedCount: 0,
        matchCount: nrqlData.results.length,
      },
    };
  }

  createErrorResponse(id, code, message) {
    return {
      jsonrpc: '2.0',
      id: id,
      error: {
        code: code,
        message: message,
      },
    };
  }
}

// Main execution
async function main() {
  try {
    const server = new SimpleNewRelicMCPServer();

    // Set up stdin/stdout for MCP protocol
    process.stdin.setEncoding('utf8');

    let buffer = '';

    process.stdin.on('data', async chunk => {
      buffer += chunk;
      const lines = buffer.split('\n');

      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = await server.handleRequest(line.trim());
            process.stdout.write(JSON.stringify(response) + '\n');
          } catch (error) {
            const errorResponse = server.createErrorResponse(null, -32000, error.message);
            process.stdout.write(JSON.stringify(errorResponse) + '\n');
          }
        }
      }
    });

    // Handle process termination gracefully
    process.on('SIGINT', () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));

    // Keep the process running
    process.stdin.resume();
  } catch (error) {
    originalConsole.error('Failed to start MCP server:', error.message);
    process.exit(1);
  }
}

// Start the server
main().catch(error => {
  originalConsole.error('Fatal error:', error.message);
  process.exit(1);
});
