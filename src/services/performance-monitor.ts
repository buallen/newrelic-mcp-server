import { Logger } from '../utils/logger';
import { CacheManager } from './cache-manager';

export interface PerformanceMetrics {
  timestamp: string;
  requestCount: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: MemoryUsage;
  cpuUsage: number;
  activeConnections: number;
  queueDepth: number;
}

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'response_time' | 'error_rate' | 'memory' | 'cpu' | 'throughput';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  enabled: boolean;
  description: string;
}

export interface PerformanceTrend {
  metric: string;
  timeRange: string;
  trend: 'improving' | 'degrading' | 'stable';
  changePercentage: number;
  dataPoints: TrendDataPoint[];
}

export interface TrendDataPoint {
  timestamp: string;
  value: number;
}

export interface PerformanceReport {
  period: string;
  summary: PerformanceSummary;
  trends: PerformanceTrend[];
  alerts: PerformanceAlert[];
  recommendations: PerformanceRecommendation[];
  generatedAt: string;
}

export interface PerformanceSummary {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
  peakThroughput: number;
  memoryEfficiency: number;
  cacheHitRate: number;
}

export interface PerformanceRecommendation {
  type: 'optimization' | 'scaling' | 'configuration' | 'monitoring';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
}

export interface ResourceUtilization {
  timestamp: string;
  cpu: CPUUtilization;
  memory: MemoryUtilization;
  network: NetworkUtilization;
  disk: DiskUtilization;
}

export interface CPUUtilization {
  percentage: number;
  loadAverage: number[];
  processes: number;
  threads: number;
}

export interface MemoryUtilization {
  used: number;
  available: number;
  percentage: number;
  swapUsed: number;
  swapTotal: number;
}

export interface NetworkUtilization {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  connectionsActive: number;
  connectionsIdle: number;
}

export interface DiskUtilization {
  readBytes: number;
  writeBytes: number;
  readOps: number;
  writeOps: number;
  utilization: number;
}

export interface PerformanceMonitorInterface {
  // Metrics collection
  recordRequest(duration: number, success: boolean): void;
  recordError(errorType: string): void;
  recordThroughput(requestCount: number): void;
  
  // Real-time monitoring
  getCurrentMetrics(): Promise<PerformanceMetrics>;
  getResourceUtilization(): Promise<ResourceUtilization>;
  getActiveAlerts(): Promise<PerformanceAlert[]>;
  
  // Threshold management
  setThreshold(metric: string, warning: number, critical: number): void;
  getThresholds(): PerformanceThreshold[];
  updateThreshold(metric: string, threshold: Partial<PerformanceThreshold>): void;
  
  // Trend analysis
  analyzeTrends(timeRange: string): Promise<PerformanceTrend[]>;
  predictPerformance(metric: string, timeAhead: number): Promise<number>;
  
  // Reporting
  generateReport(period: string): Promise<PerformanceReport>;
  exportMetrics(format: 'json' | 'csv' | 'prometheus'): Promise<string>;
  
  // Alerting
  checkThresholds(): Promise<PerformanceAlert[]>;
  resolveAlert(alertId: string): Promise<void>;
  
  // Health checks
  performHealthCheck(): Promise<HealthCheckResult>;
  getDependencyStatus(): Promise<DependencyStatus[]>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  timestamp: string;
  responseTime: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  duration: number;
  details?: any;
}

export interface DependencyStatus {
  name: string;
  type: 'database' | 'api' | 'cache' | 'queue' | 'external_service';
  status: 'available' | 'degraded' | 'unavailable';
  responseTime: number;
  lastChecked: string;
  errorMessage?: string;
}

export class PerformanceMonitor implements PerformanceMonitorInterface {
  private logger: Logger;
  private cache: CacheManager;
  private metrics: Map<string, number[]> = new Map();
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private startTime: number = Date.now();
  
  // Request tracking
  private requestCount = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];
  private throughputHistory: number[] = [];
  
  // Resource tracking
  private memoryHistory: number[] = [];
  private cpuHistory: number[] = [];
  
  private readonly METRICS_RETENTION = 1000; // Keep last 1000 data points
  private readonly CACHE_TTL = 60; // 1 minute

  constructor(logger: Logger, cache: CacheManager) {
    this.logger = logger;
    this.cache = cache;
    
    this.initializeDefaultThresholds();
    this.startPeriodicCollection();
  }

  recordRequest(duration: number, success: boolean): void {
    this.requestCount++;
    this.responseTimes.push(duration);
    
    if (!success) {
      this.errorCount++;
    }
    
    // Keep only recent response times
    if (this.responseTimes.length > this.METRICS_RETENTION) {
      this.responseTimes = this.responseTimes.slice(-this.METRICS_RETENTION);
    }
    
    // Record in metrics map
    this.recordMetric('response_time', duration);
    this.recordMetric('request_count', 1);
    
    if (!success) {
      this.recordMetric('error_count', 1);
    }
  }

  recordError(errorType: string): void {
    this.errorCount++;
    this.recordMetric('error_count', 1);
    this.recordMetric(`error_${errorType}`, 1);
    
    this.logger.debug('Error recorded', { errorType, totalErrors: this.errorCount });
  }

  recordThroughput(requestCount: number): void {
    this.throughputHistory.push(requestCount);
    
    if (this.throughputHistory.length > this.METRICS_RETENTION) {
      this.throughputHistory = this.throughputHistory.slice(-this.METRICS_RETENTION);
    }
    
    this.recordMetric('throughput', requestCount);
  }

  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    try {
      const cacheKey = 'current_performance_metrics';
      
      // Try cache first
      const cached = await this.cache.get<PerformanceMetrics>(cacheKey);
      if (cached) {
        return cached;
      }
      
      const now = new Date().toISOString();
      const memoryUsage = this.getMemoryUsage();
      const cpuUsage = await this.getCPUUsage();
      
      // Calculate percentiles
      const sortedResponseTimes = [...this.responseTimes].sort((a, b) => a - b);
      const p50 = this.calculatePercentile(sortedResponseTimes, 50);
      const p95 = this.calculatePercentile(sortedResponseTimes, 95);
      const p99 = this.calculatePercentile(sortedResponseTimes, 99);
      
      const averageResponseTime = this.responseTimes.length > 0 
        ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length 
        : 0;
      
      const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
      const throughput = this.calculateCurrentThroughput();
      
      const metrics: PerformanceMetrics = {
        timestamp: now,
        requestCount: this.requestCount,
        averageResponseTime,
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        errorRate,
        throughput,
        memoryUsage,
        cpuUsage,
        activeConnections: await this.getActiveConnections(),
        queueDepth: await this.getQueueDepth()
      };
      
      // Cache the metrics
      await this.cache.set(cacheKey, metrics, this.CACHE_TTL);
      
      return metrics;
    } catch (error) {
      this.logger.error('Failed to get current metrics', error);
      throw new Error(`Failed to get current metrics: ${error.message}`);
    }
  }

  async getResourceUtilization(): Promise<ResourceUtilization> {
    try {
      const timestamp = new Date().toISOString();
      
      const cpu: CPUUtilization = {
        percentage: await this.getCPUUsage(),
        loadAverage: this.getLoadAverage(),
        processes: await this.getProcessCount(),
        threads: await this.getThreadCount()
      };
      
      const memoryStats = this.getMemoryUsage();
      const memory: MemoryUtilization = {
        used: memoryStats.used,
        available: memoryStats.total - memoryStats.used,
        percentage: memoryStats.percentage,
        swapUsed: 0, // Would need OS-specific implementation
        swapTotal: 0
      };
      
      const network: NetworkUtilization = {
        bytesIn: await this.getNetworkBytesIn(),
        bytesOut: await this.getNetworkBytesOut(),
        packetsIn: 0,
        packetsOut: 0,
        connectionsActive: await this.getActiveConnections(),
        connectionsIdle: 0
      };
      
      const disk: DiskUtilization = {
        readBytes: 0,
        writeBytes: 0,
        readOps: 0,
        writeOps: 0,
        utilization: 0
      };
      
      return {
        timestamp,
        cpu,
        memory,
        network,
        disk
      };
    } catch (error) {
      this.logger.error('Failed to get resource utilization', error);
      throw new Error(`Failed to get resource utilization: ${error.message}`);
    }
  }

  async getActiveAlerts(): Promise<PerformanceAlert[]> {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  setThreshold(metric: string, warning: number, critical: number): void {
    this.thresholds.set(metric, {
      metric,
      warning,
      critical,
      enabled: true,
      description: `Threshold for ${metric}`
    });
    
    this.logger.info('Performance threshold set', { metric, warning, critical });
  }

  getThresholds(): PerformanceThreshold[] {
    return Array.from(this.thresholds.values());
  }

  updateThreshold(metric: string, threshold: Partial<PerformanceThreshold>): void {
    const existing = this.thresholds.get(metric);
    if (existing) {
      this.thresholds.set(metric, { ...existing, ...threshold });
      this.logger.info('Performance threshold updated', { metric, threshold });
    }
  }

  async analyzeTrends(timeRange: string): Promise<PerformanceTrend[]> {
    try {
      this.logger.info('Analyzing performance trends', { timeRange });
      
      const trends: PerformanceTrend[] = [];
      const metricsToAnalyze = ['response_time', 'error_rate', 'throughput', 'memory_usage'];
      
      for (const metric of metricsToAnalyze) {
        const dataPoints = await this.getHistoricalData(metric, timeRange);
        
        if (dataPoints.length >= 2) {
          const trend = this.calculateTrend(dataPoints);
          const changePercentage = this.calculateChangePercentage(dataPoints);
          
          trends.push({
            metric,
            timeRange,
            trend,
            changePercentage,
            dataPoints
          });
        }
      }
      
      this.logger.info('Performance trends analyzed', { 
        timeRange, 
        trendsCount: trends.length 
      });
      
      return trends;
    } catch (error) {
      this.logger.error('Failed to analyze trends', error, { timeRange });
      throw new Error(`Failed to analyze trends: ${error.message}`);
    }
  }

  async predictPerformance(metric: string, timeAhead: number): Promise<number> {
    try {
      const historicalData = await this.getHistoricalData(metric, '1h');
      
      if (historicalData.length < 3) {
        throw new Error('Insufficient historical data for prediction');
      }
      
      // Simple linear regression prediction
      const prediction = this.linearRegression(historicalData, timeAhead);
      
      this.logger.debug('Performance prediction calculated', { 
        metric, 
        timeAhead, 
        prediction 
      });
      
      return prediction;
    } catch (error) {
      this.logger.error('Failed to predict performance', error, { metric, timeAhead });
      throw new Error(`Failed to predict performance: ${error.message}`);
    }
  }

  async generateReport(period: string): Promise<PerformanceReport> {
    try {
      this.logger.info('Generating performance report', { period });
      
      const currentMetrics = await this.getCurrentMetrics();
      const trends = await this.analyzeTrends(period);
      const alerts = await this.getActiveAlerts();
      
      const summary: PerformanceSummary = {
        totalRequests: this.requestCount,
        averageResponseTime: currentMetrics.averageResponseTime,
        errorRate: currentMetrics.errorRate,
        uptime: (Date.now() - this.startTime) / 1000, // seconds
        peakThroughput: Math.max(...this.throughputHistory),
        memoryEfficiency: 100 - currentMetrics.memoryUsage.percentage,
        cacheHitRate: await this.getCacheHitRate()
      };
      
      const recommendations = await this.generateRecommendations(currentMetrics, trends);
      
      const report: PerformanceReport = {
        period,
        summary,
        trends,
        alerts,
        recommendations,
        generatedAt: new Date().toISOString()
      };
      
      this.logger.info('Performance report generated', { 
        period,
        alertsCount: alerts.length,
        recommendationsCount: recommendations.length
      });
      
      return report;
    } catch (error) {
      this.logger.error('Failed to generate performance report', error, { period });
      throw new Error(`Failed to generate performance report: ${error.message}`);
    }
  }

  async exportMetrics(format: 'json' | 'csv' | 'prometheus'): Promise<string> {
    try {
      const metrics = await this.getCurrentMetrics();
      
      switch (format) {
        case 'json':
          return JSON.stringify(metrics, null, 2);
          
        case 'csv':
          return this.convertToCSV(metrics);
          
        case 'prometheus':
          return this.convertToPrometheus(metrics);
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      this.logger.error('Failed to export metrics', error, { format });
      throw new Error(`Failed to export metrics: ${error.message}`);
    }
  }

  async checkThresholds(): Promise<PerformanceAlert[]> {
    try {
      const currentMetrics = await this.getCurrentMetrics();
      const newAlerts: PerformanceAlert[] = [];
      
      // Check response time threshold
      const responseTimeThreshold = this.thresholds.get('response_time');
      if (responseTimeThreshold && responseTimeThreshold.enabled) {
        if (currentMetrics.averageResponseTime > responseTimeThreshold.critical) {
          newAlerts.push(this.createAlert(
            'response_time',
            'critical',
            `Average response time (${currentMetrics.averageResponseTime.toFixed(2)}ms) exceeds critical threshold`,
            currentMetrics.averageResponseTime,
            responseTimeThreshold.critical
          ));
        } else if (currentMetrics.averageResponseTime > responseTimeThreshold.warning) {
          newAlerts.push(this.createAlert(
            'response_time',
            'medium',
            `Average response time (${currentMetrics.averageResponseTime.toFixed(2)}ms) exceeds warning threshold`,
            currentMetrics.averageResponseTime,
            responseTimeThreshold.warning
          ));
        }
      }
      
      // Check error rate threshold
      const errorRateThreshold = this.thresholds.get('error_rate');
      if (errorRateThreshold && errorRateThreshold.enabled) {
        if (currentMetrics.errorRate > errorRateThreshold.critical) {
          newAlerts.push(this.createAlert(
            'error_rate',
            'critical',
            `Error rate (${currentMetrics.errorRate.toFixed(2)}%) exceeds critical threshold`,
            currentMetrics.errorRate,
            errorRateThreshold.critical
          ));
        } else if (currentMetrics.errorRate > errorRateThreshold.warning) {
          newAlerts.push(this.createAlert(
            'error_rate',
            'medium',
            `Error rate (${currentMetrics.errorRate.toFixed(2)}%) exceeds warning threshold`,
            currentMetrics.errorRate,
            errorRateThreshold.warning
          ));
        }
      }
      
      // Check memory usage threshold
      const memoryThreshold = this.thresholds.get('memory');
      if (memoryThreshold && memoryThreshold.enabled) {
        if (currentMetrics.memoryUsage.percentage > memoryThreshold.critical) {
          newAlerts.push(this.createAlert(
            'memory',
            'critical',
            `Memory usage (${currentMetrics.memoryUsage.percentage.toFixed(2)}%) exceeds critical threshold`,
            currentMetrics.memoryUsage.percentage,
            memoryThreshold.critical
          ));
        } else if (currentMetrics.memoryUsage.percentage > memoryThreshold.warning) {
          newAlerts.push(this.createAlert(
            'memory',
            'medium',
            `Memory usage (${currentMetrics.memoryUsage.percentage.toFixed(2)}%) exceeds warning threshold`,
            currentMetrics.memoryUsage.percentage,
            memoryThreshold.warning
          ));
        }
      }
      
      // Store new alerts
      for (const alert of newAlerts) {
        this.alerts.set(alert.id, alert);
      }
      
      if (newAlerts.length > 0) {
        this.logger.warn('Performance thresholds exceeded', { 
          alertsCount: newAlerts.length,
          alerts: newAlerts.map(a => ({ type: a.type, severity: a.severity }))
        });
      }
      
      return newAlerts;
    } catch (error) {
      this.logger.error('Failed to check thresholds', error);
      throw new Error(`Failed to check thresholds: ${error.message}`);
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      
      this.logger.info('Performance alert resolved', { alertId, type: alert.type });
    }
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];
    
    try {
      // Memory health check
      const memoryCheck = await this.checkMemoryHealth();
      checks.push(memoryCheck);
      
      // Response time health check
      const responseTimeCheck = await this.checkResponseTimeHealth();
      checks.push(responseTimeCheck);
      
      // Error rate health check
      const errorRateCheck = await this.checkErrorRateHealth();
      checks.push(errorRateCheck);
      
      // Cache health check
      const cacheCheck = await this.checkCacheHealth();
      checks.push(cacheCheck);
      
      // Determine overall status
      const failedChecks = checks.filter(check => check.status === 'fail');
      const warnChecks = checks.filter(check => check.status === 'warn');
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (failedChecks.length > 0) {
        status = 'unhealthy';
      } else if (warnChecks.length > 0) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      const result: HealthCheckResult = {
        status,
        checks,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
      
      this.logger.info('Health check completed', { 
        status, 
        checksCount: checks.length,
        responseTime: result.responseTime
      });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to perform health check', error);
      
      return {
        status: 'unhealthy',
        checks: [{
          name: 'health_check_execution',
          status: 'fail',
          message: `Health check failed: ${error.message}`,
          duration: Date.now() - startTime
        }],
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      };
    }
  }

  async getDependencyStatus(): Promise<DependencyStatus[]> {
    const dependencies: DependencyStatus[] = [];
    
    try {
      // Check cache dependency
      const cacheStatus = await this.checkDependency('cache', 'cache', async () => {
        await this.cache.get('health_check');
        return true;
      });
      dependencies.push(cacheStatus);
      
      // Add more dependency checks as needed
      
      this.logger.debug('Dependency status checked', { 
        dependenciesCount: dependencies.length 
      });
      
      return dependencies;
    } catch (error) {
      this.logger.error('Failed to get dependency status', error);
      throw new Error(`Failed to get dependency status: ${error.message}`);
    }
  }

  // Private helper methods continue in next part...
  // Private helper methods
  
  private initializeDefaultThresholds(): void {
    // Response time thresholds
    this.setThreshold('response_time', 1000, 3000); // 1s warning, 3s critical
    
    // Error rate thresholds
    this.setThreshold('error_rate', 5, 10); // 5% warning, 10% critical
    
    // Memory usage thresholds
    this.setThreshold('memory', 80, 90); // 80% warning, 90% critical
    
    // CPU usage thresholds
    this.setThreshold('cpu', 70, 85); // 70% warning, 85% critical
    
    // Throughput thresholds (requests per minute)
    this.setThreshold('throughput', 100, 50); // Below 100 warning, below 50 critical
    
    this.logger.info('Default performance thresholds initialized');
  }

  private startPeriodicCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(async () => {
      try {
        await this.collectSystemMetrics();
        await this.checkThresholds();
      } catch (error) {
        this.logger.error('Failed to collect periodic metrics', error);
      }
    }, 30000);
    
    this.logger.info('Periodic metrics collection started');
  }

  private recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only recent values
    if (values.length > this.METRICS_RETENTION) {
      values.splice(0, values.length - this.METRICS_RETENTION);
    }
  }

  private getMemoryUsage(): MemoryUsage {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const usedMemory = totalMemory - freeMemory;
    
    return {
      used: usedMemory,
      total: totalMemory,
      percentage: (usedMemory / totalMemory) * 100,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    };
  }

  private async getCPUUsage(): Promise<number> {
    // Simple CPU usage calculation
    const startUsage = process.cpuUsage();
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = endUsage.user + endUsage.system;
        const percentage = (totalUsage / 1000000) * 100; // Convert to percentage
        resolve(Math.min(percentage, 100));
      }, 100);
    });
  }

  private getLoadAverage(): number[] {
    return require('os').loadavg();
  }

  private async getProcessCount(): Promise<number> {
    // This would require OS-specific implementation
    return 1; // Placeholder
  }

  private async getThreadCount(): Promise<number> {
    // This would require OS-specific implementation
    return 1; // Placeholder
  }

  private async getNetworkBytesIn(): Promise<number> {
    // This would require network interface monitoring
    return 0; // Placeholder
  }

  private async getNetworkBytesOut(): Promise<number> {
    // This would require network interface monitoring
    return 0; // Placeholder
  }

  private async getActiveConnections(): Promise<number> {
    // This would monitor active HTTP connections
    return 0; // Placeholder
  }

  private async getQueueDepth(): Promise<number> {
    // This would monitor request queue depth
    return 0; // Placeholder
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private calculateCurrentThroughput(): number {
    // Calculate requests per minute based on recent history
    const recentMinute = Date.now() - 60000;
    const recentRequests = this.throughputHistory.filter(timestamp => timestamp > recentMinute);
    return recentRequests.length;
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const memoryUsage = this.getMemoryUsage();
      const cpuUsage = await this.getCPUUsage();
      
      this.recordMetric('memory_usage', memoryUsage.percentage);
      this.recordMetric('cpu_usage', cpuUsage);
      
      // Store in history for trend analysis
      this.memoryHistory.push(memoryUsage.percentage);
      this.cpuHistory.push(cpuUsage);
      
      // Keep history size manageable
      if (this.memoryHistory.length > this.METRICS_RETENTION) {
        this.memoryHistory = this.memoryHistory.slice(-this.METRICS_RETENTION);
      }
      if (this.cpuHistory.length > this.METRICS_RETENTION) {
        this.cpuHistory = this.cpuHistory.slice(-this.METRICS_RETENTION);
      }
    } catch (error) {
      this.logger.error('Failed to collect system metrics', error);
    }
  }

  private async getHistoricalData(metric: string, timeRange: string): Promise<TrendDataPoint[]> {
    const values = this.metrics.get(metric) || [];
    const now = Date.now();
    
    // Convert time range to milliseconds
    const rangeMs = this.parseTimeRange(timeRange);
    const startTime = now - rangeMs;
    
    // Generate data points (simplified - in production, you'd have actual timestamps)
    const dataPoints: TrendDataPoint[] = [];
    const interval = rangeMs / Math.min(values.length, 100); // Max 100 points
    
    for (let i = 0; i < values.length && i < 100; i++) {
      dataPoints.push({
        timestamp: new Date(startTime + (i * interval)).toISOString(),
        value: values[i]
      });
    }
    
    return dataPoints;
  }

  private parseTimeRange(timeRange: string): number {
    const match = timeRange.match(/(\d+)([smhd])/);
    if (!match) return 3600000; // Default 1 hour
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 3600000;
    }
  }

  private calculateTrend(dataPoints: TrendDataPoint[]): 'improving' | 'degrading' | 'stable' {
    if (dataPoints.length < 2) return 'stable';
    
    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, point) => sum + point.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, point) => sum + point.value, 0) / secondHalf.length;
    
    const changePercentage = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (Math.abs(changePercentage) < 5) return 'stable';
    return changePercentage > 0 ? 'degrading' : 'improving';
  }

  private calculateChangePercentage(dataPoints: TrendDataPoint[]): number {
    if (dataPoints.length < 2) return 0;
    
    const firstValue = dataPoints[0].value;
    const lastValue = dataPoints[dataPoints.length - 1].value;
    
    return ((lastValue - firstValue) / firstValue) * 100;
  }

  private linearRegression(dataPoints: TrendDataPoint[], timeAhead: number): number {
    if (dataPoints.length < 2) return 0;
    
    // Simple linear regression
    const n = dataPoints.length;
    const xValues = dataPoints.map((_, index) => index);
    const yValues = dataPoints.map(point => point.value);
    
    const xSum = xValues.reduce((sum, x) => sum + x, 0);
    const ySum = yValues.reduce((sum, y) => sum + y, 0);
    const xySum = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const x2Sum = xValues.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;
    
    // Predict value at timeAhead
    const futureX = n + timeAhead;
    return slope * futureX + intercept;
  }

  private async getCacheHitRate(): Promise<number> {
    try {
      // This would get actual cache hit rate from cache manager
      return 85; // Placeholder
    } catch (error) {
      return 0;
    }
  }

  private async generateRecommendations(
    metrics: PerformanceMetrics, 
    trends: PerformanceTrend[]
  ): Promise<PerformanceRecommendation[]> {
    const recommendations: PerformanceRecommendation[] = [];
    
    // Memory recommendations
    if (metrics.memoryUsage.percentage > 80) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        title: 'Optimize Memory Usage',
        description: 'Memory usage is high and may impact performance',
        expectedImpact: 'Reduce memory usage by 20-30%',
        implementation: [
          'Review memory-intensive operations',
          'Implement object pooling',
          'Optimize cache size limits',
          'Consider garbage collection tuning'
        ],
        estimatedEffort: 'medium'
      });
    }
    
    // Response time recommendations
    if (metrics.averageResponseTime > 1000) {
      recommendations.push({
        type: 'optimization',
        priority: 'high',
        title: 'Improve Response Time',
        description: 'Average response time exceeds acceptable limits',
        expectedImpact: 'Reduce response time by 30-50%',
        implementation: [
          'Optimize database queries',
          'Implement response caching',
          'Review slow endpoints',
          'Consider connection pooling'
        ],
        estimatedEffort: 'high'
      });
    }
    
    // Error rate recommendations
    if (metrics.errorRate > 5) {
      recommendations.push({
        type: 'monitoring',
        priority: 'critical',
        title: 'Address High Error Rate',
        description: 'Error rate is above acceptable threshold',
        expectedImpact: 'Reduce error rate to below 2%',
        implementation: [
          'Investigate error patterns',
          'Implement better error handling',
          'Add circuit breakers',
          'Improve input validation'
        ],
        estimatedEffort: 'medium'
      });
    }
    
    // Trend-based recommendations
    const degradingTrends = trends.filter(trend => trend.trend === 'degrading');
    if (degradingTrends.length > 0) {
      recommendations.push({
        type: 'monitoring',
        priority: 'medium',
        title: 'Monitor Degrading Trends',
        description: `${degradingTrends.length} metrics showing degrading trends`,
        expectedImpact: 'Prevent performance degradation',
        implementation: [
          'Set up proactive monitoring',
          'Implement trend-based alerts',
          'Schedule regular performance reviews'
        ],
        estimatedEffort: 'low'
      });
    }
    
    return recommendations;
  }

  private convertToCSV(metrics: PerformanceMetrics): string {
    const headers = [
      'timestamp',
      'requestCount',
      'averageResponseTime',
      'p95ResponseTime',
      'errorRate',
      'throughput',
      'memoryUsagePercent',
      'cpuUsage'
    ];
    
    const values = [
      metrics.timestamp,
      metrics.requestCount,
      metrics.averageResponseTime,
      metrics.p95ResponseTime,
      metrics.errorRate,
      metrics.throughput,
      metrics.memoryUsage.percentage,
      metrics.cpuUsage
    ];
    
    return headers.join(',') + '\n' + values.join(',');
  }

  private convertToPrometheus(metrics: PerformanceMetrics): string {
    const timestamp = Date.now();
    
    return [
      `# HELP mcp_server_requests_total Total number of requests`,
      `# TYPE mcp_server_requests_total counter`,
      `mcp_server_requests_total ${metrics.requestCount} ${timestamp}`,
      ``,
      `# HELP mcp_server_response_time_seconds Response time in seconds`,
      `# TYPE mcp_server_response_time_seconds histogram`,
      `mcp_server_response_time_seconds_sum ${metrics.averageResponseTime / 1000} ${timestamp}`,
      `mcp_server_response_time_seconds_count ${metrics.requestCount} ${timestamp}`,
      ``,
      `# HELP mcp_server_error_rate Error rate percentage`,
      `# TYPE mcp_server_error_rate gauge`,
      `mcp_server_error_rate ${metrics.errorRate} ${timestamp}`,
      ``,
      `# HELP mcp_server_memory_usage_percent Memory usage percentage`,
      `# TYPE mcp_server_memory_usage_percent gauge`,
      `mcp_server_memory_usage_percent ${metrics.memoryUsage.percentage} ${timestamp}`,
      ``,
      `# HELP mcp_server_cpu_usage_percent CPU usage percentage`,
      `# TYPE mcp_server_cpu_usage_percent gauge`,
      `mcp_server_cpu_usage_percent ${metrics.cpuUsage} ${timestamp}`
    ].join('\n');
  }

  private createAlert(
    type: 'response_time' | 'error_rate' | 'memory' | 'cpu' | 'throughput',
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    value: number,
    threshold: number
  ): PerformanceAlert {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date().toISOString(),
      resolved: false
    };
  }

  private async checkMemoryHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = this.getMemoryUsage();
      const duration = Date.now() - startTime;
      
      if (memoryUsage.percentage > 90) {
        return {
          name: 'memory',
          status: 'fail',
          message: `Memory usage critical: ${memoryUsage.percentage.toFixed(2)}%`,
          duration,
          details: memoryUsage
        };
      } else if (memoryUsage.percentage > 80) {
        return {
          name: 'memory',
          status: 'warn',
          message: `Memory usage high: ${memoryUsage.percentage.toFixed(2)}%`,
          duration,
          details: memoryUsage
        };
      } else {
        return {
          name: 'memory',
          status: 'pass',
          message: `Memory usage normal: ${memoryUsage.percentage.toFixed(2)}%`,
          duration,
          details: memoryUsage
        };
      }
    } catch (error) {
      return {
        name: 'memory',
        status: 'fail',
        message: `Memory check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkResponseTimeHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const averageResponseTime = this.responseTimes.length > 0 
        ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length 
        : 0;
      
      const duration = Date.now() - startTime;
      
      if (averageResponseTime > 3000) {
        return {
          name: 'response_time',
          status: 'fail',
          message: `Response time critical: ${averageResponseTime.toFixed(2)}ms`,
          duration,
          details: { averageResponseTime }
        };
      } else if (averageResponseTime > 1000) {
        return {
          name: 'response_time',
          status: 'warn',
          message: `Response time high: ${averageResponseTime.toFixed(2)}ms`,
          duration,
          details: { averageResponseTime }
        };
      } else {
        return {
          name: 'response_time',
          status: 'pass',
          message: `Response time normal: ${averageResponseTime.toFixed(2)}ms`,
          duration,
          details: { averageResponseTime }
        };
      }
    } catch (error) {
      return {
        name: 'response_time',
        status: 'fail',
        message: `Response time check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkErrorRateHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
      const duration = Date.now() - startTime;
      
      if (errorRate > 10) {
        return {
          name: 'error_rate',
          status: 'fail',
          message: `Error rate critical: ${errorRate.toFixed(2)}%`,
          duration,
          details: { errorRate, errorCount: this.errorCount, requestCount: this.requestCount }
        };
      } else if (errorRate > 5) {
        return {
          name: 'error_rate',
          status: 'warn',
          message: `Error rate high: ${errorRate.toFixed(2)}%`,
          duration,
          details: { errorRate, errorCount: this.errorCount, requestCount: this.requestCount }
        };
      } else {
        return {
          name: 'error_rate',
          status: 'pass',
          message: `Error rate normal: ${errorRate.toFixed(2)}%`,
          duration,
          details: { errorRate, errorCount: this.errorCount, requestCount: this.requestCount }
        };
      }
    } catch (error) {
      return {
        name: 'error_rate',
        status: 'fail',
        message: `Error rate check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkCacheHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test cache connectivity
      const testKey = 'health_check_test';
      const testValue = 'test_value';
      
      await this.cache.set(testKey, testValue, 10);
      const retrievedValue = await this.cache.get(testKey);
      await this.cache.delete(testKey);
      
      const duration = Date.now() - startTime;
      
      if (retrievedValue === testValue) {
        return {
          name: 'cache',
          status: 'pass',
          message: 'Cache connectivity normal',
          duration,
          details: { testSuccessful: true }
        };
      } else {
        return {
          name: 'cache',
          status: 'fail',
          message: 'Cache test failed - value mismatch',
          duration,
          details: { expected: testValue, actual: retrievedValue }
        };
      }
    } catch (error) {
      return {
        name: 'cache',
        status: 'fail',
        message: `Cache check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkDependency(
    name: string, 
    type: 'database' | 'api' | 'cache' | 'queue' | 'external_service',
    healthCheckFn: () => Promise<boolean>
  ): Promise<DependencyStatus> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await healthCheckFn();
      const responseTime = Date.now() - startTime;
      
      return {
        name,
        type,
        status: isHealthy ? 'available' : 'unavailable',
        responseTime,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        name,
        type,
        status: 'unavailable',
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        errorMessage: error.message
      };
    }
  }
}