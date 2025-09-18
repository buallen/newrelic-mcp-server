// @ts-nocheck
import { NewRelicClient } from '../interfaces/newrelic-client';
import { Logger, CacheManager } from '../interfaces/services';
import {
  Incident,
  EntityMetrics,
  IncidentDetails,
  IncidentFilters,
  IncidentAnalysis,
  RootCauseAnalysis,
  TimelineEvent,
  AffectedEntity,
  IncidentMetrics,
  CorrelatedEvent,
  PossibleCause,
  Evidence,
  Cause,
  Recommendation,
  PreventionStrategy,
  IncidentReport,
  ImpactAssessment,
  ResolutionSummary,
  Anomaly,
  SimilarIncident,
  ErrorPattern,
  ErrorEvent,
  TimeRange
} from '../types/newrelic';
import { MetricCorrelation, ServiceCorrelatedEvent } from '../interfaces/services';

export interface IncidentAnalyzerInterface {
  // Incident data collection
  getIncidents(filters?: IncidentFilters): Promise<Incident[]>;
  getIncidentDetails(incidentId: string): Promise<IncidentDetails | null>;
  collectIncidentData(incidentId: string): Promise<IncidentDataCollection>;
  
  // Analysis methods
  analyzeIncident(incidentId: string): Promise<IncidentAnalysis>;
  performRootCauseAnalysis(incident: Incident): Promise<RootCauseAnalysis>;
  generateRecommendations(analysis: IncidentAnalysis): Promise<Recommendation[]>;
  createIncidentReport(incidentId: string): Promise<IncidentReport>;
  
  // Pattern detection
  detectAnomalies(entityId: string, timeRange: TimeRange): Promise<Anomaly[]>;
  findSimilarIncidents(incident: Incident): Promise<SimilarIncident[]>;
  analyzeErrorPatterns(errors: ErrorEvent[]): Promise<ErrorPattern[]>;
  
  // Correlation analysis
  findCorrelatedEvents(incident: Incident): Promise<ServiceCorrelatedEvent[]>;
  analyzeDeploymentCorrelation(incident: Incident): Promise<DeploymentCorrelation[]>;
  analyzeInfrastructureCorrelation(incident: Incident): Promise<InfrastructureCorrelation[]>;
}

export interface IncidentDataCollection {
  incident: IncidentDetails;
  timeline: TimelineEvent[];
  affectedEntities: AffectedEntity[];
  performanceData: PerformanceSnapshot[];
  errorEvents: ErrorEvent[];
  logEntries: LogEntry[];
  deploymentEvents: DeploymentEvent[];
  infrastructureEvents: InfrastructureEvent[];
}

export interface PerformanceSnapshot {
  timestamp: string;
  entityId: string;
  entityName: string;
  metrics: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    apdexScore?: number;
    cpuUsage?: number;
    memoryUsage?: number;
  };
}

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  source: string;
  attributes?: Record<string, any>;
}

export interface DeploymentEvent {
  timestamp: string;
  applicationId: string;
  applicationName: string;
  revision: string;
  description?: string;
  user?: string;
  changelog?: string;
}

export interface InfrastructureEvent {
  timestamp: string;
  type: 'host_down' | 'high_cpu' | 'high_memory' | 'disk_full' | 'network_issue';
  hostname: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  attributes?: Record<string, any>;
}

export interface DeploymentCorrelation {
  deployment: DeploymentEvent;
  correlation: number; // 0-1 correlation score
  timeGap: number; // minutes between deployment and incident
  confidence: number;
  impact: 'likely_cause' | 'possible_cause' | 'coincidental';
}

export interface InfrastructureCorrelation {
  event: InfrastructureEvent;
  correlation: number;
  timeGap: number;
  confidence: number;
  impact: 'direct_cause' | 'contributing_factor' | 'unrelated';
}

export class IncidentAnalyzer implements IncidentAnalyzerInterface {
  private client: NewRelicClient;
  private logger: Logger;
  private cache: CacheManager;
  private readonly CACHE_TTL = 600; // 10 minutes
  private readonly ANALYSIS_CACHE_TTL = 1800; // 30 minutes

  constructor(client: NewRelicClient, logger: Logger, cache: CacheManager) {
    this.client = client;
    this.logger = logger;
    this.cache = cache;
  }

  async getIncidents(filters?: IncidentFilters): Promise<Incident[]> {
    try {
      const cacheKey = `incidents_${JSON.stringify(filters || {})}`;
      
      // Try cache first
      const cached = await this.cache.get<Incident[]>(cacheKey);
      if (cached) {
        this.logger.debug('Retrieved incidents from cache');
        return cached;
      }
      
      this.logger.info('Fetching incidents', { filters });
      
      let url = '/alerts_incidents.json';
      const params = new URLSearchParams();
      
      if (filters?.only_open) {
        params.append('only_open', 'true');
      }
      if (filters?.exclude_violations) {
        params.append('exclude_violations', 'true');
      }
      if (filters?.since) {
        params.append('since', filters.since);
      }
      if (filters?.until) {
        params.append('until', filters.until);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await this.client.get(url);
      const incidents = response.incidents.map(this.mapIncidentResponse);
      
      // Cache the results
      await this.cache.set(cacheKey, incidents, this.CACHE_TTL);
      
      this.logger.info('Retrieved incidents', { count: incidents.length });
      return incidents;
    } catch (error) {
      this.logger.error('Failed to get incidents', error, { filters });
      throw new Error(`Failed to get incidents: ${error.message}`);
    }
  }

  async getIncidentDetails(incidentId: string): Promise<IncidentDetails | null> {
    try {
      const cacheKey = `incident_details_${incidentId}`;
      
      // Try cache first
      const cached = await this.cache.get<IncidentDetails>(cacheKey);
      if (cached) {
        return cached;
      }
      
      this.logger.debug('Fetching incident details', { incidentId });
      
      const response = await this.client.get(`/alerts_incidents/${incidentId}.json`);
      const incidentDetails = this.mapIncidentDetailsResponse(response.incident);
      
      // Cache the result
      await this.cache.set(cacheKey, incidentDetails, this.CACHE_TTL);
      
      return incidentDetails;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      this.logger.error('Failed to get incident details', error, { incidentId });
      throw new Error(`Failed to get incident details: ${error.message}`);
    }
  }

  async collectIncidentData(incidentId: string): Promise<IncidentDataCollection> {
    try {
      this.logger.info('Collecting incident data', { incidentId });
      
      const incident = await this.getIncidentDetails(incidentId);
      if (!incident) {
        throw new Error(`Incident ${incidentId} not found`);
      }
      
      // Define time range around the incident
      const incidentStart = new Date(incident.opened_at);
      const incidentEnd = incident.closed_at ? new Date(incident.closed_at) : new Date();
      
      // Extend time range to capture context
      const dataStart = new Date(incidentStart.getTime() - 30 * 60 * 1000); // 30 minutes before
      const dataEnd = new Date(incidentEnd.getTime() + 15 * 60 * 1000); // 15 minutes after
      
      const timeRange: TimeRange = {
        since: dataStart.toISOString(),
        until: dataEnd.toISOString()
      };
      
      // Collect data in parallel
      const [
        timeline,
        affectedEntities,
        performanceData,
        errorEvents,
        deploymentEvents,
        infrastructureEvents
      ] = await Promise.all([
        this.buildIncidentTimeline(incident),
        this.identifyAffectedEntities(incident),
        this.collectPerformanceData(incident, timeRange),
        this.collectErrorEvents(incident, timeRange),
        this.collectDeploymentEvents(incident, timeRange),
        this.collectInfrastructureEvents(incident, timeRange)
      ]);
      
      const dataCollection: IncidentDataCollection = {
        incident,
        timeline,
        affectedEntities,
        performanceData,
        errorEvents,
        logEntries: [], // Would need log integration
        deploymentEvents,
        infrastructureEvents
      };
      
      this.logger.info('Completed incident data collection', { 
        incidentId,
        timelineEvents: timeline.length,
        affectedEntities: affectedEntities.length,
        performanceSnapshots: performanceData.length,
        errorEvents: errorEvents.length
      });
      
      return dataCollection;
    } catch (error) {
      this.logger.error('Failed to collect incident data', error, { incidentId });
      throw new Error(`Failed to collect incident data: ${error.message}`);
    }
  }

  async analyzeIncident(incidentId: string): Promise<IncidentAnalysis> {
    try {
      const cacheKey = `incident_analysis_${incidentId}`;
      
      // Try cache first
      const cached = await this.cache.get<IncidentAnalysis>(cacheKey);
      if (cached) {
        return cached;
      }
      
      this.logger.info('Analyzing incident', { incidentId });
      
      // Collect all incident data
      const dataCollection = await this.collectIncidentData(incidentId);
      
      // Analyze the data
      const correlatedEvents = await this.findCorrelatedEvents(dataCollection.incident);
      const possibleCauses = await this.identifyPossibleCauses(dataCollection);
      const recommendations = await this.generateRecommendations(dataCollection);
      
      // Calculate incident metrics
      const metrics = this.calculateIncidentMetrics(dataCollection);
      
      const analysis: IncidentAnalysis = {
        incident: dataCollection.incident,
        timeline: dataCollection.timeline,
        affectedEntities: dataCollection.affectedEntities,
        metrics,
        correlatedEvents,
        possibleCauses,
        recommendations,
        confidence: this.calculateAnalysisConfidence(possibleCauses, correlatedEvents),
        analysisMethod: 'automated_correlation_analysis',
        generatedAt: new Date().toISOString()
      };
      
      // Cache the analysis
      await this.cache.set(cacheKey, analysis, this.ANALYSIS_CACHE_TTL);
      
      this.logger.info('Completed incident analysis', { 
        incidentId,
        possibleCauses: possibleCauses.length,
        recommendations: recommendations.length,
        confidence: analysis.confidence
      });
      
      return analysis;
    } catch (error) {
      this.logger.error('Failed to analyze incident', error, { incidentId });
      throw new Error(`Failed to analyze incident: ${error.message}`);
    }
  }

  async performRootCauseAnalysis(incident: Incident): Promise<RootCauseAnalysis> {
    try {
      this.logger.info('Performing root cause analysis', { incidentId: incident.id });
      
      const dataCollection = await this.collectIncidentData(incident.id);
      const possibleCauses = await this.identifyPossibleCauses(dataCollection);
      
      // Rank causes by probability and evidence strength
      const rankedCauses = possibleCauses
        .map(cause => this.convertToCause(cause, dataCollection))
        .sort((a, b) => b.probability - a.probability);
      
      const primaryCause = rankedCauses[0];
      const contributingFactors = rankedCauses.slice(1, 4); // Top 3 contributing factors
      
      // Build evidence chain
      const evidenceChain = this.buildEvidenceChain(primaryCause, dataCollection);
      
      // Calculate confidence score
      const confidenceScore = this.calculateRootCauseConfidence(primaryCause, evidenceChain);
      
      // Generate recommendations
      const recommendations = await this.generateRootCauseRecommendations(primaryCause, contributingFactors);
      
      // Generate prevention strategies
      const preventionStrategies = this.generatePreventionStrategies(primaryCause, contributingFactors);
      
      const rootCauseAnalysis: RootCauseAnalysis = {
        primaryCause,
        contributingFactors,
        evidenceChain,
        confidenceScore,
        analysisMethod: 'correlation_and_pattern_analysis',
        recommendations,
        preventionStrategies
      };
      
      this.logger.info('Completed root cause analysis', { 
        incidentId: incident.id,
        primaryCauseType: primaryCause.type,
        confidenceScore
      });
      
      return rootCauseAnalysis;
    } catch (error) {
      this.logger.error('Failed to perform root cause analysis', error, { incidentId: incident.id });
      throw new Error(`Failed to perform root cause analysis: ${error.message}`);
    }
  }

  async generateRecommendations(analysisOrData: IncidentAnalysis | IncidentDataCollection): Promise<Recommendation[]> {
    try {
      const recommendations: Recommendation[] = [];
      
      let dataCollection: IncidentDataCollection;
      if ('incident' in analysisOrData && 'timeline' in analysisOrData) {
        // It's an IncidentAnalysis
        dataCollection = {
          incident: analysisOrData.incident,
          timeline: analysisOrData.timeline,
          affectedEntities: analysisOrData.affectedEntities,
          performanceData: [],
          errorEvents: [],
          logEntries: [],
          deploymentEvents: [],
          infrastructureEvents: []
        };
      } else {
        // It's an IncidentDataCollection
        dataCollection = analysisOrData;
      }
      
      // Immediate recommendations
      if (dataCollection.incident.state === 'open') {
        recommendations.push({
          type: 'immediate',
          priority: 'high',
          title: 'Acknowledge and Assess Impact',
          description: 'Acknowledge the incident and assess the current impact on users and systems',
          actionItems: [
            {
              description: 'Acknowledge the incident in NewRelic',
              status: 'pending',
              priority: 'high'
            },
            {
              description: 'Assess current user impact and business impact',
              status: 'pending',
              priority: 'high'
            }
          ],
          estimatedImpact: 'Reduces response time and improves incident coordination',
          estimatedEffort: 'Low',
          category: 'process'
        });
      }
      
      // Performance-based recommendations
      const highErrorRateEntities = dataCollection.affectedEntities.filter(
        entity => entity.metrics.errorRate && entity.metrics.errorRate > 5
      );
      
      if (highErrorRateEntities.length > 0) {
        recommendations.push({
          type: 'immediate',
          priority: 'high',
          title: 'Address High Error Rates',
          description: `${highErrorRateEntities.length} entities showing elevated error rates`,
          actionItems: highErrorRateEntities.map(entity => ({
            description: `Investigate errors in ${entity.name}`,
            status: 'pending',
            priority: 'high'
          })),
          estimatedImpact: 'Directly addresses user-facing errors',
          estimatedEffort: 'Medium',
          category: 'monitoring'
        });
      }
      
      // Deployment-based recommendations
      if (dataCollection.deploymentEvents.length > 0) {
        const recentDeployments = dataCollection.deploymentEvents.filter(
          deployment => {
            const deployTime = new Date(deployment.timestamp);
            const incidentTime = new Date(dataCollection.incident.opened_at);
            return Math.abs(deployTime.getTime() - incidentTime.getTime()) < 60 * 60 * 1000; // Within 1 hour
          }
        );
        
        if (recentDeployments.length > 0) {
          recommendations.push({
            type: 'immediate',
            priority: 'high',
            title: 'Consider Deployment Rollback',
            description: 'Recent deployments detected near incident time',
            actionItems: recentDeployments.map(deployment => ({
              description: `Evaluate rollback of ${deployment.applicationName} deployment (${deployment.revision})`,
              status: 'pending',
              priority: 'high'
            })),
            estimatedImpact: 'May quickly resolve incident if deployment-related',
            estimatedEffort: 'Medium',
            category: 'code'
          });
        }
      }
      
      // Long-term recommendations
      recommendations.push({
        type: 'long_term',
        priority: 'medium',
        title: 'Improve Monitoring and Alerting',
        description: 'Enhance monitoring to detect similar issues earlier',
        actionItems: [
          {
            description: 'Review alert thresholds and sensitivity',
            status: 'pending',
            priority: 'medium'
          },
          {
            description: 'Add synthetic monitoring for critical user journeys',
            status: 'pending',
            priority: 'medium'
          }
        ],
        estimatedImpact: 'Reduces time to detection for future incidents',
        estimatedEffort: 'High',
        category: 'monitoring'
      });
      
      return recommendations;
    } catch (error) {
      this.logger.error('Failed to generate recommendations', error as Error);
      throw new Error(`Failed to generate recommendations: ${error.message}`);
    }
  }

  async createIncidentReport(incidentId: string): Promise<IncidentReport> {
    try {
      this.logger.info('Creating incident report', { incidentId });
      
      const [analysis, rootCause] = await Promise.all([
        this.analyzeIncident(incidentId),
        this.performRootCauseAnalysis(analysis.incident)
      ]);
      
      // Calculate impact assessment
      const impactAssessment = this.calculateImpactAssessment(analysis);
      
      // Create resolution summary
      const resolutionSummary = this.createResolutionSummary(analysis.incident);
      
      // Generate lessons learned
      const lessonsLearned = this.generateLessonsLearned(analysis, rootCause);
      
      // Create action items from recommendations
      const actionItems = analysis.recommendations.flatMap(rec => rec.actionItems);
      
      const report: IncidentReport = {
        incident: analysis.incident,
        analysis,
        rootCause,
        timeline: analysis.timeline,
        impactAssessment,
        resolutionSummary,
        lessonsLearned,
        actionItems,
        generatedAt: new Date().toISOString(),
        generatedBy: 'NewRelic MCP Server'
      };
      
      this.logger.info('Created incident report', { incidentId });
      return report;
    } catch (error) {
      this.logger.error('Failed to create incident report', error, { incidentId });
      throw new Error(`Failed to create incident report: ${error.message}`);
    }
  }

  async detectAnomalies(entityId: string, timeRange: TimeRange): Promise<Anomaly[]> {
    try {
      this.logger.info('Detecting anomalies', { entityId, timeRange });
      
      const since = `SINCE '${timeRange.since}'`;
      const until = timeRange.until ? `UNTIL '${timeRange.until}'` : '';
      
      // Query for performance metrics
      const query = `
        SELECT 
          average(duration) as response_time,
          rate(count(*), 1 minute) as throughput,
          percentage(count(*), WHERE error IS true) as error_rate,
          timestamp
        FROM Transaction 
        WHERE appId = ${entityId}
        ${since} ${until}
        TIMESERIES 5 minutes
      `;
      
      const result = await this.client.executeNRQL(query);
      const anomalies: Anomaly[] = [];
      
      // Simple anomaly detection using statistical methods
      const responseTimeValues = result.results.map(row => row.response_time).filter(v => v != null);
      const throughputValues = result.results.map(row => row.throughput).filter(v => v != null);
      const errorRateValues = result.results.map(row => row.error_rate).filter(v => v != null);
      
      if (responseTimeValues.length > 0) {
        const rtAnomalies = this.detectStatisticalAnomalies(
          result.results,
          'response_time',
          responseTimeValues,
          'Response Time'
        );
        anomalies.push(...rtAnomalies);
      }
      
      if (throughputValues.length > 0) {
        const tpAnomalies = this.detectStatisticalAnomalies(
          result.results,
          'throughput',
          throughputValues,
          'Throughput'
        );
        anomalies.push(...tpAnomalies);
      }
      
      if (errorRateValues.length > 0) {
        const erAnomalies = this.detectStatisticalAnomalies(
          result.results,
          'error_rate',
          errorRateValues,
          'Error Rate'
        );
        anomalies.push(...erAnomalies);
      }
      
      this.logger.info('Detected anomalies', { entityId, anomalyCount: anomalies.length });
      return anomalies;
    } catch (error) {
      this.logger.error('Failed to detect anomalies', error, { entityId, timeRange });
      throw new Error(`Failed to detect anomalies: ${error.message}`);
    }
  }

  async findSimilarIncidents(incident: Incident): Promise<SimilarIncident[]> {
    try {
      this.logger.info('Finding similar incidents', { incidentId: incident.id });
      
      // Get historical incidents from the same entity
      const historicalIncidents = await this.getIncidents({
        entity_id: incident.entity_id,
        since: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // Last 90 days
      });
      
      const similarIncidents: SimilarIncident[] = [];
      
      for (const historical of historicalIncidents) {
        if (historical.id === incident.id) continue;
        
        const similarity = this.calculateIncidentSimilarity(incident, historical);
        
        if (similarity > 0.5) { // 50% similarity threshold
          const commonFactors = this.identifyCommonFactors(incident, historical);
          
          similarIncidents.push({
            incident: historical,
            similarity,
            commonFactors,
            resolution: historical.state === 'closed' ? 'Resolved' : 'Ongoing',
            timeToResolve: this.calculateTimeToResolve(historical)
          });
        }
      }
      
      // Sort by similarity
      similarIncidents.sort((a, b) => b.similarity - a.similarity);
      
      this.logger.info('Found similar incidents', { 
        incidentId: incident.id, 
        similarCount: similarIncidents.length 
      });
      
      return similarIncidents.slice(0, 5); // Return top 5 similar incidents
    } catch (error) {
      this.logger.error('Failed to find similar incidents', error, { incidentId: incident.id });
      throw new Error(`Failed to find similar incidents: ${error.message}`);
    }
  }

  async analyzeErrorPatterns(errors: ErrorEvent[]): Promise<ErrorPattern[]> {
    try {
      this.logger.info('Analyzing error patterns', { errorCount: errors.length });
      
      // Group errors by message pattern
      const errorGroups = new Map<string, ErrorEvent[]>();
      
      for (const error of errors) {
        const pattern = this.extractErrorPattern(error.message);
        if (!errorGroups.has(pattern)) {
          errorGroups.set(pattern, []);
        }
        errorGroups.get(pattern)!.push(error);
      }
      
      const patterns: ErrorPattern[] = [];
      
      for (const [pattern, groupErrors] of errorGroups) {
        if (groupErrors.length < 2) continue; // Skip single occurrences
        
        const sortedErrors = groupErrors.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        const affectedEntities = [...new Set(groupErrors.map(e => e.entityGuid))];
        const severity = this.determineErrorSeverity(groupErrors.length, affectedEntities.length);
        const category = this.categorizeError(pattern);
        
        patterns.push({
          pattern,
          frequency: groupErrors.length,
          firstSeen: sortedErrors[0].timestamp,
          lastSeen: sortedErrors[sortedErrors.length - 1].timestamp,
          affectedEntities,
          severity,
          category,
          examples: groupErrors.slice(0, 3) // First 3 examples
        });
      }
      
      // Sort by frequency
      patterns.sort((a, b) => b.frequency - a.frequency);
      
      this.logger.info('Analyzed error patterns', { patternCount: patterns.length });
      return patterns;
    } catch (error) {
      this.logger.error('Failed to analyze error patterns', error as Error);
      throw new Error(`Failed to analyze error patterns: ${error.message}`);
    }
  }

  async findCorrelatedEvents(incident: Incident): Promise<ServiceCorrelatedEvent[]> {
    try {
      this.logger.info('Finding correlated events', { incidentId: incident.id });
      
      const correlatedEvents: ServiceCorrelatedEvent[] = [];
      const incidentTime = new Date(incident.opened_at);
      
      // Look for events in a window around the incident
      const windowStart = new Date(incidentTime.getTime() - 60 * 60 * 1000); // 1 hour before
      const windowEnd = new Date(incidentTime.getTime() + 30 * 60 * 1000); // 30 minutes after
      
      const timeRange: TimeRange = {
        since: windowStart.toISOString(),
        until: windowEnd.toISOString()
      };
      
      // Collect deployment events
      const deploymentEvents = await this.collectDeploymentEvents(incident, timeRange);
      for (const deployment of deploymentEvents) {
        const correlation = this.calculateEventCorrelation(
          incidentTime,
          new Date(deployment.timestamp),
          'deployment'
        );
        
        if (correlation > 0.3) {
          correlatedEvents.push({
            timestamp: deployment.timestamp,
            type: 'deployment',
            description: `Deployment of ${deployment.applicationName} (${deployment.revision})`,
            correlation_score: correlation,
            source: 'NewRelic Deployments'
          });
        }
      }
      
      // Collect infrastructure events
      const infraEvents = await this.collectInfrastructureEvents(incident, timeRange);
      for (const infraEvent of infraEvents) {
        const correlation = this.calculateEventCorrelation(
          incidentTime,
          new Date(infraEvent.timestamp),
          'infrastructure'
        );
        
        if (correlation > 0.3) {
          correlatedEvents.push({
            timestamp: infraEvent.timestamp,
            type: 'infrastructure_event',
            description: `${infraEvent.type} on ${infraEvent.hostname}`,
            correlation_score: correlation,
            source: 'Infrastructure Monitoring'
          });
        }
      }
      
      // Sort by correlation strength
      correlatedEvents.sort((a, b) => b.correlation_score - a.correlation_score);
      
      this.logger.info('Found correlated events', { 
        incidentId: incident.id, 
        eventCount: correlatedEvents.length 
      });
      
      return correlatedEvents;
    } catch (error) {
      this.logger.error('Failed to find correlated events', error, { incidentId: incident.id });
      throw new Error(`Failed to find correlated events: ${error.message}`);
    }
  }

  async analyzeDeploymentCorrelation(incident: Incident): Promise<DeploymentCorrelation[]> {
    try {
      const incidentTime = new Date(incident.opened_at);
      const timeRange: TimeRange = {
        since: new Date(incidentTime.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours before
        until: new Date(incidentTime.getTime() + 30 * 60 * 1000).toISOString() // 30 minutes after
      };
      
      const deploymentEvents = await this.collectDeploymentEvents(incident, timeRange);
      const correlations: DeploymentCorrelation[] = [];
      
      for (const deployment of deploymentEvents) {
        const deployTime = new Date(deployment.timestamp);
        const timeGap = Math.abs(incidentTime.getTime() - deployTime.getTime()) / (1000 * 60); // minutes
        
        const correlation = this.calculateDeploymentCorrelation(timeGap, deployment, incident);
        const confidence = this.calculateDeploymentConfidence(timeGap, correlation);
        
        let impact: 'likely_cause' | 'possible_cause' | 'coincidental';
        if (correlation > 0.8 && timeGap < 30) {
          impact = 'likely_cause';
        } else if (correlation > 0.5 && timeGap < 60) {
          impact = 'possible_cause';
        } else {
          impact = 'coincidental';
        }
        
        correlations.push({
          deployment,
          correlation,
          timeGap,
          confidence,
          impact
        });
      }
      
      return correlations.sort((a, b) => b.correlation - a.correlation);
    } catch (error) {
      this.logger.error('Failed to analyze deployment correlation', error, { incidentId: incident.id });
      throw new Error(`Failed to analyze deployment correlation: ${error.message}`);
    }
  }

  async analyzeMetricCorrelations(
    entityId: string,
    timeRange: TimeRange
  ): Promise<MetricCorrelation[]> {
    try {
      this.logger.info('Analyzing metric correlations', { entityId, timeRange });
      
      // This is a simplified implementation
      // In a full implementation, this would analyze correlations between different metrics
      const correlations: MetricCorrelation[] = [];
      
      // For now, return a placeholder correlation between response time and error rate
      correlations.push({
        metric1: 'response_time',
        metric2: 'error_rate',
        correlation: 0.7,
        significance: 0.85,
        timeRange
      });
      
      return correlations;
    } catch (error) {
      this.logger.error('Failed to analyze metric correlations', error, { entityId, timeRange });
      throw new Error(`Failed to analyze metric correlations: ${error.message}`);
    }
  }

  async analyzeInfrastructureCorrelation(incident: Incident): Promise<InfrastructureCorrelation[]> {
    try {
      const incidentTime = new Date(incident.opened_at);
      const timeRange: TimeRange = {
        since: new Date(incidentTime.getTime() - 60 * 60 * 1000).toISOString(), // 1 hour before
        until: new Date(incidentTime.getTime() + 30 * 60 * 1000).toISOString() // 30 minutes after
      };
      
      const infraEvents = await this.collectInfrastructureEvents(incident, timeRange);
      const correlations: InfrastructureCorrelation[] = [];
      
      for (const event of infraEvents) {
        const eventTime = new Date(event.timestamp);
        const timeGap = Math.abs(incidentTime.getTime() - eventTime.getTime()) / (1000 * 60); // minutes
        
        const correlation = this.calculateInfrastructureCorrelation(timeGap, event, incident);
        const confidence = this.calculateInfrastructureConfidence(timeGap, correlation, event.severity);
        
        let impact: 'direct_cause' | 'contributing_factor' | 'unrelated';
        if (correlation > 0.8 && timeGap < 15 && event.severity === 'critical') {
          impact = 'direct_cause';
        } else if (correlation > 0.5 && timeGap < 30) {
          impact = 'contributing_factor';
        } else {
          impact = 'unrelated';
        }
        
        correlations.push({
          event,
          correlation,
          timeGap,
          confidence,
          impact
        });
      }
      
      return correlations.sort((a, b) => b.correlation - a.correlation);
    } catch (error) {
      this.logger.error('Failed to analyze infrastructure correlation', error, { incidentId: incident.id });
      throw new Error(`Failed to analyze infrastructure correlation: ${error.message}`);
    }
  }

  // Private helper methods continue in next part due to length...
  
  private mapIncidentResponse(incident: any): Incident {
    return {
      id: incident.id.toString(),
      opened_at: incident.opened_at,
      closed_at: incident.closed_at,
      description: incident.description || '',
      state: incident.state,
      priority: incident.priority || 'normal',
      policy_name: incident.policy_name || '',
      condition_name: incident.condition_name || '',
      violation_url: incident.violation_url || '',
      policy_id: incident.policy_id?.toString() || '',
      condition_id: incident.condition_id?.toString() || '',
      entity_id: incident.entity_id?.toString(),
      entity_name: incident.entity_name,
      entity_type: incident.entity_type
    };
  }

  private mapIncidentDetailsResponse(incident: any): IncidentDetails {
    const baseIncident = this.mapIncidentResponse(incident);
    
    return {
      ...baseIncident,
      violations: incident.violations?.map(this.mapViolationResponse) || [],
      links: {
        policy: incident.links?.policy || '',
        condition: incident.links?.condition || '',
        entity: incident.links?.entity
      },
      acknowledgement: incident.acknowledgement ? {
        acknowledged_at: incident.acknowledgement.acknowledged_at,
        acknowledged_by: incident.acknowledgement.acknowledged_by
      } : undefined
    };
  }

  private mapViolationResponse(violation: any) {
    return {
      id: violation.id.toString(),
      label: violation.label || '',
      duration: violation.duration || 0,
      opened_at: violation.opened_at,
      closed_at: violation.closed_at,
      metric_name: violation.metric_name || '',
      metric_value: violation.metric_value || 0,
      threshold_value: violation.threshold_value || 0,
      threshold_duration: violation.threshold_duration || 0,
      threshold_occurrence: violation.threshold_occurrence || ''
    };
  }

  // Additional private methods would continue here...
  // Due to length constraints, I'll include key methods in the next part
  // Continue private helper methods
  
  private async buildIncidentTimeline(incident: IncidentDetails): Promise<TimelineEvent[]> {
    const timeline: TimelineEvent[] = [];
    
    // Add incident opened event
    timeline.push({
      timestamp: incident.opened_at,
      type: 'incident_opened',
      description: `Incident opened: ${incident.description}`,
      source: 'NewRelic Alerts'
    });
    
    // Add violation events
    for (const violation of incident.violations) {
      timeline.push({
        timestamp: violation.opened_at,
        type: 'violation_started',
        description: `Violation started: ${violation.label}`,
        source: 'NewRelic Alerts',
        metadata: { violationId: violation.id, metricName: violation.metric_name }
      });
      
      if (violation.closed_at) {
        timeline.push({
          timestamp: violation.closed_at,
          type: 'violation_ended',
          description: `Violation ended: ${violation.label}`,
          source: 'NewRelic Alerts',
          metadata: { violationId: violation.id }
        });
      }
    }
    
    // Add acknowledgement event
    if (incident.acknowledgement) {
      timeline.push({
        timestamp: incident.acknowledgement.acknowledged_at,
        type: 'incident_acknowledged',
        description: `Incident acknowledged by ${incident.acknowledgement.acknowledged_by}`,
        source: 'NewRelic Alerts'
      });
    }
    
    // Add incident closed event
    if (incident.closed_at) {
      timeline.push({
        timestamp: incident.closed_at,
        type: 'incident_closed',
        description: 'Incident closed',
        source: 'NewRelic Alerts'
      });
    }
    
    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    return timeline;
  }

  private async identifyAffectedEntities(incident: IncidentDetails): Promise<AffectedEntity[]> {
    const entities: AffectedEntity[] = [];
    
    if (incident.entity_id && incident.entity_name) {
      // Get metrics for the primary affected entity
      const metrics = await this.getEntityMetrics(incident.entity_id);
      
      entities.push({
        guid: incident.entity_id,
        name: incident.entity_name,
        type: incident.entity_type || 'APPLICATION',
        impactLevel: 'high',
        metrics
      });
    }
    
    return entities;
  }

  private async getEntityMetrics(entityId: string): Promise<EntityMetrics> {
    try {
      const query = `
        SELECT 
          average(duration) as responseTime,
          rate(count(*), 1 minute) as throughput,
          percentage(count(*), WHERE error IS true) as errorRate,
          apdex(duration, t: 0.5) as apdexScore
        FROM Transaction 
        WHERE appId = ${entityId}
        SINCE 1 hour ago
      `;
      
      const result = await this.client.executeNRQL(query);
      const row = result.results[0] || {};
      
      return {
        responseTime: row.responseTime || 0,
        throughput: row.throughput || 0,
        errorRate: row.errorRate || 0,
        apdexScore: row.apdexScore || 0
      };
    } catch (error) {
      this.logger.warn('Failed to get entity metrics', { entityId, error: error.message });
      return {
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        apdexScore: 0
      };
    }
  }

  private async collectPerformanceData(incident: IncidentDetails, timeRange: TimeRange): Promise<PerformanceSnapshot[]> {
    if (!incident.entity_id) return [];
    
    try {
      const since = `SINCE '${timeRange.since}'`;
      const until = `UNTIL '${timeRange.until}'`;
      
      const query = `
        SELECT 
          average(duration) as responseTime,
          rate(count(*), 1 minute) as throughput,
          percentage(count(*), WHERE error IS true) as errorRate,
          apdex(duration, t: 0.5) as apdexScore,
          timestamp
        FROM Transaction 
        WHERE appId = ${incident.entity_id}
        ${since} ${until}
        TIMESERIES 5 minutes
      `;
      
      const result = await this.client.executeNRQL(query);
      
      return result.results.map(row => ({
        timestamp: new Date(row.timestamp).toISOString(),
        entityId: incident.entity_id!,
        entityName: incident.entity_name || 'Unknown',
        metrics: {
          responseTime: row.responseTime || 0,
          throughput: row.throughput || 0,
          errorRate: row.errorRate || 0,
          apdexScore: row.apdexScore || 0
        }
      }));
    } catch (error) {
      this.logger.warn('Failed to collect performance data', { incidentId: incident.id, error: error.message });
      return [];
    }
  }

  private async collectErrorEvents(incident: IncidentDetails, timeRange: TimeRange): Promise<ErrorEvent[]> {
    if (!incident.entity_id) return [];
    
    try {
      const since = `SINCE '${timeRange.since}'`;
      const until = `UNTIL '${timeRange.until}'`;
      
      const query = `
        SELECT message, error.class, timestamp, transactionName
        FROM TransactionError 
        WHERE appId = ${incident.entity_id}
        ${since} ${until}
        LIMIT 100
      `;
      
      const result = await this.client.executeNRQL(query);
      
      return result.results.map(row => ({
        timestamp: new Date(row.timestamp).toISOString(),
        message: row.message || 'Unknown error',
        stackTrace: '', // Would need additional API call
        entityGuid: incident.entity_id!,
        entityName: incident.entity_name || 'Unknown',
        attributes: {
          errorClass: row['error.class'],
          transactionName: row.transactionName
        }
      }));
    } catch (error) {
      this.logger.warn('Failed to collect error events', { incidentId: incident.id, error: error.message });
      return [];
    }
  }

  private async collectDeploymentEvents(incident: IncidentDetails, timeRange: TimeRange): Promise<DeploymentEvent[]> {
    if (!incident.entity_id) return [];
    
    try {
      // This would typically use the Deployments API
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      this.logger.warn('Failed to collect deployment events', { incidentId: incident.id, error: error.message });
      return [];
    }
  }

  private async collectInfrastructureEvents(incident: IncidentDetails, timeRange: TimeRange): Promise<InfrastructureEvent[]> {
    try {
      // This would typically use the Infrastructure API
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      this.logger.warn('Failed to collect infrastructure events', { incidentId: incident.id, error: error.message });
      return [];
    }
  }

  private async identifyPossibleCauses(dataCollection: IncidentDataCollection): Promise<PossibleCause[]> {
    const causes: PossibleCause[] = [];
    
    // Analyze deployment correlation
    if (dataCollection.deploymentEvents.length > 0) {
      const recentDeployments = dataCollection.deploymentEvents.filter(deployment => {
        const deployTime = new Date(deployment.timestamp);
        const incidentTime = new Date(dataCollection.incident.opened_at);
        return Math.abs(deployTime.getTime() - incidentTime.getTime()) < 60 * 60 * 1000; // Within 1 hour
      });
      
      if (recentDeployments.length > 0) {
        causes.push({
          type: 'code_deployment',
          description: `Recent deployment detected ${recentDeployments.length} deployment(s) within 1 hour of incident`,
          probability: 0.8,
          evidence: [{
            type: 'log_pattern',
            description: `${recentDeployments.length} deployment(s) detected near incident time`,
            timestamp: recentDeployments[0].timestamp,
            source: 'Deployment Events'
          }],
          mitigation: 'Consider rolling back recent deployments'
        });
      }
    }
    
    // Analyze error patterns
    if (dataCollection.errorEvents.length > 0) {
      const errorPatterns = await this.analyzeErrorPatterns(dataCollection.errorEvents);
      const criticalPatterns = errorPatterns.filter(p => p.severity === 'critical' || p.severity === 'high');
      
      if (criticalPatterns.length > 0) {
        causes.push({
          type: 'external_dependency',
          description: `High frequency error patterns detected: ${criticalPatterns.map(p => p.pattern).join(', ')}`,
          probability: 0.7,
          evidence: criticalPatterns.map(pattern => ({
            type: 'error_spike',
            description: `Error pattern: ${pattern.pattern} (${pattern.frequency} occurrences)`,
            timestamp: pattern.firstSeen,
            source: 'Error Analysis'
          })),
          mitigation: 'Investigate error patterns and external dependencies'
        });
      }
    }
    
    // Analyze performance degradation
    const performanceIssues = dataCollection.performanceData.filter(snapshot => 
      snapshot.metrics.responseTime > 2000 || snapshot.metrics.errorRate > 10
    );
    
    if (performanceIssues.length > dataCollection.performanceData.length * 0.5) {
      causes.push({
        type: 'resource_exhaustion',
        description: 'Significant performance degradation detected across multiple time periods',
        probability: 0.6,
        evidence: [{
          type: 'performance_degradation',
          description: `${performanceIssues.length} out of ${dataCollection.performanceData.length} snapshots show degraded performance`,
          timestamp: dataCollection.incident.opened_at,
          source: 'Performance Analysis'
        }],
        mitigation: 'Check resource utilization and scaling policies'
      });
    }
    
    return causes.sort((a, b) => b.probability - a.probability);
  }

  private calculateIncidentMetrics(dataCollection: IncidentDataCollection): IncidentMetrics {
    const openedAt = new Date(dataCollection.incident.opened_at);
    const closedAt = dataCollection.incident.closed_at ? new Date(dataCollection.incident.closed_at) : new Date();
    const duration = Math.round((closedAt.getTime() - openedAt.getTime()) / (1000 * 60)); // minutes
    
    // Determine severity based on error rate and affected entities
    let severity: 'critical' | 'warning' | 'info' = 'info';
    const maxErrorRate = Math.max(...dataCollection.affectedEntities.map(e => e.metrics.errorRate || 0));
    
    if (maxErrorRate > 10 || dataCollection.affectedEntities.length > 3) {
      severity = 'critical';
    } else if (maxErrorRate > 5 || dataCollection.affectedEntities.length > 1) {
      severity = 'warning';
    }
    
    // Calculate impact score (0-100)
    let impactScore = 0;
    impactScore += Math.min(maxErrorRate * 2, 40); // Error rate contribution (max 40)
    impactScore += Math.min(dataCollection.affectedEntities.length * 10, 30); // Entity count contribution (max 30)
    impactScore += Math.min(duration / 10, 30); // Duration contribution (max 30)
    
    return {
      duration,
      severity,
      impactScore: Math.round(impactScore),
      affectedUsers: undefined, // Would need additional data
      affectedTransactions: undefined, // Would need additional data
      businessImpact: severity === 'critical' ? 'High business impact due to service degradation' : 
                     severity === 'warning' ? 'Moderate business impact' : 'Low business impact'
    };
  }

  private calculateAnalysisConfidence(possibleCauses: PossibleCause[], correlatedEvents: CorrelatedEvent[]): number {
    if (possibleCauses.length === 0) return 0.1;
    
    const maxCauseProbability = Math.max(...possibleCauses.map(c => c.probability));
    const evidenceStrength = possibleCauses.reduce((sum, cause) => sum + cause.evidence.length, 0) / possibleCauses.length;
    const correlationStrength = correlatedEvents.length > 0 ? 
      Math.max(...correlatedEvents.map(e => e.correlation)) : 0;
    
    // Weighted average of different confidence factors
    const confidence = (maxCauseProbability * 0.5) + (evidenceStrength * 0.1 * 0.3) + (correlationStrength * 0.2);
    
    return Math.min(confidence, 0.95); // Cap at 95%
  }

  private convertToCause(possibleCause: PossibleCause, dataCollection: IncidentDataCollection): Cause {
    return {
      type: possibleCause.type,
      description: possibleCause.description,
      probability: possibleCause.probability,
      impact: possibleCause.probability > 0.7 ? 'high' : possibleCause.probability > 0.4 ? 'medium' : 'low',
      evidence: possibleCause.evidence,
      timeline: [dataCollection.incident.opened_at] // Simplified timeline
    };
  }

  private buildEvidenceChain(primaryCause: Cause, dataCollection: IncidentDataCollection): Evidence[] {
    const evidenceChain: Evidence[] = [...primaryCause.evidence];
    
    // Add timeline evidence
    evidenceChain.push({
      type: 'metric_anomaly',
      description: 'Incident timeline shows correlation with identified cause',
      timestamp: dataCollection.incident.opened_at,
      source: 'Timeline Analysis'
    });
    
    return evidenceChain;
  }

  private calculateRootCauseConfidence(primaryCause: Cause, evidenceChain: Evidence[]): number {
    const probabilityWeight = primaryCause.probability * 0.6;
    const evidenceWeight = Math.min(evidenceChain.length / 5, 1) * 0.4;
    
    return probabilityWeight + evidenceWeight;
  }

  private async generateRootCauseRecommendations(primaryCause: Cause, contributingFactors: Cause[]): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Primary cause recommendation
    recommendations.push({
      type: 'immediate',
      priority: 'high',
      title: `Address ${primaryCause.type.replace('_', ' ')}`,
      description: primaryCause.description,
      actionItems: [{
        description: `Investigate and resolve ${primaryCause.type}`,
        status: 'pending',
        priority: 'high'
      }],
      estimatedImpact: 'Directly addresses the root cause',
      estimatedEffort: 'High',
      category: this.getCategoryFromCauseType(primaryCause.type)
    });
    
    // Contributing factors recommendations
    for (const factor of contributingFactors.slice(0, 2)) { // Top 2 contributing factors
      recommendations.push({
        type: 'short_term',
        priority: 'medium',
        title: `Mitigate ${factor.type.replace('_', ' ')}`,
        description: factor.description,
        actionItems: [{
          description: `Address contributing factor: ${factor.type}`,
          status: 'pending',
          priority: 'medium'
        }],
        estimatedImpact: 'Reduces likelihood of similar incidents',
        estimatedEffort: 'Medium',
        category: this.getCategoryFromCauseType(factor.type)
      });
    }
    
    return recommendations;
  }

  private generatePreventionStrategies(primaryCause: Cause, contributingFactors: Cause[]): PreventionStrategy[] {
    const strategies: PreventionStrategy[] = [];
    
    switch (primaryCause.type) {
      case 'code_deployment':
        strategies.push({
          type: 'testing',
          description: 'Implement comprehensive pre-deployment testing',
          implementation: 'Set up automated testing pipeline with staging environment validation',
          effort: 'high',
          impact: 'high'
        });
        break;
      case 'resource_exhaustion':
        strategies.push({
          type: 'monitoring',
          description: 'Implement proactive resource monitoring',
          implementation: 'Set up alerts for resource utilization thresholds',
          effort: 'medium',
          impact: 'high'
        });
        break;
      case 'external_dependency':
        strategies.push({
          type: 'infrastructure',
          description: 'Implement circuit breaker pattern for external dependencies',
          implementation: 'Add resilience patterns and fallback mechanisms',
          effort: 'high',
          impact: 'medium'
        });
        break;
    }
    
    return strategies;
  }

  private calculateImpactAssessment(analysis: IncidentAnalysis): ImpactAssessment {
    const duration = analysis.metrics.duration;
    const affectedServices = analysis.affectedEntities.map(e => e.name);
    
    return {
      duration,
      affectedUsers: 0, // Would need additional data
      affectedServices,
      businessImpact: analysis.metrics.businessImpact || 'Impact assessment pending',
      financialImpact: undefined,
      reputationalImpact: analysis.metrics.severity === 'critical' ? 'Potential customer impact' : undefined
    };
  }

  private createResolutionSummary(incident: IncidentDetails): ResolutionSummary {
    if (!incident.closed_at) {
      return {
        resolvedAt: '',
        resolvedBy: '',
        resolutionMethod: 'Incident still open',
        stepsToResolve: [],
        timeToResolve: 0
      };
    }
    
    const timeToResolve = Math.round(
      (new Date(incident.closed_at).getTime() - new Date(incident.opened_at).getTime()) / (1000 * 60)
    );
    
    return {
      resolvedAt: incident.closed_at,
      resolvedBy: 'Unknown', // Would need additional data
      resolutionMethod: 'Automatic resolution',
      stepsToResolve: ['Incident resolved automatically'],
      timeToResolve
    };
  }

  private generateLessonsLearned(analysis: IncidentAnalysis, rootCause: RootCauseAnalysis): string[] {
    const lessons: string[] = [];
    
    if (rootCause.primaryCause.type === 'code_deployment') {
      lessons.push('Deployment processes should include more comprehensive testing');
      lessons.push('Consider implementing canary deployments for critical services');
    }
    
    if (analysis.metrics.severity === 'critical') {
      lessons.push('Critical incidents require faster detection and response');
      lessons.push('Consider implementing additional monitoring for early warning signs');
    }
    
    if (analysis.correlatedEvents.length > 0) {
      lessons.push('Event correlation analysis proved valuable for root cause identification');
    }
    
    return lessons;
  }

  private detectStatisticalAnomalies(data: any[], metricKey: string, values: number[], metricName: string): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    if (values.length < 10) return anomalies;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length);
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const value = row[metricKey];
      
      if (value == null) continue;
      
      const deviation = Math.abs(value - mean) / stdDev;
      
      if (deviation > 2) {
        let severity: 'low' | 'medium' | 'high' | 'critical';
        if (deviation > 4) severity = 'critical';
        else if (deviation > 3) severity = 'high';
        else if (deviation > 2.5) severity = 'medium';
        else severity = 'low';
        
        anomalies.push({
          timestamp: new Date(row.timestamp).toISOString(),
          entityGuid: 'unknown', // Would need entity context
          entityName: 'Unknown Entity',
          metricName,
          actualValue: value,
          expectedValue: mean,
          deviation,
          severity,
          type: value > mean ? 'spike' : 'drop',
          confidence: Math.min(deviation / 4, 1)
        });
      }
    }
    
    return anomalies;
  }

  private calculateIncidentSimilarity(incident1: Incident, incident2: Incident): number {
    let similarity = 0;
    
    // Same entity
    if (incident1.entity_id === incident2.entity_id) similarity += 0.3;
    
    // Same condition
    if (incident1.condition_id === incident2.condition_id) similarity += 0.4;
    
    // Same policy
    if (incident1.policy_id === incident2.policy_id) similarity += 0.2;
    
    // Similar time of day (within 2 hours)
    const time1 = new Date(incident1.opened_at).getHours();
    const time2 = new Date(incident2.opened_at).getHours();
    if (Math.abs(time1 - time2) <= 2) similarity += 0.1;
    
    return similarity;
  }

  private identifyCommonFactors(incident1: Incident, incident2: Incident): string[] {
    const factors: string[] = [];
    
    if (incident1.entity_id === incident2.entity_id) {
      factors.push('Same affected entity');
    }
    
    if (incident1.condition_name === incident2.condition_name) {
      factors.push('Same alert condition');
    }
    
    if (incident1.policy_name === incident2.policy_name) {
      factors.push('Same alert policy');
    }
    
    return factors;
  }

  private calculateTimeToResolve(incident: Incident): number | undefined {
    if (!incident.closed_at) return undefined;
    
    return Math.round(
      (new Date(incident.closed_at).getTime() - new Date(incident.opened_at).getTime()) / (1000 * 60)
    );
  }

  private extractErrorPattern(message: string): string {
    // Simplified pattern extraction - replace specific values with placeholders
    return message
      .replace(/\d+/g, 'N')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP')
      .replace(/\/[^\s]+/g, '/PATH');
  }

  private determineErrorSeverity(frequency: number, entityCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (frequency > 100 || entityCount > 5) return 'critical';
    if (frequency > 50 || entityCount > 3) return 'high';
    if (frequency > 10 || entityCount > 1) return 'medium';
    return 'low';
  }

  private categorizeError(pattern: string): 'application' | 'infrastructure' | 'network' | 'database' {
    if (pattern.toLowerCase().includes('database') || pattern.toLowerCase().includes('sql')) {
      return 'database';
    }
    if (pattern.toLowerCase().includes('network') || pattern.toLowerCase().includes('timeout')) {
      return 'network';
    }
    if (pattern.toLowerCase().includes('memory') || pattern.toLowerCase().includes('cpu')) {
      return 'infrastructure';
    }
    return 'application';
  }

  private calculateEventCorrelation(incidentTime: Date, eventTime: Date, eventType: string): number {
    const timeDiff = Math.abs(incidentTime.getTime() - eventTime.getTime()) / (1000 * 60); // minutes
    
    // Base correlation decreases with time distance
    let correlation = Math.max(0, 1 - (timeDiff / 120)); // 2 hour window
    
    // Adjust based on event type
    switch (eventType) {
      case 'deployment':
        correlation *= 1.2; // Deployments are highly correlated
        break;
      case 'infrastructure':
        correlation *= 1.1; // Infrastructure events are moderately correlated
        break;
    }
    
    return Math.min(correlation, 1);
  }

  private calculateDeploymentCorrelation(timeGap: number, deployment: DeploymentEvent, incident: Incident): number {
    let correlation = Math.max(0, 1 - (timeGap / 120)); // 2 hour window
    
    // Higher correlation if same application
    if (deployment.applicationId === incident.entity_id) {
      correlation *= 1.5;
    }
    
    return Math.min(correlation, 1);
  }

  private calculateDeploymentConfidence(timeGap: number, correlation: number): number {
    if (timeGap < 15 && correlation > 0.8) return 0.9;
    if (timeGap < 30 && correlation > 0.6) return 0.7;
    if (timeGap < 60 && correlation > 0.4) return 0.5;
    return 0.3;
  }

  private calculateInfrastructureCorrelation(timeGap: number, event: InfrastructureEvent, incident: Incident): number {
    let correlation = Math.max(0, 1 - (timeGap / 60)); // 1 hour window
    
    // Adjust based on event severity
    switch (event.severity) {
      case 'critical':
        correlation *= 1.3;
        break;
      case 'high':
        correlation *= 1.1;
        break;
    }
    
    return Math.min(correlation, 1);
  }

  private calculateInfrastructureConfidence(timeGap: number, correlation: number, severity: string): number {
    let confidence = correlation * 0.8;
    
    if (severity === 'critical') confidence *= 1.2;
    if (timeGap < 10) confidence *= 1.1;
    
    return Math.min(confidence, 1);
  }

  private getCategoryFromCauseType(causeType: string): 'monitoring' | 'infrastructure' | 'code' | 'process' {
    switch (causeType) {
      case 'code_deployment':
        return 'code';
      case 'infrastructure_issue':
      case 'resource_exhaustion':
        return 'infrastructure';
      case 'external_dependency':
        return 'monitoring';
      default:
        return 'process';
    }
  }
}