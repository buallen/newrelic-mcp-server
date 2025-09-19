import { NewRelicClient } from '../client/newrelic-client';
import { Logger } from '../utils/logger';
import { CacheManager } from './cache-manager';
import {
  TimeRange,
  RelativeTimeRange,
  NRQLResult,
  EntityMetrics,
  Application,
} from '../types/newrelic';

export interface HistoricalDataPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, any>;
}

export interface TimeSeriesData {
  metric: string;
  entity: string;
  timeRange: TimeRange;
  dataPoints: HistoricalDataPoint[];
  aggregation: 'average' | 'sum' | 'count' | 'min' | 'max';
  interval: string;
}

export interface TrendAnalysis {
  metric: string;
  entity: string;
  timeRange: TimeRange;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  trendStrength: number; // 0-1, where 1 is strongest trend
  changeRate: number; // percentage change over time period
  seasonality?: SeasonalityInfo;
  anomalies: AnomalyPoint[];
  forecast?: ForecastPoint[];
}

export interface SeasonalityInfo {
  detected: boolean;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  strength: number; // 0-1
  pattern: number[]; // normalized pattern values
}

export interface AnomalyPoint {
  timestamp: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'spike' | 'drop' | 'pattern_break';
}

export interface ForecastPoint {
  timestamp: string;
  predictedValue: number;
  confidence: number; // 0-1
  upperBound: number;
  lowerBound: number;
}

export interface DataAggregation {
  metric: string;
  entity: string;
  timeRange: TimeRange;
  aggregationType: 'hourly' | 'daily' | 'weekly' | 'monthly';
  summary: {
    min: number;
    max: number;
    average: number;
    sum: number;
    count: number;
    stdDev: number;
  };
  percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface ComparisonAnalysis {
  metric: string;
  entity: string;
  baselinePeriod: TimeRange;
  comparisonPeriod: TimeRange;
  baselineStats: DataAggregation['summary'];
  comparisonStats: DataAggregation['summary'];
  changes: {
    averageChange: number;
    minChange: number;
    maxChange: number;
    variabilityChange: number;
  };
  significance: 'high' | 'medium' | 'low' | 'none';
  insights: string[];
}

export interface HistoricalDataServiceInterface {
  // Time series data retrieval
  getTimeSeriesData(
    entityId: string,
    metric: string,
    timeRange: TimeRange,
    interval?: string
  ): Promise<TimeSeriesData>;
  getMultipleMetricsTimeSeries(
    entityId: string,
    metrics: string[],
    timeRange: TimeRange,
    interval?: string
  ): Promise<TimeSeriesData[]>;

  // Trend analysis
  analyzeTrend(entityId: string, metric: string, timeRange: TimeRange): Promise<TrendAnalysis>;
  detectAnomalies(entityId: string, metric: string, timeRange: TimeRange): Promise<AnomalyPoint[]>;

  // Data aggregation
  aggregateData(
    entityId: string,
    metric: string,
    timeRange: TimeRange,
    aggregationType: 'hourly' | 'daily' | 'weekly' | 'monthly'
  ): Promise<DataAggregation>;

  // Comparison analysis
  compareTimePeriods(
    entityId: string,
    metric: string,
    baselinePeriod: TimeRange,
    comparisonPeriod: TimeRange
  ): Promise<ComparisonAnalysis>;
  compareBetweenEntities(
    metric: string,
    entityIds: string[],
    timeRange: TimeRange
  ): Promise<EntityComparison[]>;

  // Historical insights
  getHistoricalInsights(entityId: string, timeRange: TimeRange): Promise<HistoricalInsight[]>;
  identifyPerformancePatterns(
    entityId: string,
    timeRange: TimeRange
  ): Promise<PerformancePattern[]>;

  // Data export
  exportHistoricalData(
    entityId: string,
    metrics: string[],
    timeRange: TimeRange,
    format: 'json' | 'csv'
  ): Promise<string>;
}

export interface EntityComparison {
  entityId: string;
  entityName: string;
  metric: string;
  stats: DataAggregation['summary'];
  ranking: number;
  percentileRank: number;
}

export interface HistoricalInsight {
  type:
    | 'performance_degradation'
    | 'improvement'
    | 'pattern_change'
    | 'anomaly_cluster'
    | 'seasonal_pattern';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  timeRange: TimeRange;
  affectedMetrics: string[];
  confidence: number;
  recommendations?: string[];
}

export interface PerformancePattern {
  name: string;
  description: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'irregular';
  strength: number; // 0-1
  examples: {
    timestamp: string;
    value: number;
    context?: string;
  }[];
  impact: 'positive' | 'negative' | 'neutral';
}

export class HistoricalDataService implements HistoricalDataServiceInterface {
  private client: NewRelicClient;
  private logger: Logger;
  private cache: CacheManager;
  private readonly CACHE_TTL = 1800; // 30 minutes for historical data
  private readonly LONG_CACHE_TTL = 3600; // 1 hour for aggregated data

  constructor(client: NewRelicClient, logger: Logger, cache: CacheManager) {
    this.client = client;
    this.logger = logger;
    this.cache = cache;
  }

  async getTimeSeriesData(
    entityId: string,
    metric: string,
    timeRange: TimeRange,
    interval: string = '5 minutes'
  ): Promise<TimeSeriesData> {
    try {
      const cacheKey = `timeseries_${entityId}_${metric}_${this.getTimeRangeKey(timeRange)}_${interval}`;

      // Try cache first
      const cached = await this.cache.get<TimeSeriesData>(cacheKey);
      if (cached) {
        this.logger.debug('Retrieved time series data from cache', { entityId, metric });
        return cached;
      }

      this.logger.info('Fetching time series data', { entityId, metric, timeRange, interval });

      const since = `SINCE '${timeRange.since}'`;
      const until = timeRange.until ? `UNTIL '${timeRange.until}'` : '';

      const query = `
        SELECT ${this.getMetricFunction(metric)} as value
        FROM Transaction 
        WHERE appId = ${entityId}
        ${since} ${until}
        TIMESERIES ${interval}
      `;

      const result = await this.client.executeNRQL(query);
      const dataPoints = this.extractTimeSeriesPoints(result);

      const timeSeriesData: TimeSeriesData = {
        metric,
        entity: entityId,
        timeRange,
        dataPoints,
        aggregation: this.getAggregationType(metric),
        interval,
      };

      // Cache the results
      await this.cache.set(cacheKey, timeSeriesData, this.CACHE_TTL);

      this.logger.info('Retrieved time series data', {
        entityId,
        metric,
        pointCount: dataPoints.length,
      });
      return timeSeriesData;
    } catch (error) {
      this.logger.error('Failed to get time series data', error, { entityId, metric, timeRange });
      throw new Error(`Failed to get time series data: ${error.message}`);
    }
  }

  async getMultipleMetricsTimeSeries(
    entityId: string,
    metrics: string[],
    timeRange: TimeRange,
    interval: string = '5 minutes'
  ): Promise<TimeSeriesData[]> {
    try {
      this.logger.info('Fetching multiple metrics time series', { entityId, metrics, timeRange });

      const promises = metrics.map(metric =>
        this.getTimeSeriesData(entityId, metric, timeRange, interval)
      );

      const results = await Promise.all(promises);

      this.logger.info('Retrieved multiple metrics time series', {
        entityId,
        metricCount: metrics.length,
      });
      return results;
    } catch (error) {
      this.logger.error('Failed to get multiple metrics time series', error, {
        entityId,
        metrics,
        timeRange,
      });
      throw new Error(`Failed to get multiple metrics time series: ${error.message}`);
    }
  }

  async analyzeTrend(
    entityId: string,
    metric: string,
    timeRange: TimeRange
  ): Promise<TrendAnalysis> {
    try {
      const cacheKey = `trend_analysis_${entityId}_${metric}_${this.getTimeRangeKey(timeRange)}`;

      // Try cache first
      const cached = await this.cache.get<TrendAnalysis>(cacheKey);
      if (cached) {
        return cached;
      }

      this.logger.info('Analyzing trend', { entityId, metric, timeRange });

      // Get time series data
      const timeSeriesData = await this.getTimeSeriesData(entityId, metric, timeRange, '1 hour');

      if (timeSeriesData.dataPoints.length < 3) {
        throw new Error('Insufficient data points for trend analysis');
      }

      // Calculate trend
      const trend = this.calculateTrend(timeSeriesData.dataPoints);
      const anomalies = this.detectAnomaliesInData(timeSeriesData.dataPoints);
      const seasonality = this.detectSeasonality(timeSeriesData.dataPoints);

      const trendAnalysis: TrendAnalysis = {
        metric,
        entity: entityId,
        timeRange,
        trend: trend.direction,
        trendStrength: trend.strength,
        changeRate: trend.changeRate,
        seasonality,
        anomalies,
      };

      // Cache the results
      await this.cache.set(cacheKey, trendAnalysis, this.LONG_CACHE_TTL);

      this.logger.info('Completed trend analysis', {
        entityId,
        metric,
        trend: trend.direction,
        strength: trend.strength,
      });

      return trendAnalysis;
    } catch (error) {
      this.logger.error('Failed to analyze trend', error, { entityId, metric, timeRange });
      throw new Error(`Failed to analyze trend: ${error.message}`);
    }
  }

  async detectAnomalies(
    entityId: string,
    metric: string,
    timeRange: TimeRange
  ): Promise<AnomalyPoint[]> {
    try {
      this.logger.info('Detecting anomalies', { entityId, metric, timeRange });

      const timeSeriesData = await this.getTimeSeriesData(entityId, metric, timeRange, '5 minutes');
      const anomalies = this.detectAnomaliesInData(timeSeriesData.dataPoints);

      this.logger.info('Detected anomalies', { entityId, metric, anomalyCount: anomalies.length });
      return anomalies;
    } catch (error) {
      this.logger.error('Failed to detect anomalies', error, { entityId, metric, timeRange });
      throw new Error(`Failed to detect anomalies: ${error.message}`);
    }
  }

  async aggregateData(
    entityId: string,
    metric: string,
    timeRange: TimeRange,
    aggregationType: 'hourly' | 'daily' | 'weekly' | 'monthly'
  ): Promise<DataAggregation> {
    try {
      const cacheKey = `aggregation_${entityId}_${metric}_${this.getTimeRangeKey(timeRange)}_${aggregationType}`;

      // Try cache first
      const cached = await this.cache.get<DataAggregation>(cacheKey);
      if (cached) {
        return cached;
      }

      this.logger.info('Aggregating data', { entityId, metric, timeRange, aggregationType });

      const interval = this.getIntervalForAggregation(aggregationType);
      const timeSeriesData = await this.getTimeSeriesData(entityId, metric, timeRange, interval);

      const values = timeSeriesData.dataPoints.map(point => point.value).filter(v => !isNaN(v));

      if (values.length === 0) {
        throw new Error('No valid data points found for aggregation');
      }

      const sortedValues = [...values].sort((a, b) => a - b);
      const summary = {
        min: Math.min(...values),
        max: Math.max(...values),
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        sum: values.reduce((sum, val) => sum + val, 0),
        count: values.length,
        stdDev: this.calculateStandardDeviation(values),
      };

      const percentiles = {
        p50: this.calculatePercentile(sortedValues, 50),
        p75: this.calculatePercentile(sortedValues, 75),
        p90: this.calculatePercentile(sortedValues, 90),
        p95: this.calculatePercentile(sortedValues, 95),
        p99: this.calculatePercentile(sortedValues, 99),
      };

      const aggregation: DataAggregation = {
        metric,
        entity: entityId,
        timeRange,
        aggregationType,
        summary,
        percentiles,
      };

      // Cache the results
      await this.cache.set(cacheKey, aggregation, this.LONG_CACHE_TTL);

      this.logger.info('Completed data aggregation', { entityId, metric, aggregationType });
      return aggregation;
    } catch (error) {
      this.logger.error('Failed to aggregate data', error, {
        entityId,
        metric,
        timeRange,
        aggregationType,
      });
      throw new Error(`Failed to aggregate data: ${error.message}`);
    }
  }

  async compareTimePeriods(
    entityId: string,
    metric: string,
    baselinePeriod: TimeRange,
    comparisonPeriod: TimeRange
  ): Promise<ComparisonAnalysis> {
    try {
      this.logger.info('Comparing time periods', {
        entityId,
        metric,
        baselinePeriod,
        comparisonPeriod,
      });

      const [baselineAgg, comparisonAgg] = await Promise.all([
        this.aggregateData(entityId, metric, baselinePeriod, 'hourly'),
        this.aggregateData(entityId, metric, comparisonPeriod, 'hourly'),
      ]);

      const changes = {
        averageChange: this.calculatePercentageChange(
          baselineAgg.summary.average,
          comparisonAgg.summary.average
        ),
        minChange: this.calculatePercentageChange(
          baselineAgg.summary.min,
          comparisonAgg.summary.min
        ),
        maxChange: this.calculatePercentageChange(
          baselineAgg.summary.max,
          comparisonAgg.summary.max
        ),
        variabilityChange: this.calculatePercentageChange(
          baselineAgg.summary.stdDev,
          comparisonAgg.summary.stdDev
        ),
      };

      const significance = this.determineSignificance(changes);
      const insights = this.generateComparisonInsights(changes, significance);

      const comparison: ComparisonAnalysis = {
        metric,
        entity: entityId,
        baselinePeriod,
        comparisonPeriod,
        baselineStats: baselineAgg.summary,
        comparisonStats: comparisonAgg.summary,
        changes,
        significance,
        insights,
      };

      this.logger.info('Completed time period comparison', { entityId, metric, significance });
      return comparison;
    } catch (error) {
      this.logger.error('Failed to compare time periods', error, { entityId, metric });
      throw new Error(`Failed to compare time periods: ${error.message}`);
    }
  }

  async compareBetweenEntities(
    metric: string,
    entityIds: string[],
    timeRange: TimeRange
  ): Promise<EntityComparison[]> {
    try {
      this.logger.info('Comparing between entities', { metric, entityIds, timeRange });

      const aggregations = await Promise.all(
        entityIds.map(entityId => this.aggregateData(entityId, metric, timeRange, 'hourly'))
      );

      // Sort by average value for ranking
      const sortedAggregations = aggregations
        .map((agg, index) => ({ agg, entityId: entityIds[index] }))
        .sort((a, b) => b.agg.summary.average - a.agg.summary.average);

      const comparisons: EntityComparison[] = sortedAggregations.map((item, index) => ({
        entityId: item.entityId,
        entityName: `Entity ${item.entityId}`, // Would need to resolve actual name
        metric,
        stats: item.agg.summary,
        ranking: index + 1,
        percentileRank: ((sortedAggregations.length - index) / sortedAggregations.length) * 100,
      }));

      this.logger.info('Completed entity comparison', { metric, entityCount: entityIds.length });
      return comparisons;
    } catch (error) {
      this.logger.error('Failed to compare between entities', error, { metric, entityIds });
      throw new Error(`Failed to compare between entities: ${error.message}`);
    }
  }

  async getHistoricalInsights(
    entityId: string,
    timeRange: TimeRange
  ): Promise<HistoricalInsight[]> {
    try {
      this.logger.info('Generating historical insights', { entityId, timeRange });

      const insights: HistoricalInsight[] = [];
      const metrics = ['response_time', 'throughput', 'error_rate'];

      for (const metric of metrics) {
        try {
          const trendAnalysis = await this.analyzeTrend(entityId, metric, timeRange);

          // Generate insights based on trend analysis
          if (trendAnalysis.trendStrength > 0.7) {
            const insight: HistoricalInsight = {
              type:
                trendAnalysis.trend === 'increasing' ? 'performance_degradation' : 'improvement',
              title: `${metric} showing ${trendAnalysis.trend} trend`,
              description: `${metric} has been ${trendAnalysis.trend} with ${(trendAnalysis.trendStrength * 100).toFixed(1)}% confidence over the selected time period`,
              severity: this.determineSeverityFromTrend(
                metric,
                trendAnalysis.trend,
                trendAnalysis.changeRate
              ),
              timeRange,
              affectedMetrics: [metric],
              confidence: trendAnalysis.trendStrength,
            };

            insights.push(insight);
          }

          // Generate insights for anomalies
          if (trendAnalysis.anomalies.length > 0) {
            const criticalAnomalies = trendAnalysis.anomalies.filter(
              a => a.severity === 'critical' || a.severity === 'high'
            );

            if (criticalAnomalies.length > 0) {
              const insight: HistoricalInsight = {
                type: 'anomaly_cluster',
                title: `${criticalAnomalies.length} significant anomalies detected in ${metric}`,
                description: `Multiple anomalies detected in ${metric}, indicating potential performance issues or unusual patterns`,
                severity: 'warning',
                timeRange,
                affectedMetrics: [metric],
                confidence: 0.8,
                recommendations: [
                  'Investigate the root cause of anomalies',
                  'Check for correlations with deployments or external events',
                  'Consider setting up alerts for similar patterns',
                ],
              };

              insights.push(insight);
            }
          }
        } catch (error) {
          this.logger.warn('Failed to analyze metric for insights', {
            entityId,
            metric,
            error: error.message,
          });
        }
      }

      this.logger.info('Generated historical insights', {
        entityId,
        insightCount: insights.length,
      });
      return insights;
    } catch (error) {
      this.logger.error('Failed to get historical insights', error, { entityId, timeRange });
      throw new Error(`Failed to get historical insights: ${error.message}`);
    }
  }

  async identifyPerformancePatterns(
    entityId: string,
    timeRange: TimeRange
  ): Promise<PerformancePattern[]> {
    try {
      this.logger.info('Identifying performance patterns', { entityId, timeRange });

      const patterns: PerformancePattern[] = [];
      const timeSeriesData = await this.getTimeSeriesData(
        entityId,
        'response_time',
        timeRange,
        '1 hour'
      );

      // Detect daily patterns
      const dailyPattern = this.detectDailyPattern(timeSeriesData.dataPoints);
      if (dailyPattern.strength > 0.5) {
        patterns.push({
          name: 'Daily Performance Cycle',
          description: 'Response time follows a predictable daily pattern',
          frequency: 'daily',
          strength: dailyPattern.strength,
          examples: dailyPattern.examples,
          impact: dailyPattern.impact,
        });
      }

      // Detect weekly patterns
      const weeklyPattern = this.detectWeeklyPattern(timeSeriesData.dataPoints);
      if (weeklyPattern.strength > 0.5) {
        patterns.push({
          name: 'Weekly Performance Cycle',
          description: 'Response time varies predictably across days of the week',
          frequency: 'weekly',
          strength: weeklyPattern.strength,
          examples: weeklyPattern.examples,
          impact: weeklyPattern.impact,
        });
      }

      this.logger.info('Identified performance patterns', {
        entityId,
        patternCount: patterns.length,
      });
      return patterns;
    } catch (error) {
      this.logger.error('Failed to identify performance patterns', error, { entityId, timeRange });
      throw new Error(`Failed to identify performance patterns: ${error.message}`);
    }
  }

  async exportHistoricalData(
    entityId: string,
    metrics: string[],
    timeRange: TimeRange,
    format: 'json' | 'csv'
  ): Promise<string> {
    try {
      this.logger.info('Exporting historical data', { entityId, metrics, timeRange, format });

      const timeSeriesData = await this.getMultipleMetricsTimeSeries(
        entityId,
        metrics,
        timeRange,
        '5 minutes'
      );

      if (format === 'json') {
        return JSON.stringify(timeSeriesData, null, 2);
      } else {
        return this.convertToCSV(timeSeriesData);
      }
    } catch (error) {
      this.logger.error('Failed to export historical data', error, {
        entityId,
        metrics,
        timeRange,
        format,
      });
      throw new Error(`Failed to export historical data: ${error.message}`);
    }
  }

  // Private helper methods
  private extractTimeSeriesPoints(result: NRQLResult): HistoricalDataPoint[] {
    if (!result.results || !Array.isArray(result.results)) {
      return [];
    }

    return result.results.map(row => ({
      timestamp: new Date(row.timestamp || Date.now()).toISOString(),
      value: typeof row.value === 'number' ? row.value : 0,
      metadata: { ...row },
    }));
  }

  private getMetricFunction(metric: string): string {
    switch (metric) {
      case 'response_time':
        return 'average(duration)';
      case 'throughput':
        return 'rate(count(*), 1 minute)';
      case 'error_rate':
        return 'percentage(count(*), WHERE error IS true)';
      case 'apdex':
        return 'apdex(duration, t: 0.5)';
      default:
        return `average(${metric})`;
    }
  }

  private getAggregationType(metric: string): 'average' | 'sum' | 'count' | 'min' | 'max' {
    switch (metric) {
      case 'throughput':
        return 'sum';
      case 'error_count':
        return 'count';
      default:
        return 'average';
    }
  }

  private getIntervalForAggregation(aggregationType: string): string {
    switch (aggregationType) {
      case 'hourly':
        return '1 hour';
      case 'daily':
        return '1 day';
      case 'weekly':
        return '1 week';
      case 'monthly':
        return '1 month';
      default:
        return '1 hour';
    }
  }

  private calculateTrend(dataPoints: HistoricalDataPoint[]): {
    direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    strength: number;
    changeRate: number;
  } {
    if (dataPoints.length < 2) {
      return { direction: 'stable', strength: 0, changeRate: 0 };
    }

    const values = dataPoints.map(point => point.value);
    const n = values.length;

    // Calculate linear regression
    const xValues = Array.from({ length: n }, (_, i) => i);
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = values.reduce((sum, y) => sum + y, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (values[i] - yMean);
      denominator += (xValues[i] - xMean) ** 2;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;

    // Calculate correlation coefficient for trend strength
    const correlation = this.calculateCorrelation(xValues, values);
    const strength = Math.abs(correlation);

    // Determine direction
    let direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    if (strength < 0.3) {
      direction = 'stable';
    } else if (strength < 0.5 && this.calculateVolatility(values) > 0.5) {
      direction = 'volatile';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    // Calculate change rate
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changeRate = firstValue === 0 ? 0 : ((lastValue - firstValue) / firstValue) * 100;

    return { direction, strength, changeRate };
  }

  private detectAnomaliesInData(dataPoints: HistoricalDataPoint[]): AnomalyPoint[] {
    if (dataPoints.length < 10) {
      return [];
    }

    const values = dataPoints.map(point => point.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = this.calculateStandardDeviation(values);

    const anomalies: AnomalyPoint[] = [];

    for (let i = 0; i < dataPoints.length; i++) {
      const point = dataPoints[i];
      const deviation = Math.abs(point.value - mean) / stdDev;

      if (deviation > 2) {
        // More than 2 standard deviations
        let severity: 'low' | 'medium' | 'high' | 'critical';
        let type: 'spike' | 'drop' | 'pattern_break';

        if (deviation > 4) {
          severity = 'critical';
        } else if (deviation > 3) {
          severity = 'high';
        } else if (deviation > 2.5) {
          severity = 'medium';
        } else {
          severity = 'low';
        }

        if (point.value > mean) {
          type = 'spike';
        } else {
          type = 'drop';
        }

        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          expectedValue: mean,
          deviation,
          severity,
          type,
        });
      }
    }

    return anomalies;
  }

  private detectSeasonality(dataPoints: HistoricalDataPoint[]): SeasonalityInfo {
    // Simplified seasonality detection
    // In a real implementation, you'd use more sophisticated algorithms like FFT

    if (dataPoints.length < 24) {
      return { detected: false, period: 'daily', strength: 0, pattern: [] };
    }

    const values = dataPoints.map(point => point.value);

    // Check for daily pattern (assuming hourly data)
    if (dataPoints.length >= 24) {
      const dailyPattern = this.extractPattern(values, 24);
      const dailyStrength = this.calculatePatternStrength(values, dailyPattern, 24);

      if (dailyStrength > 0.5) {
        return {
          detected: true,
          period: 'daily',
          strength: dailyStrength,
          pattern: dailyPattern,
        };
      }
    }

    // Check for weekly pattern (assuming hourly data)
    if (dataPoints.length >= 168) {
      const weeklyPattern = this.extractPattern(values, 168);
      const weeklyStrength = this.calculatePatternStrength(values, weeklyPattern, 168);

      if (weeklyStrength > 0.5) {
        return {
          detected: true,
          period: 'weekly',
          strength: weeklyStrength,
          pattern: weeklyPattern,
        };
      }
    }

    return { detected: false, period: 'daily', strength: 0, pattern: [] };
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => (val - mean) ** 2);
    const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private calculatePercentageChange(baseline: number, comparison: number): number {
    if (baseline === 0) return comparison > 0 ? 100 : 0;
    return ((comparison - baseline) / baseline) * 100;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let xSumSquares = 0;
    let ySumSquares = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xSumSquares += xDiff ** 2;
      ySumSquares += yDiff ** 2;
    }

    const denominator = Math.sqrt(xSumSquares * ySumSquares);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] !== 0) {
        returns.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }

    return this.calculateStandardDeviation(returns);
  }

  private extractPattern(values: number[], period: number): number[] {
    const pattern = new Array(period).fill(0);
    const counts = new Array(period).fill(0);

    for (let i = 0; i < values.length; i++) {
      const index = i % period;
      pattern[index] += values[i];
      counts[index]++;
    }

    // Average the values for each position in the pattern
    for (let i = 0; i < period; i++) {
      if (counts[i] > 0) {
        pattern[i] /= counts[i];
      }
    }

    // Normalize the pattern
    const mean = pattern.reduce((sum, val) => sum + val, 0) / pattern.length;
    return pattern.map(val => val / mean);
  }

  private calculatePatternStrength(values: number[], pattern: number[], period: number): number {
    if (values.length < period * 2) return 0;

    let totalError = 0;
    let totalVariance = 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

    for (let i = 0; i < values.length; i++) {
      const patternIndex = i % period;
      const expectedValue = pattern[patternIndex] * mean;
      const error = Math.abs(values[i] - expectedValue);
      const variance = Math.abs(values[i] - mean);

      totalError += error;
      totalVariance += variance;
    }

    return totalVariance === 0 ? 0 : Math.max(0, 1 - totalError / totalVariance);
  }

  private determineSignificance(
    changes: ComparisonAnalysis['changes']
  ): 'high' | 'medium' | 'low' | 'none' {
    const maxChange = Math.max(
      Math.abs(changes.averageChange),
      Math.abs(changes.minChange),
      Math.abs(changes.maxChange)
    );

    if (maxChange >= 50) return 'high';
    if (maxChange >= 20) return 'medium';
    if (maxChange >= 10) return 'low';
    return 'none';
  }

  private generateComparisonInsights(
    changes: ComparisonAnalysis['changes'],
    significance: string
  ): string[] {
    const insights: string[] = [];

    if (significance === 'none') {
      insights.push('No significant changes detected between the time periods');
      return insights;
    }

    if (Math.abs(changes.averageChange) >= 10) {
      const direction = changes.averageChange > 0 ? 'increased' : 'decreased';
      insights.push(
        `Average performance ${direction} by ${Math.abs(changes.averageChange).toFixed(1)}%`
      );
    }

    if (Math.abs(changes.variabilityChange) >= 20) {
      const direction = changes.variabilityChange > 0 ? 'increased' : 'decreased';
      insights.push(
        `Performance variability ${direction} by ${Math.abs(changes.variabilityChange).toFixed(1)}%`
      );
    }

    return insights;
  }

  private determineSeverityFromTrend(
    metric: string,
    trend: string,
    changeRate: number
  ): 'info' | 'warning' | 'critical' {
    const absChangeRate = Math.abs(changeRate);

    if (metric === 'error_rate' && trend === 'increasing' && absChangeRate > 50) {
      return 'critical';
    }

    if (metric === 'response_time' && trend === 'increasing' && absChangeRate > 30) {
      return 'warning';
    }

    if (absChangeRate > 100) {
      return 'critical';
    }

    if (absChangeRate > 50) {
      return 'warning';
    }

    return 'info';
  }

  private detectDailyPattern(dataPoints: HistoricalDataPoint[]): {
    strength: number;
    examples: any[];
    impact: 'positive' | 'negative' | 'neutral';
  } {
    // Simplified daily pattern detection
    // In practice, you'd analyze hourly patterns more thoroughly

    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    for (const point of dataPoints) {
      const hour = new Date(point.timestamp).getHours();
      hourlyAverages[hour] += point.value;
      hourlyCounts[hour]++;
    }

    // Calculate averages
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyAverages[i] /= hourlyCounts[i];
      }
    }

    // Calculate pattern strength (simplified)
    const overallAverage = hourlyAverages.reduce((sum, val) => sum + val, 0) / 24;
    const variance = hourlyAverages.reduce((sum, val) => sum + (val - overallAverage) ** 2, 0) / 24;
    const strength = Math.min(1, variance / overallAverage ** 2);

    const examples = hourlyAverages
      .map((avg, hour) => ({
        timestamp: `${hour}:00`,
        value: avg,
        context: `Hour ${hour}`,
      }))
      .filter(ex => ex.value > 0);

    // Determine impact (simplified)
    const peakHours = hourlyAverages.filter(avg => avg > overallAverage * 1.2).length;
    const impact = peakHours > 8 ? 'negative' : peakHours > 4 ? 'neutral' : 'positive';

    return { strength, examples, impact };
  }

  private detectWeeklyPattern(dataPoints: HistoricalDataPoint[]): {
    strength: number;
    examples: any[];
    impact: 'positive' | 'negative' | 'neutral';
  } {
    // Simplified weekly pattern detection
    const dailyAverages = new Array(7).fill(0);
    const dailyCounts = new Array(7).fill(0);

    for (const point of dataPoints) {
      const dayOfWeek = new Date(point.timestamp).getDay();
      dailyAverages[dayOfWeek] += point.value;
      dailyCounts[dayOfWeek]++;
    }

    // Calculate averages
    for (let i = 0; i < 7; i++) {
      if (dailyCounts[i] > 0) {
        dailyAverages[i] /= dailyCounts[i];
      }
    }

    const overallAverage = dailyAverages.reduce((sum, val) => sum + val, 0) / 7;
    const variance = dailyAverages.reduce((sum, val) => sum + (val - overallAverage) ** 2, 0) / 7;
    const strength = Math.min(1, variance / overallAverage ** 2);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const examples = dailyAverages
      .map((avg, day) => ({
        timestamp: dayNames[day],
        value: avg,
        context: `Day of week: ${dayNames[day]}`,
      }))
      .filter(ex => ex.value > 0);

    const weekendAvg = (dailyAverages[0] + dailyAverages[6]) / 2;
    const weekdayAvg = dailyAverages.slice(1, 6).reduce((sum, val) => sum + val, 0) / 5;
    const impact = weekendAvg > weekdayAvg * 1.2 ? 'negative' : 'neutral';

    return { strength, examples, impact };
  }

  private convertToCSV(timeSeriesData: TimeSeriesData[]): string {
    if (timeSeriesData.length === 0) {
      return '';
    }

    // Create header
    const headers = ['timestamp'];
    timeSeriesData.forEach(series => {
      headers.push(`${series.entity}_${series.metric}`);
    });

    // Get all unique timestamps
    const allTimestamps = new Set<string>();
    timeSeriesData.forEach(series => {
      series.dataPoints.forEach(point => {
        allTimestamps.add(point.timestamp);
      });
    });

    const sortedTimestamps = Array.from(allTimestamps).sort();

    // Create data rows
    const rows = [headers.join(',')];

    for (const timestamp of sortedTimestamps) {
      const row = [timestamp];

      for (const series of timeSeriesData) {
        const point = series.dataPoints.find(p => p.timestamp === timestamp);
        row.push(point ? point.value.toString() : '');
      }

      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private getTimeRangeKey(timeRange: TimeRange): string {
    return `${timeRange.since}_${timeRange.until || 'now'}`;
  }
}
