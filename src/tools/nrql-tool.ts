/**
 * NRQL Query Tool
 * MCP tool for executing NRQL queries
 */

import { MCPToolCallRequest, MCPToolCallResponse } from '../types/mcp';
import { QueryService } from '../interfaces/services';
import { NRQLQuery } from '../types/newrelic';

export class NRQLTool {
  constructor(private queryService: QueryService) {}

  async execute(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    try {
      const { query, accountId, timeout, limit } = request.params.arguments as {
        query: string;
        accountId?: string;
        timeout?: number;
        limit?: number;
      };

      if (!query) {
        throw new Error('Query parameter is required');
      }

      const nrqlQuery: NRQLQuery = {
        query,
        accountId,
        timeout,
        limit,
      };

      const result = await this.queryService.executeQuery(nrqlQuery);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query: nrqlQuery.query,
                results: result.results,
                metadata: result.metadata,
                performanceStats: result.performanceStats,
                summary: {
                  totalResults: result.results.length,
                  executionTime: result.performanceStats.wallClockTime,
                  dataScanned: result.performanceStats.inspectedCount,
                },
              }, null, 2),
            },
          ],
          isError: false,
        },
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: `Error executing NRQL query: ${(error as Error).message}`,
            },
          ],
          isError: true,
        },
      };
    }
  }
}