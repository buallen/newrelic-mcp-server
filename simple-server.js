#!/usr/bin/env node
/**
 * Simple NewRelic MCP Server for Campaign Service Analysis
 * Minimal implementation to access NewRelic incidents
 */

// Load environment variables from .env file
require('dotenv').config();

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');

// Configuration
const NEW_RELIC_API_KEY = process.env.NEWRELIC_API_KEY || process.env.NEW_RELIC_API_KEY || 'INGEST-US01xa12345678901234567890123456789abc123456';
const NEW_RELIC_ACCOUNT_ID = process.env.NEWRELIC_ACCOUNT_ID || process.env.NEW_RELIC_ACCOUNT_ID || '1234567';
const NEW_RELIC_BASE_URL = process.env.NEWRELIC_BASE_URL || process.env.NEW_RELIC_BASE_URL || 'https://api.newrelic.com/v2';
const NEW_RELIC_GRAPHQL_URL = process.env.NEWRELIC_GRAPHQL_URL || process.env.NEW_RELIC_GRAPHQL_URL || 'https://api.newrelic.com/graphql';

class SimpleNewRelicClient {
  constructor(apiKey, accountId) {
    this.apiKey = apiKey;
    this.accountId = accountId;
    this.baseUrl = NEW_RELIC_BASE_URL;
    this.graphqlUrl = NEW_RELIC_GRAPHQL_URL;
  }

  async getIncidents(filters = {}) {
    try {
      // Use GraphQL API for better reliability
      const sinceTime = filters.since || new Date(Date.now() - 24*60*60*1000).toISOString();
      const untilTime = filters.until || new Date().toISOString();
      
      const query = `
        {
          actor {
            account(id: ${this.accountId}) {
              aiIssues {
                incidents {
                  incidents {
                    incidentId
                    title
                    priority
                    state
                    description
                    updatedAt
                    createdAt
                    closedAt
                    entityGuids
                    entityNames
                    entityTypes
                  }
                }
              }
            }
          }
        }
      `;

      const response = await axios.post(this.graphqlUrl, {
        query: query
      }, {
        headers: {
          'Api-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      let incidents = response.data.data?.actor?.account?.aiIssues?.incidents?.incidents || [];
      
      // Apply filters
      if (filters.only_open) {
        incidents = incidents.filter(inc => inc.state !== 'CLOSED');
      }
      
      return incidents;
    } catch (error) {
      console.error('Failed to fetch incidents:', error.message);
      throw new Error(`NewRelic API error: ${error.message}`);
    }
  }

  async searchIncidents(searchTerm, timeRange = '24 HOURS') {
    try {
      // Use the same working query structure as getIncidents
      const query = `
        {
          actor {
            account(id: ${this.accountId}) {
              aiIssues {
                incidents {
                  incidents {
                    incidentId
                    title
                    priority
                    state
                    description
                    updatedAt
                    createdAt
                    closedAt
                    entityGuids
                    entityNames
                    entityTypes
                  }
                }
              }
            }
          }
        }
      `;

      const response = await axios.post(this.graphqlUrl, {
        query: query
      }, {
        headers: {
          'Api-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      const incidents = response.data.data?.actor?.account?.aiIssues?.incidents?.incidents || [];
      
      // Filter by search term if provided
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return incidents.filter(incident => 
          incident.title?.toLowerCase().includes(searchLower) ||
          incident.description?.some(desc => desc.toLowerCase().includes(searchLower)) ||
          incident.entity?.name?.toLowerCase().includes(searchLower)
        );
      }

      return incidents;
    } catch (error) {
      console.error('Failed to search incidents:', error.message);
      throw new Error(`NewRelic GraphQL error: ${error.message}`);
    }
  }

  async executeNRQL(query, accountId = null) {
    try {
      const targetAccountId = accountId || this.accountId;
      const graphqlQuery = `
        {
          actor {
            account(id: ${targetAccountId}) {
              nrql(query: "${query.replace(/"/g, '\\"')}") {
                results
                metadata {
                  timeWindow {
                    since
                    until
                  }
                }
              }
            }
          }
        }
      `;

      const response = await axios.post(this.graphqlUrl, {
        query: graphqlQuery
      }, {
        headers: {
          'Api-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.errors) {
        throw new Error(`NRQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data.data?.actor?.account?.nrql || { results: [] };
    } catch (error) {
      console.error('Failed to execute NRQL:', error.message);
      throw new Error(`NRQL execution error: ${error.message}`);
    }
  }
}

// Initialize the server
const server = new Server(
  {
    name: 'newrelic-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Initialize NewRelic client
const newRelicClient = new SimpleNewRelicClient(NEW_RELIC_API_KEY, NEW_RELIC_ACCOUNT_ID);

// Tool definitions
const tools = [
  {
    name: 'get-incidents',
    description: 'Get NewRelic incidents, optionally filtered',
    inputSchema: {
      type: 'object',
      properties: {
        only_open: {
          type: 'boolean',
          description: 'Only return open incidents'
        },
        since: {
          type: 'string',
          description: 'ISO timestamp for incidents since'
        },
        until: {
          type: 'string',
          description: 'ISO timestamp for incidents until'
        },
        search: {
          type: 'string',
          description: 'Search term to filter incidents'
        }
      }
    }
  },
  {
    name: 'search-campaign-incidents',
    description: 'Search for incidents related to campaign service',
    inputSchema: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'string',
          description: 'Time range for search (e.g., "24 HOURS", "7 DAYS")',
          default: '24 HOURS'
        }
      }
    }
  },
  {
    name: 'execute-nrql',
    description: 'Execute a NRQL query against NewRelic',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'NRQL query to execute'
        },
        accountId: {
          type: 'string',
          description: 'NewRelic account ID (optional)'
        }
      },
      required: ['query']
    }
  }
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'get-incidents':
        const incidents = await newRelicClient.getIncidents({
          only_open: args.only_open,
          since: args.since,
          until: args.until
        });
        
        let filteredIncidents = incidents;
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          filteredIncidents = incidents.filter(incident =>
            incident.description?.toLowerCase().includes(searchLower) ||
            incident.policy_name?.toLowerCase().includes(searchLower) ||
            incident.condition_name?.toLowerCase().includes(searchLower)
          );
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: filteredIncidents.length,
                incidents: filteredIncidents.map(incident => ({
                  id: incident.id,
                  description: incident.description,
                  state: incident.state,
                  priority: incident.priority,
                  opened_at: incident.opened_at,
                  closed_at: incident.closed_at,
                  policy_name: incident.policy_name,
                  condition_name: incident.condition_name,
                  entity_name: incident.entity_name
                }))
              }, null, 2)
            }
          ]
        };

      case 'search-campaign-incidents':
        const campaignIncidents = await newRelicClient.searchIncidents('campaign', args.timeRange);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: campaignIncidents.length,
                incidents: campaignIncidents,
                analysis: {
                  summary: `Found ${campaignIncidents.length} campaign-related incidents in the last ${args.timeRange || '24 hours'}`,
                  priorities: campaignIncidents.reduce((acc, inc) => {
                    acc[inc.priority] = (acc[inc.priority] || 0) + 1;
                    return acc;
                  }, {}),
                  states: campaignIncidents.reduce((acc, inc) => {
                    acc[inc.state] = (acc[inc.state] || 0) + 1;
                    return acc;
                  }, {})
                }
              }, null, 2)
            }
          ]
        };

      case 'execute-nrql':
        const result = await newRelicClient.executeNRQL(args.query, args.accountId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Tool ${name} error:`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name,
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('NewRelic MCP Server running on stdio');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { server, newRelicClient };