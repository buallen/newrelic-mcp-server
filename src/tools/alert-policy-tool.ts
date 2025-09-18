/**
 * Alert Policy Tool
 * MCP tool for creating alert policies
 */

import { MCPToolCallRequest, MCPToolCallResponse } from '../types/mcp';
import { AlertManager } from '../interfaces/services';
import { AlertPolicyInput } from '../types/newrelic';

export class AlertPolicyTool {
  constructor(private alertManager: AlertManager) {}

  async execute(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    try {
      const { name, incident_preference } = request.params.arguments as {
        name: string;
        incident_preference: 'PER_POLICY' | 'PER_CONDITION' | 'PER_CONDITION_AND_TARGET';
      };

      if (!name) {
        throw new Error('Policy name is required');
      }

      if (!incident_preference) {
        throw new Error('Incident preference is required');
      }

      const policyInput: AlertPolicyInput = {
        name,
        incident_preference,
      };

      const createdPolicy = await this.alertManager.createPolicy(policyInput);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                policy: createdPolicy,
                summary: {
                  policyId: createdPolicy.id,
                  policyName: createdPolicy.name,
                  incidentPreference: createdPolicy.incident_preference,
                  createdAt: createdPolicy.created_at,
                },
                message: `Successfully created alert policy "${createdPolicy.name}" with ID ${createdPolicy.id}`,
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
              text: JSON.stringify({
                success: false,
                error: (error as Error).message,
                message: `Failed to create alert policy: ${(error as Error).message}`,
              }, null, 2),
            },
          ],
          isError: true,
        },
      };
    }
  }
}