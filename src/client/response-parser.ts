/**
 * Response Parser
 * Utility for parsing and transforming NewRelic API responses
 */

import { 
  NRQLResult, 
  GraphQLResult, 
  Application, 
  AlertPolicy, 
  Incident,
  QueryResultRow,
  QueryMetadata,
  QueryPerformanceStats 
} from '../types/newrelic';
import { Logger } from '../interfaces/services';

export class ResponseParser {
  constructor(private logger: Logger) {}

  // Parse NRQL response from GraphQL
  parseNRQLResponse(graphqlResponse: GraphQLResult, originalQuery: string): NRQLResult {
    try {
      if (graphqlResponse.errors) {
        throw new Error(`NRQL query failed: ${graphqlResponse.errors[0].message}`);
      }

      const nrqlData = graphqlResponse.data?.actor?.account?.nrql;
      if (!nrqlData) {
        throw new Error('No NRQL data in response');
      }

      const results = this.normalizeQueryResults(nrqlData.results || []);
      const metadata = this.parseQueryMetadata(nrqlData.metadata || {});
      const performanceStats = this.parsePerformanceStats(nrqlData.performanceStats || {}, results.length);

      this.logger.debug('Parsed NRQL response', {
        resultCount: results.length,
        eventType: metadata.eventType,
        wallClockTime: performanceStats.wallClockTime,
      });

      return {
        results,
        metadata,
        performanceStats,
      };
    } catch (error) {
      this.logger.error('Failed to parse NRQL response', error as Error, { originalQuery });
      throw error;
    }
  }

  private normalizeQueryResults(results: any[]): QueryResultRow[] {
    return results.map(result => {
      const normalized: QueryResultRow = {};
      
      for (const [key, value] of Object.entries(result)) {
        // Handle nested objects and arrays
        if (value && typeof value === 'object') {
          if (Array.isArray(value)) {
            normalized[key] = value;
          } else {
            // Flatten nested objects
            normalized[key] = this.flattenObject(value);
          }
        } else {
          normalized[key] = value;
        }
      }
      
      return normalized;
    });
  }

  private flattenObject(obj: any, prefix = ''): any {
    const flattened: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }
    
    return flattened;
  }

  private parseQueryMetadata(metadata: any): QueryMetadata {
    return {
      eventType: metadata.eventType || '',
      eventTypes: metadata.eventTypes || [],
      contents: this.parseQueryContents(metadata.facets || []),
      messages: metadata.messages || [],
    };
  }

  private parseQueryContents(facets: string[]): any[] {
    return facets.map(facet => ({
      function: 'facet',
      attribute: facet,
      simple: true,
    }));
  }

  private parsePerformanceStats(stats: any, resultCount: number): QueryPerformanceStats {
    return {
      inspectedCount: stats.inspectedCount || 0,
      omittedCount: stats.omittedCount || 0,
      matchCount: stats.matchCount || resultCount,
      wallClockTime: stats.wallClockTime || 0,
      userTime: stats.userTime || 0,
      systemTime: stats.systemTime || 0,
    };
  }

  // Parse entity data from GraphQL
  parseEntityData(entities: any[]): any[] {
    return entities.map(entity => {
      const parsed = {
        guid: entity.guid,
        name: entity.name,
        type: entity.type,
        domain: entity.domain,
        entityType: entity.entityType,
        permalink: entity.permalink,
        reporting: entity.reporting,
      };

      // Add type-specific data
      if (entity.applicationId) {
        (parsed as any).applicationId = entity.applicationId;
      }
      
      if (entity.language) {
        (parsed as any).language = entity.language;
      }
      
      if (entity.hostId) {
        (parsed as any).hostId = entity.hostId;
      }
      
      if (entity.operatingSystem) {
        (parsed as any).operatingSystem = entity.operatingSystem;
      }

      return parsed;
    });
  }

  // Parse golden metrics data
  parseGoldenMetrics(entities: any[]): any[] {
    return entities.map(entity => ({
      guid: entity.guid,
      name: entity.name,
      metrics: entity.goldenMetrics?.metrics?.map((metric: any) => ({
        name: metric.name,
        displayName: metric.displayName,
        unit: metric.unit,
        query: metric.query,
      })) || [],
      tags: entity.goldenTags?.map((tag: any) => ({
        key: tag.key,
        values: tag.values,
      })) || [],
    }));
  }

  // Parse alert violations
  parseAlertViolations(entities: any[]): any[] {
    return entities.map(entity => ({
      guid: entity.guid,
      name: entity.name,
      violations: entity.alertViolations?.map((violation: any) => ({
        violationId: violation.violationId,
        violationUrl: violation.violationUrl,
        label: violation.label,
        level: violation.level,
        state: violation.state,
        openedAt: violation.openedAt,
        closedAt: violation.closedAt,
        agentUrl: violation.agentUrl,
        description: violation.description,
      })) || [],
    }));
  }

  // Transform REST API responses to consistent format
  transformApplicationResponse(restResponse: any): Application {
    const app = restResponse.application || restResponse;
    
    return {
      id: app.id?.toString() || '',
      name: app.name || '',
      language: app.language || '',
      health_status: app.health_status || 'gray',
      reporting: app.reporting || false,
      last_reported_at: app.last_reported_at || '',
      application_summary: {
        response_time: app.application_summary?.response_time || 0,
        throughput: app.application_summary?.throughput || 0,
        error_rate: app.application_summary?.error_rate || 0,
        apdex_target: app.application_summary?.apdex_target || 0.5,
        apdex_score: app.application_summary?.apdex_score || 0,
      },
    };
  }

  transformAlertPolicyResponse(restResponse: any): AlertPolicy {
    const policy = restResponse.policy || restResponse;
    
    return {
      id: policy.id?.toString() || '',
      name: policy.name || '',
      incident_preference: policy.incident_preference || 'PER_POLICY',
      created_at: policy.created_at || '',
      updated_at: policy.updated_at || '',
    };
  }

  transformIncidentResponse(restResponse: any): Incident {
    const incident = restResponse.incident || restResponse;
    
    return {
      id: incident.id?.toString() || '',
      opened_at: incident.opened_at || '',
      closed_at: incident.closed_at,
      description: incident.description || '',
      state: incident.state || 'open',
      priority: incident.priority || 'normal',
      policy_name: incident.policy_name || '',
      condition_name: incident.condition_name || '',
      violation_url: incident.violation_url || '',
      policy_id: incident.policy_id?.toString() || '',
      condition_id: incident.condition_id?.toString() || '',
      entity_id: incident.entity_id?.toString(),
      entity_name: incident.entity_name,
      entity_type: incident.entity_type,
    };
  }

  // Parse time series data
  parseTimeSeriesData(results: QueryResultRow[]): any[] {
    const timeSeriesData: any[] = [];
    
    for (const result of results) {
      if (result.timestamp || result.beginTimeSeconds) {
        const timestamp = result.timestamp || 
                         (result.beginTimeSeconds ? new Date(result.beginTimeSeconds * 1000).toISOString() : null);
        
        if (timestamp) {
          const dataPoint: any = { timestamp };
          
          // Add all numeric values as metrics
          for (const [key, value] of Object.entries(result)) {
            if (key !== 'timestamp' && key !== 'beginTimeSeconds' && typeof value === 'number') {
              dataPoint[key] = value;
            }
          }
          
          timeSeriesData.push(dataPoint);
        }
      }
    }
    
    return timeSeriesData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Parse faceted data
  parseFacetedData(results: QueryResultRow[]): any[] {
    const facetedData: any[] = [];
    
    for (const result of results) {
      const facetData: any = {};
      
      // Separate facet keys from metric values
      for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'string' && !key.includes('.')) {
          // Likely a facet key
          facetData.facet = facetData.facet || {};
          facetData.facet[key] = value;
        } else if (typeof value === 'number') {
          // Likely a metric value
          facetData.metrics = facetData.metrics || {};
          facetData.metrics[key] = value;
        }
      }
      
      if (Object.keys(facetData).length > 0) {
        facetedData.push(facetData);
      }
    }
    
    return facetedData;
  }

  // Extract error information from responses
  extractErrors(response: any): string[] {
    const errors: string[] = [];
    
    if (response.errors) {
      errors.push(...response.errors.map((error: any) => error.message || String(error)));
    }
    
    if (response.data?.actor?.account?.nrql?.metadata?.messages) {
      const errorMessages = response.data.actor.account.nrql.metadata.messages
        .filter((msg: any) => msg.level === 'ERROR')
        .map((msg: any) => msg.description);
      errors.push(...errorMessages);
    }
    
    return errors;
  }

  // Format data for display
  formatForDisplay(data: any, format: 'table' | 'json' | 'csv' = 'json'): string {
    try {
      switch (format) {
        case 'table':
          return this.formatAsTable(data);
        case 'csv':
          return this.formatAsCSV(data);
        case 'json':
        default:
          return JSON.stringify(data, null, 2);
      }
    } catch (error) {
      this.logger.error('Failed to format data for display', error as Error, { format });
      return JSON.stringify(data, null, 2);
    }
  }

  private formatAsTable(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return 'No data to display';
    }
    
    const headers = Object.keys(data[0]);
    const rows = data.map(item => headers.map(header => String(item[header] || '')));
    
    const columnWidths = headers.map((header, index) => 
      Math.max(header.length, ...rows.map(row => row[index].length))
    );
    
    const headerRow = headers.map((header, index) => 
      header.padEnd(columnWidths[index])
    ).join(' | ');
    
    const separatorRow = columnWidths.map(width => '-'.repeat(width)).join('-|-');
    
    const dataRows = rows.map(row => 
      row.map((cell, index) => cell.padEnd(columnWidths[index])).join(' | ')
    );
    
    return [headerRow, separatorRow, ...dataRows].join('\n');
  }

  private formatAsCSV(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const row = headers.map(header => {
        const value = item[header];
        const stringValue = String(value || '');
        // Escape quotes and wrap in quotes if contains comma or quote
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  }

  // Validate response structure
  validateResponse(response: any, expectedStructure: any): boolean {
    try {
      return this.validateStructure(response, expectedStructure);
    } catch (error) {
      this.logger.error('Response validation failed', error as Error);
      return false;
    }
  }

  private validateStructure(obj: any, structure: any): boolean {
    if (typeof structure === 'string') {
      return typeof obj === structure;
    }
    
    if (Array.isArray(structure)) {
      return Array.isArray(obj) && obj.every(item => this.validateStructure(item, structure[0]));
    }
    
    if (typeof structure === 'object' && structure !== null) {
      if (typeof obj !== 'object' || obj === null) {
        return false;
      }
      
      for (const [key, expectedType] of Object.entries(structure)) {
        if (!(key in obj) || !this.validateStructure(obj[key], expectedType)) {
          return false;
        }
      }
    }
    
    return true;
  }
}