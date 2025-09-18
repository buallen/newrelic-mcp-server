/**
 * Log Query Tool
 * MCP tool for querying NewRelic log data with common patterns
 */

import { 
  MCPTool, 
  MCPToolCallRequest, 
  MCPToolCallResponse,
  MCPToolInputSchema
} from '../types/mcp';
import { NewRelicClient } from '../client/newrelic-client';
import { Logger } from '../interfaces/services';
import { NRQLQuery } from '../types/newrelic';

export class LogQueryTool implements MCPTool {
  name = 'log_query';
  description = 'Query NewRelic log data with common patterns for recent time periods';

  constructor(
    private client: NewRelicClient,
    private logger: Logger
  ) {}

  get inputSchema(): MCPToolInputSchema {
    return {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: ['recent_logs', 'error_logs', 'application_logs', 'infrastructure_logs', 'custom_query'],
          description: 'Type of log query to execute'
        },
        time_period: {
          type: 'string',
          enum: ['1 hour ago', '6 hours ago', '1 day ago', '3 days ago', '7 days ago'],
          description: 'Time period for log retrieval',
          default: '7 days ago'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of log entries to return',
          default: 100,
          minimum: 1,
          maximum: 1000
        },
        log_level: {
          type: 'string',
          enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'],
          description: 'Filter logs by level (for error_logs type)'
        },
        hostname: {
          type: 'string',
          description: 'Filter logs by hostname'
        },
        application_name: {
          type: 'string',
          description: 'Filter logs by application name'
        },
        custom_nrql: {
          type: 'string',
          description: 'Custom NRQL query for log data (used with custom_query type)'
        },
        include_fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific fields to include in results',
          default: ['timestamp', 'message', 'hostname', 'level']
        }
      },
      required: ['query_type']
    };
  }

  async execute(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    try {
      const {
        query_type,
        time_period = '7 days ago',
        limit = 100,
        log_level,
        hostname,
        application_name,
        custom_nrql,
        include_fields = ['timestamp', 'message', 'hostname', 'level']
      } = request.params.arguments;

      this.logger.info('Executing log query', { query_type, time_period, limit });

      let nrqlQuery: string;

      switch (query_type) {
        case 'recent_logs':
          nrqlQuery = this.buildRecentLogsQuery(include_fields, time_period, limit, hostname, application_name);
          break;
        
        case 'error_logs':
          nrqlQuery = this.buildErrorLogsQuery(include_fields, time_period, limit, log_level, hostname, application_name);
          break;
        
        case 'application_logs':
          nrqlQuery = this.buildApplicationLogsQuery(include_fields, time_period, limit, application_name, hostname);
          break;
        
        case 'infrastructure_logs':
          nrqlQuery = this.buildInfrastructureLogsQuery(include_fields, time_period, limit, hostname);
          break;
        
        case 'custom_query':
          if (!custom_nrql) {
            throw new Error('custom_nrql parameter required for custom_query type');
          }
          nrqlQuery = custom_nrql;
          break;
        
        default:
          throw new Error(`Unsupported query type: ${query_type}`);
      }

      // Execute the query
      const query: NRQLQuery = {
        query: nrqlQuery,
        accountId: process.env.NEW_RELIC_ACCOUNT_ID || '464254'
      };

      const result = await this.client.executeNRQLQuery(query);

      this.logger.info('Log query executed successfully', { 
        resultCount: result.results.length,
        query: nrqlQuery.substring(0, 100) + '...'
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query_executed: nrqlQuery,
            result_count: result.results.length,
            logs: result.results,
            metadata: result.metadata
          }, null, 2)
        }]
      };

    } catch (error) {
      this.logger.error('Error executing log query', error);
      
      return {
        content: [{
          type: 'text', 
          text: `Error executing log query: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }

  private buildRecentLogsQuery(fields: string[], timePeriod: string, limit: number, hostname?: string, appName?: string): string {
    const selectFields = fields.join(', ');
    let whereClause = '';
    
    if (hostname) {
      whereClause += ` WHERE hostname = '${hostname}'`;
    }
    if (appName) {
      whereClause += whereClause ? ` AND` : ' WHERE';
      whereClause += ` apmApplicationNames LIKE '%${appName}%'`;
    }

    return `SELECT ${selectFields} FROM Log${whereClause} SINCE ${timePeriod} ORDER BY timestamp DESC LIMIT ${limit}`;
  }

  private buildErrorLogsQuery(fields: string[], timePeriod: string, limit: number, logLevel?: string, hostname?: string, appName?: string): string {
    const selectFields = fields.join(', ');
    let whereClause = '';
    
    // Add log level filter
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

    return `SELECT ${selectFields} FROM Log${whereClause} SINCE ${timePeriod} ORDER BY timestamp DESC LIMIT ${limit}`;
  }

  private buildApplicationLogsQuery(fields: string[], timePeriod: string, limit: number, appName?: string, hostname?: string): string {
    const selectFields = fields.join(', ');
    let whereClause = ' WHERE apmApplicationNames IS NOT NULL';
    
    if (appName) {
      whereClause += ` AND apmApplicationNames LIKE '%${appName}%'`;
    }
    if (hostname) {
      whereClause += ` AND hostname = '${hostname}'`;
    }

    return `SELECT ${selectFields} FROM Log${whereClause} SINCE ${timePeriod} ORDER BY timestamp DESC LIMIT ${limit}`;
  }

  private buildInfrastructureLogsQuery(fields: string[], timePeriod: string, limit: number, hostname?: string): string {
    const selectFields = fields.join(', ');
    let whereClause = ` WHERE agentName = 'Infrastructure'`;
    
    if (hostname) {
      whereClause += ` AND hostname = '${hostname}'`;
    }

    return `SELECT ${selectFields} FROM Log${whereClause} SINCE ${timePeriod} ORDER BY timestamp DESC LIMIT ${limit}`;
  }

  /**
   * Get common log query examples
   */
  static getQueryExamples(): Record<string, string> {
    return {
      recent_logs: "SELECT timestamp, message, hostname, level FROM Log SINCE 7 days ago ORDER BY timestamp DESC LIMIT 100",
      error_logs: "SELECT timestamp, message, hostname, level, apmApplicationNames FROM Log WHERE level IN ('ERROR', 'CRITICAL', 'FATAL') SINCE 7 days ago ORDER BY timestamp DESC LIMIT 50",
      application_logs: "SELECT timestamp, message, hostname, apmApplicationNames FROM Log WHERE apmApplicationNames IS NOT NULL SINCE 7 days ago ORDER BY timestamp DESC LIMIT 100",
      infrastructure_logs: "SELECT timestamp, message, hostname, agentName FROM Log WHERE agentName = 'Infrastructure' SINCE 7 days ago ORDER BY timestamp DESC LIMIT 100",
      log_count_by_level: "SELECT count(*) FROM Log FACET level SINCE 7 days ago",
      log_count_by_host: "SELECT count(*) FROM Log FACET hostname SINCE 7 days ago",
      log_count_by_application: "SELECT count(*) FROM Log WHERE apmApplicationNames IS NOT NULL FACET apmApplicationNames SINCE 7 days ago"
    };
  }
}