#!/usr/bin/env node
/**
 * Demo NewRelic MCP Server for Campaign Service Analysis
 * Uses mock data to demonstrate functionality
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');

// Mock campaign service incidents data
const mockCampaignIncidents = [
  {
    incidentId: 'inc-001-campaign-timeout',
    title: 'Campaign Service gRPC Timeout',
    priority: 'CRITICAL',
    state: 'OPEN',
    description: ["Policy: 'Campaign Service Monitoring'. Condition: 'gRPC Response Time'"],
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    entity: {
      name: 'campaign-svc:8089',
      type: 'SERVICE',
    },
    rootCause: 'gRPC keep-alive timeout after 2 hours',
    metrics: {
      responseTime: 5200,
      errorRate: 15.3,
      throughput: 45,
    },
  },
  {
    incidentId: 'inc-002-campaign-memory',
    title: 'Campaign Service Memory Usage High',
    priority: 'HIGH',
    state: 'ACKNOWLEDGED',
    description: ["Policy: 'Infrastructure Monitoring'. Condition: 'Memory Usage > 85%'"],
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    entity: {
      name: 'campaign-svc',
      type: 'APPLICATION',
    },
    rootCause: 'Memory leak in batch SMS processing',
    metrics: {
      memoryUsage: 87.5,
      cpuUsage: 65.2,
      throughput: 120,
    },
  },
  {
    incidentId: 'inc-003-campaign-batch',
    title: 'Batch Campaign Creation Failures',
    priority: 'MEDIUM',
    state: 'CLOSED',
    description: ["Policy: 'Campaign API Monitoring'. Condition: 'Error Rate > 5%'"],
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    closedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    entity: {
      name: 'StoreHub Node.js Service',
      type: 'APPLICATION',
    },
    rootCause: 'createOneTimeCampaign rate limiting',
    metrics: {
      errorRate: 8.7,
      successRate: 91.3,
      throughput: 89,
    },
  },
];

const mockNRQLResults = {
  campaign_errors: {
    results: [
      { 'error.message': 'gRPC timeout', count: 45 },
      { 'error.message': 'Connection refused', count: 23 },
      { 'error.message': 'Memory allocation failed', count: 12 },
      { 'error.message': 'Rate limit exceeded', count: 8 },
    ],
    metadata: {
      timeWindow: {
        since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        until: new Date().toISOString(),
      },
    },
  },
  campaign_performance: {
    results: [
      {
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        avg_duration: 1250,
        throughput: 120,
      },
      {
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        avg_duration: 2800,
        throughput: 95,
      },
      { timestamp: new Date().toISOString(), avg_duration: 3200, throughput: 78 },
    ],
  },
};

class DemoNewRelicClient {
  constructor() {
    this.isDemo = true;
  }

  async getIncidents(filters = {}) {
    console.error('[DEMO] Fetching incidents with filters:', filters);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    let incidents = mockCampaignIncidents;

    if (filters.only_open) {
      incidents = incidents.filter(inc => inc.state === 'OPEN' || inc.state === 'ACKNOWLEDGED');
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      incidents = incidents.filter(
        inc =>
          inc.title.toLowerCase().includes(searchLower) ||
          inc.description.some(desc => desc.toLowerCase().includes(searchLower))
      );
    }

    return incidents;
  }

  async searchIncidents(searchTerm, timeRange = '24 HOURS') {
    console.error(`[DEMO] Searching incidents for "${searchTerm}" in ${timeRange}`);

    await new Promise(resolve => setTimeout(resolve, 300));

    if (searchTerm.toLowerCase().includes('campaign')) {
      return mockCampaignIncidents;
    }

    return [];
  }

  async executeNRQL(query, accountId = null) {
    console.error(`[DEMO] Executing NRQL: ${query}`);

    await new Promise(resolve => setTimeout(resolve, 400));

    // Return appropriate mock data based on query content
    if (query.toLowerCase().includes('error')) {
      return mockNRQLResults.campaign_errors;
    } else if (
      query.toLowerCase().includes('duration') ||
      query.toLowerCase().includes('performance')
    ) {
      return mockNRQLResults.campaign_performance;
    } else {
      return {
        results: [{ count: 156, timestamp: new Date().toISOString() }],
        metadata: { timeWindow: { since: '1 day ago', until: 'now' } },
      };
    }
  }
}

// Initialize the server
const server = new Server(
  {
    name: 'newrelic-mcp-server-demo',
    version: '1.0.0-demo',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize Demo NewRelic client
const newRelicClient = new DemoNewRelicClient();

// Tool definitions (same as the real server)
const tools = [
  {
    name: 'get-incidents',
    description: 'Get NewRelic incidents, optionally filtered (DEMO MODE)',
    inputSchema: {
      type: 'object',
      properties: {
        only_open: {
          type: 'boolean',
          description: 'Only return open incidents',
        },
        since: {
          type: 'string',
          description: 'ISO timestamp for incidents since',
        },
        until: {
          type: 'string',
          description: 'ISO timestamp for incidents until',
        },
        search: {
          type: 'string',
          description: 'Search term to filter incidents',
        },
      },
    },
  },
  {
    name: 'search-campaign-incidents',
    description: 'Search for incidents related to campaign service (DEMO MODE)',
    inputSchema: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'string',
          description: 'Time range for search (e.g., "24 HOURS", "7 DAYS")',
          default: '24 HOURS',
        },
      },
    },
  },
  {
    name: 'execute-nrql',
    description: 'Execute a NRQL query against NewRelic (DEMO MODE)',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'NRQL query to execute',
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
    name: 'analyze-campaign-incidents',
    description: 'Comprehensive analysis of campaign service incidents (DEMO MODE)',
    inputSchema: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'string',
          description: 'Analysis time range',
          default: '24 HOURS',
        },
      },
    },
  },
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get-incidents':
        const incidents = await newRelicClient.getIncidents({
          only_open: args.only_open,
          since: args.since,
          until: args.until,
          search: args.search,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  demo_mode: true,
                  count: incidents.length,
                  incidents: incidents.map(incident => ({
                    id: incident.incidentId,
                    title: incident.title,
                    priority: incident.priority,
                    state: incident.state,
                    description: incident.description,
                    updated_at: incident.updatedAt,
                    closed_at: incident.closedAt,
                    entity: incident.entity,
                    root_cause: incident.rootCause,
                    metrics: incident.metrics,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };

      case 'search-campaign-incidents':
        const campaignIncidents = await newRelicClient.searchIncidents('campaign', args.timeRange);

        const analysis = {
          demo_mode: true,
          count: campaignIncidents.length,
          time_range: args.timeRange || '24 HOURS',
          incidents: campaignIncidents,
          summary: {
            total_incidents: campaignIncidents.length,
            by_priority: campaignIncidents.reduce((acc, inc) => {
              acc[inc.priority] = (acc[inc.priority] || 0) + 1;
              return acc;
            }, {}),
            by_state: campaignIncidents.reduce((acc, inc) => {
              acc[inc.state] = (acc[inc.state] || 0) + 1;
              return acc;
            }, {}),
            common_issues: [
              'gRPC timeout (2小时keep-alive失效)',
              '内存使用率过高 (批量短信处理)',
              '批量操作限流',
            ],
          },
          recommendations: [
            {
              priority: 'HIGH',
              title: '优化gRPC连接配置',
              description: '将keep-alive时间从2小时调整为30秒，添加连接重建机制',
            },
            {
              priority: 'MEDIUM',
              title: '实现批量操作限流',
              description: '在createOneTimeCampaign中添加速率限制，每批处理≤100条',
            },
            {
              priority: 'MEDIUM',
              title: '内存泄漏修复',
              description: '检查批量短信处理中的内存释放，添加GC优化',
            },
          ],
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(analysis, null, 2),
            },
          ],
        };

      case 'execute-nrql':
        const result = await newRelicClient.executeNRQL(args.query, args.accountId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  demo_mode: true,
                  query: args.query,
                  ...result,
                },
                null,
                2
              ),
            },
          ],
        };

      case 'analyze-campaign-incidents':
        // Comprehensive analysis
        const allIncidents = await newRelicClient.searchIncidents('campaign', args.timeRange);
        const errorData = await newRelicClient.executeNRQL(
          "SELECT * FROM TransactionError WHERE appName LIKE '%campaign%' SINCE 1 day ago"
        );

        const comprehensiveAnalysis = {
          demo_mode: true,
          analysis_time: new Date().toISOString(),
          time_range: args.timeRange || '24 HOURS',
          executive_summary: {
            total_incidents: allIncidents.length,
            critical_incidents: allIncidents.filter(i => i.priority === 'CRITICAL').length,
            avg_resolution_time: '2.5 hours',
            primary_cause: 'gRPC连接超时',
            business_impact: '中等 - 部分campaign功能受影响',
          },
          incident_patterns: {
            by_time: '高峰期 (10AM-12PM, 2PM-4PM) 事故频率增加60%',
            by_type: {
              gRPC超时: '45%',
              内存问题: '30%',
              限流错误: '25%',
            },
            trend: '过去24小时incident数量比前一天增加35%',
          },
          technical_details: {
            affected_services: ['campaign-svc:8089', 'StoreHub Node.js Service'],
            error_patterns: errorData.results,
            performance_impact: {
              response_time_increase: '156%',
              error_rate: '8.7%',
              throughput_decrease: '34%',
            },
          },
          root_cause_analysis: {
            primary_cause: {
              title: 'gRPC Keep-alive超时配置问题',
              evidence: [
                '2小时keep-alive导致连接断开',
                'campaignSvcHelper.js中grpc.keepalive_time_ms设置过长',
                '网络抖动时连接恢复缓慢',
              ],
              confidence: '95%',
            },
            contributing_factors: [
              '批量短信处理内存泄漏',
              'createOneTimeCampaign缺乏速率限制',
              '错误重试机制不完善',
            ],
          },
          immediate_actions: [
            {
              action: '修复gRPC配置',
              priority: 'P0',
              eta: '2小时',
              owner: 'Backend Team',
            },
            {
              action: '添加监控告警',
              priority: 'P1',
              eta: '4小时',
              owner: 'DevOps Team',
            },
          ],
          preventive_measures: ['实现断路器模式', '添加结构化错误日志', '优化批量操作流程'],
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(comprehensiveAnalysis, null, 2),
            },
          ],
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
          text: JSON.stringify(
            {
              error: error.message,
              tool: name,
              demo_mode: true,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🎭 NewRelic MCP Server (DEMO MODE) running on stdio');
  console.error('💡 Using mock campaign service incident data');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { server, newRelicClient };
