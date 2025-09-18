/**
 * Incident Analyzer Tool
 * MCP tool for analyzing incidents
 */

import { MCPToolCallRequest, MCPToolCallResponse } from '../types/mcp';
import { IncidentAnalyzer } from '../interfaces/services';

export class IncidentAnalyzerTool {
  constructor(private incidentAnalyzer: IncidentAnalyzer) {}

  async execute(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    try {
      const { incidentId } = request.params.arguments as {
        incidentId: string;
      };

      if (!incidentId) {
        throw new Error('Incident ID is required');
      }

      const analysis = await this.incidentAnalyzer.analyzeIncident(incidentId);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                analysis: {
                  incident: {
                    id: analysis.incident.id,
                    description: analysis.incident.description,
                    state: analysis.incident.state,
                    priority: analysis.incident.priority,
                    openedAt: analysis.incident.opened_at,
                    closedAt: analysis.incident.closed_at,
                    duration: analysis.metrics.duration,
                  },
                  metrics: analysis.metrics,
                  affectedEntities: analysis.affectedEntities.map(entity => ({
                    name: entity.name,
                    type: entity.type,
                    impactLevel: entity.impactLevel,
                    metrics: entity.metrics,
                  })),
                  possibleCauses: analysis.possibleCauses.map(cause => ({
                    type: cause.type,
                    description: cause.description,
                    probability: cause.probability,
                    evidenceCount: cause.evidence.length,
                  })),
                  recommendations: analysis.recommendations.map(rec => ({
                    type: rec.type,
                    priority: rec.priority,
                    title: rec.title,
                    description: rec.description,
                    category: rec.category,
                    estimatedImpact: rec.estimatedImpact,
                    estimatedEffort: rec.estimatedEffort,
                    actionItemCount: rec.actionItems.length,
                  })),
                  confidence: analysis.confidence,
                  analysisMethod: analysis.analysisMethod,
                  generatedAt: analysis.generatedAt,
                },
                summary: {
                  incidentId: analysis.incident.id,
                  duration: analysis.metrics.duration,
                  severity: analysis.metrics.severity,
                  impactScore: analysis.metrics.impactScore,
                  possibleCausesCount: analysis.possibleCauses.length,
                  recommendationsCount: analysis.recommendations.length,
                  confidence: Math.round(analysis.confidence * 100),
                },
                message: `Successfully analyzed incident ${incidentId}. Found ${analysis.possibleCauses.length} possible causes and ${analysis.recommendations.length} recommendations with ${Math.round(analysis.confidence * 100)}% confidence.`,
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
                message: `Failed to analyze incident: ${(error as Error).message}`,
              }, null, 2),
            },
          ],
          isError: true,
        },
      };
    }
  }
}