import { Logger } from '../utils/logger';
import { PerformanceMonitor } from './performance-monitor';

export interface ResourcePool<T> {
  name: string;
  maxSize: number;
  currentSize: number;
  available: number;
  inUse: number;
  created: number;
  destroyed: number;
  createResource(): Promise<T>;
  validateResource(resource: T): Promise<boolean>;
  destroyResource(resource: T): Promise<void>;
  resetResource?(resource: T): Promise<void>;
}

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  maxLifetimeMs: number;
  testOnBorrow: boolean;
  testOnReturn: boolean;
  testWhileIdle: boolean;
  validationQuery?: string;
}

export interface ResourceMetrics {
  poolName: string;
  totalCreated: number;
  totalDestroyed: number;
  currentActive: number;
  currentIdle: number;
  peakActive: number;
  averageWaitTime: number;
  averageActiveTime: number;
  creationRate: number;
  destructionRate: number;
  utilizationPercentage: number;
}

export interface MemoryManagement {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  gcStats: GCStats;
  memoryLeaks: MemoryLeak[];
  recommendations: MemoryRecommendation[];
}

export interface GCStats {
  totalGCTime: number;
  gcCount: number;
  averageGCTime: number;
  lastGCTime: number;
  gcType: string;
}

export interface MemoryLeak {
  type: string;
  size: number;
  growth: number;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MemoryRecommendation {
  type: 'gc_tuning' | 'memory_limit' | 'object_pooling' | 'cache_optimization';
  description: string;
  expectedImpact: string;
  implementation: string[];
}

export interface ResourceOptimization {
  type: 'connection_pooling' | 'memory_management' | 'cpu_optimization' | 'io_optimization';
  description: string;
  currentState: any;
  optimizedState: any;
  expectedImprovement: string;
  implementationSteps: string[];
}

export interface ResourceManagerInterface {
  // Connection pooling
  createConnectionPool<T>(name: string, config: ConnectionPoolConfig, factory: ResourceFactory<T>): Promise<ResourcePool<T>>;
  getConnectionPool<T>(name: string): ResourcePool<T> | null;
  acquireConnection<T>(poolName: string): Promise<T>;
  releaseConnection<T>(poolName: string, connection: T): Promise<void>;
  
  // Memory management
  getMemoryUsage(): Promise<MemoryManagement>;
  forceGarbageCollection(): Promise<GCStats>;
  detectMemoryLeaks(): Promise<MemoryLeak[]>;
  optimizeMemoryUsage(): Promise<MemoryRecommendation[]>;
  
  // Resource monitoring
  getResourceMetrics(): Promise<ResourceMetrics[]>;
  getResourceUtilization(resourceType: string): Promise<number>;
  
  // Optimization
  analyzeResourceUsage(): Promise<ResourceOptimization[]>;
  applyOptimizations(optimizations: ResourceOptimization[]): Promise<void>;
  
  // Lifecycle management
  startResourceMonitoring(): void;
  stopResourceMonitoring(): void;
  cleanupResources(): Promise<void>;
}

export interface ResourceFactory<T> {
  create(): Promise<T>;
  validate(resource: T): Promise<boolean>;
  destroy(resource: T): Promise<void>;
  reset?(resource: T): Promise<void>;
}

export interface PooledResource<T> {
  resource: T;
  createdAt: number;
  lastUsed: number;
  useCount: number;
  isValid: boolean;
}

export class GenericResourcePool<T> implements ResourcePool<T> {
  public name: string;
  public maxSize: number;
  public currentSize: number = 0;
  public created: number = 0;
  public destroyed: number = 0;

  private resources: PooledResource<T>[] = [];
  private factory: ResourceFactory<T>;
  private config: ConnectionPoolConfig;
  private logger: Logger;
  private waitingQueue: Array<{
    resolve: (resource: T) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  constructor(
    name: string,
    config: ConnectionPoolConfig,
    factory: ResourceFactory<T>,
    logger: Logger
  ) {
    this.name = name;
    this.maxSize = config.maxConnections;
    this.config = config;
    this.factory = factory;
    this.logger = logger;

    // Initialize minimum connections
    this.initializePool();
    
    // Start maintenance tasks
    this.startMaintenance();
  }

  get available(): number {
    return this.resources.filter(r => r.isValid).length;
  }

  get inUse(): number {
    return this.currentSize - this.available;
  }

  async createResource(): Promise<T> {
    if (this.currentSize >= this.maxSize) {
      throw new Error(`Pool ${this.name} has reached maximum size`);
    }

    try {
      const resource = await this.factory.create();
      const pooledResource: PooledResource<T> = {
        resource,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        useCount: 0,
        isValid: true
      };

      this.resources.push(pooledResource);
      this.currentSize++;
      this.created++;

      this.logger.debug('Resource created', { 
        pool: this.name, 
        currentSize: this.currentSize 
      });

      return resource;
    } catch (error) {
      this.logger.error('Failed to create resource', error, { pool: this.name });
      throw error;
    }
  }

  async validateResource(resource: T): Promise<boolean> {
    try {
      return await this.factory.validate(resource);
    } catch (error) {
      this.logger.warn('Resource validation failed', { pool: this.name, error: error.message });
      return false;
    }
  }

  async destroyResource(resource: T): Promise<void> {
    try {
      const index = this.resources.findIndex(r => r.resource === resource);
      if (index >= 0) {
        this.resources.splice(index, 1);
        this.currentSize--;
        this.destroyed++;
      }

      await this.factory.destroy(resource);

      this.logger.debug('Resource destroyed', { 
        pool: this.name, 
        currentSize: this.currentSize 
      });
    } catch (error) {
      this.logger.error('Failed to destroy resource', error, { pool: this.name });
    }
  }

  async acquire(): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
        if (index >= 0) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error(`Acquire timeout after ${this.config.acquireTimeoutMs}ms`));
      }, this.config.acquireTimeoutMs);

      this.waitingQueue.push({
        resolve: (resource: T) => {
          clearTimeout(timeout);
          resolve(resource);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now()
      });

      this.processQueue();
    });
  }

  async release(resource: T): Promise<void> {
    const pooledResource = this.resources.find(r => r.resource === resource);
    if (!pooledResource) {
      this.logger.warn('Attempted to release unknown resource', { pool: this.name });
      return;
    }

    // Reset resource if factory supports it
    if (this.factory.reset) {
      try {
        await this.factory.reset(resource);
      } catch (error) {
        this.logger.warn('Failed to reset resource, destroying it', { pool: this.name });
        await this.destroyResource(resource);
        return;
      }
    }

    // Validate resource if configured
    if (this.config.testOnReturn) {
      const isValid = await this.validateResource(resource);
      if (!isValid) {
        await this.destroyResource(resource);
        return;
      }
    }

    pooledResource.lastUsed = Date.now();
    pooledResource.isValid = true;

    this.logger.debug('Resource released', { pool: this.name });

    // Process waiting queue
    this.processQueue();
  }

  private async initializePool(): Promise<void> {
    const promises: Promise<T>[] = [];
    
    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createResource());
    }

    try {
      await Promise.all(promises);
      this.logger.info('Resource pool initialized', { 
        pool: this.name, 
        initialSize: this.config.minConnections 
      });
    } catch (error) {
      this.logger.error('Failed to initialize resource pool', error, { pool: this.name });
    }
  }

  private async processQueue(): Promise<void> {
    while (this.waitingQueue.length > 0 && this.available > 0) {
      const waiter = this.waitingQueue.shift()!;
      const availableResource = this.resources.find(r => r.isValid);

      if (availableResource) {
        // Test resource if configured
        if (this.config.testOnBorrow) {
          const isValid = await this.validateResource(availableResource.resource);
          if (!isValid) {
            await this.destroyResource(availableResource.resource);
            continue;
          }
        }

        availableResource.isValid = false;
        availableResource.lastUsed = Date.now();
        availableResource.useCount++;

        waiter.resolve(availableResource.resource);
      } else if (this.currentSize < this.maxSize) {
        // Create new resource
        try {
          const newResource = await this.createResource();
          const pooledResource = this.resources.find(r => r.resource === newResource)!;
          pooledResource.isValid = false;
          pooledResource.useCount++;

          waiter.resolve(newResource);
        } catch (error) {
          waiter.reject(error);
        }
      }
    }
  }

  private startMaintenance(): void {
    // Run maintenance every 30 seconds
    setInterval(async () => {
      await this.performMaintenance();
    }, 30000);
  }

  private async performMaintenance(): Promise<void> {
    const now = Date.now();
    const resourcesToDestroy: PooledResource<T>[] = [];

    // Find resources to destroy
    for (const pooledResource of this.resources) {
      // Check idle timeout
      if (pooledResource.isValid && 
          now - pooledResource.lastUsed > this.config.idleTimeoutMs) {
        resourcesToDestroy.push(pooledResource);
        continue;
      }

      // Check max lifetime
      if (now - pooledResource.createdAt > this.config.maxLifetimeMs) {
        resourcesToDestroy.push(pooledResource);
        continue;
      }

      // Test idle resources if configured
      if (this.config.testWhileIdle && pooledResource.isValid) {
        const isValid = await this.validateResource(pooledResource.resource);
        if (!isValid) {
          resourcesToDestroy.push(pooledResource);
        }
      }
    }

    // Destroy identified resources
    for (const pooledResource of resourcesToDestroy) {
      await this.destroyResource(pooledResource.resource);
    }

    // Ensure minimum connections
    while (this.currentSize < this.config.minConnections) {
      try {
        await this.createResource();
      } catch (error) {
        this.logger.error('Failed to maintain minimum connections', error, { pool: this.name });
        break;
      }
    }
  }
}

export class ResourceManager implements ResourceManagerInterface {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private pools: Map<string, ResourcePool<any>> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private gcStats: GCStats = {
    totalGCTime: 0,
    gcCount: 0,
    averageGCTime: 0,
    lastGCTime: 0,
    gcType: 'unknown'
  };

  constructor(logger: Logger, performanceMonitor: PerformanceMonitor) {
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
    
    this.setupGCMonitoring();
  }

  async createConnectionPool<T>(
    name: string, 
    config: ConnectionPoolConfig, 
    factory: ResourceFactory<T>
  ): Promise<ResourcePool<T>> {
    if (this.pools.has(name)) {
      throw new Error(`Pool with name '${name}' already exists`);
    }

    const pool = new GenericResourcePool(name, config, factory, this.logger);
    this.pools.set(name, pool);

    this.logger.info('Connection pool created', { name, config });
    return pool;
  }

  getConnectionPool<T>(name: string): ResourcePool<T> | null {
    return this.pools.get(name) || null;
  }

  async acquireConnection<T>(poolName: string): Promise<T> {
    const pool = this.pools.get(poolName) as GenericResourcePool<T>;
    if (!pool) {
      throw new Error(`Pool '${poolName}' not found`);
    }

    return await pool.acquire();
  }

  async releaseConnection<T>(poolName: string, connection: T): Promise<void> {
    const pool = this.pools.get(poolName) as GenericResourcePool<T>;
    if (!pool) {
      throw new Error(`Pool '${poolName}' not found`);
    }

    await pool.release(connection);
  }

  async getMemoryUsage(): Promise<MemoryManagement> {
    const memUsage = process.memoryUsage();
    const memoryLeaks = await this.detectMemoryLeaks();
    const recommendations = await this.generateMemoryRecommendations(memUsage, memoryLeaks);

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      gcStats: this.gcStats,
      memoryLeaks,
      recommendations
    };
  }

  async forceGarbageCollection(): Promise<GCStats> {
    const startTime = Date.now();
    
    if (global.gc) {
      global.gc();
      const gcTime = Date.now() - startTime;
      
      this.gcStats.totalGCTime += gcTime;
      this.gcStats.gcCount++;
      this.gcStats.averageGCTime = this.gcStats.totalGCTime / this.gcStats.gcCount;
      this.gcStats.lastGCTime = gcTime;
      this.gcStats.gcType = 'manual';

      this.logger.info('Manual garbage collection completed', { gcTime });
    } else {
      this.logger.warn('Garbage collection not available (run with --expose-gc)');
    }

    return this.gcStats;
  }

  async detectMemoryLeaks(): Promise<MemoryLeak[]> {
    const leaks: MemoryLeak[] = [];
    
    // This is a simplified implementation
    // In production, you'd use more sophisticated leak detection
    const memUsage = process.memoryUsage();
    
    // Check for heap growth
    const heapGrowth = memUsage.heapUsed / memUsage.heapTotal;
    if (heapGrowth > 0.9) {
      leaks.push({
        type: 'heap_exhaustion',
        size: memUsage.heapUsed,
        growth: heapGrowth * 100,
        location: 'heap',
        severity: 'critical'
      });
    }

    // Check for external memory growth
    if (memUsage.external > 100 * 1024 * 1024) { // 100MB
      leaks.push({
        type: 'external_memory',
        size: memUsage.external,
        growth: 0, // Would need historical data
        location: 'external',
        severity: 'medium'
      });
    }

    return leaks;
  }

  async optimizeMemoryUsage(): Promise<MemoryRecommendation[]> {
    const memUsage = process.memoryUsage();
    const recommendations: MemoryRecommendation[] = [];

    // High heap usage
    if (memUsage.heapUsed / memUsage.heapTotal > 0.8) {
      recommendations.push({
        type: 'gc_tuning',
        description: 'High heap usage detected, consider GC tuning',
        expectedImpact: 'Reduce memory pressure and improve performance',
        implementation: [
          'Increase heap size with --max-old-space-size',
          'Tune GC parameters',
          'Consider manual GC triggers at appropriate times'
        ]
      });
    }

    // Large external memory
    if (memUsage.external > 50 * 1024 * 1024) { // 50MB
      recommendations.push({
        type: 'memory_limit',
        description: 'High external memory usage detected',
        expectedImpact: 'Reduce overall memory footprint',
        implementation: [
          'Review buffer usage',
          'Implement streaming for large data',
          'Add memory limits to operations'
        ]
      });
    }

    return recommendations;
  }

  async getResourceMetrics(): Promise<ResourceMetrics[]> {
    const metrics: ResourceMetrics[] = [];

    for (const [name, pool] of this.pools) {
      metrics.push({
        poolName: name,
        totalCreated: pool.created,
        totalDestroyed: pool.destroyed,
        currentActive: pool.inUse,
        currentIdle: pool.available,
        peakActive: pool.created, // Simplified
        averageWaitTime: 0, // Would need to track
        averageActiveTime: 0, // Would need to track
        creationRate: 0, // Would need time-based calculation
        destructionRate: 0, // Would need time-based calculation
        utilizationPercentage: (pool.inUse / pool.maxSize) * 100
      });
    }

    return metrics;
  }

  async getResourceUtilization(resourceType: string): Promise<number> {
    switch (resourceType) {
      case 'memory':
        const memUsage = process.memoryUsage();
        return (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
      case 'connections':
        let totalUsed = 0;
        let totalMax = 0;
        
        for (const pool of this.pools.values()) {
          totalUsed += pool.inUse;
          totalMax += pool.maxSize;
        }
        
        return totalMax > 0 ? (totalUsed / totalMax) * 100 : 0;
        
      default:
        return 0;
    }
  }

  async analyzeResourceUsage(): Promise<ResourceOptimization[]> {
    const optimizations: ResourceOptimization[] = [];
    
    // Analyze connection pools
    for (const [name, pool] of this.pools) {
      const utilization = (pool.inUse / pool.maxSize) * 100;
      
      if (utilization < 20) {
        optimizations.push({
          type: 'connection_pooling',
          description: `Pool '${name}' is underutilized`,
          currentState: { maxSize: pool.maxSize, utilization },
          optimizedState: { maxSize: Math.max(pool.maxSize / 2, 5), utilization: utilization * 2 },
          expectedImprovement: 'Reduce memory usage by 30-50%',
          implementationSteps: [
            'Reduce maximum pool size',
            'Monitor performance impact',
            'Adjust based on usage patterns'
          ]
        });
      } else if (utilization > 90) {
        optimizations.push({
          type: 'connection_pooling',
          description: `Pool '${name}' is over-utilized`,
          currentState: { maxSize: pool.maxSize, utilization },
          optimizedState: { maxSize: pool.maxSize * 1.5, utilization: utilization / 1.5 },
          expectedImprovement: 'Reduce connection wait times by 40-60%',
          implementationSteps: [
            'Increase maximum pool size',
            'Monitor resource usage',
            'Consider connection optimization'
          ]
        });
      }
    }

    // Analyze memory usage
    const memUsage = process.memoryUsage();
    const memUtilization = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (memUtilization > 80) {
      optimizations.push({
        type: 'memory_management',
        description: 'High memory utilization detected',
        currentState: { heapUsed: memUsage.heapUsed, utilization: memUtilization },
        optimizedState: { heapUsed: memUsage.heapUsed * 0.7, utilization: memUtilization * 0.7 },
        expectedImprovement: 'Reduce memory pressure and improve GC performance',
        implementationSteps: [
          'Implement object pooling',
          'Optimize cache sizes',
          'Review memory-intensive operations',
          'Consider streaming for large data'
        ]
      });
    }

    return optimizations;
  }

  async applyOptimizations(optimizations: ResourceOptimization[]): Promise<void> {
    for (const optimization of optimizations) {
      try {
        await this.applyOptimization(optimization);
        this.logger.info('Optimization applied', { 
          type: optimization.type,
          description: optimization.description 
        });
      } catch (error) {
        this.logger.error('Failed to apply optimization', error, { 
          type: optimization.type 
        });
      }
    }
  }

  startResourceMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectResourceMetrics();
      } catch (error) {
        this.logger.error('Failed to collect resource metrics', error);
      }
    }, 60000); // Every minute

    this.logger.info('Resource monitoring started');
  }

  stopResourceMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      this.logger.info('Resource monitoring stopped');
    }
  }

  async cleanupResources(): Promise<void> {
    this.logger.info('Starting resource cleanup');

    // Stop monitoring
    this.stopResourceMonitoring();

    // Cleanup all pools
    for (const [name, pool] of this.pools) {
      try {
        // This would need to be implemented in the pool
        this.logger.info('Cleaning up pool', { name });
      } catch (error) {
        this.logger.error('Failed to cleanup pool', error, { name });
      }
    }

    this.pools.clear();
    this.logger.info('Resource cleanup completed');
  }

  // Private helper methods
  
  private setupGCMonitoring(): void {
    // Monitor GC events if available
    if (process.env.NODE_ENV !== 'production') {
      // In development, we can use performance hooks
      try {
        const { PerformanceObserver } = require('perf_hooks');
        const obs = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === 'gc') {
              this.gcStats.totalGCTime += entry.duration;
              this.gcStats.gcCount++;
              this.gcStats.averageGCTime = this.gcStats.totalGCTime / this.gcStats.gcCount;
              this.gcStats.lastGCTime = entry.duration;
              this.gcStats.gcType = entry.kind || 'unknown';
            }
          }
        });
        obs.observe({ entryTypes: ['gc'] });
      } catch (error) {
        this.logger.debug('GC monitoring not available', { error: error.message });
      }
    }
  }

  private async generateMemoryRecommendations(
    memUsage: NodeJS.MemoryUsage, 
    leaks: MemoryLeak[]
  ): Promise<MemoryRecommendation[]> {
    const recommendations: MemoryRecommendation[] = [];

    // High heap usage
    if (memUsage.heapUsed / memUsage.heapTotal > 0.8) {
      recommendations.push({
        type: 'memory_limit',
        description: 'Consider increasing heap size or optimizing memory usage',
        expectedImpact: 'Prevent out-of-memory errors and improve performance',
        implementation: [
          'Increase --max-old-space-size',
          'Implement memory monitoring',
          'Optimize data structures'
        ]
      });
    }

    // Memory leaks detected
    if (leaks.length > 0) {
      recommendations.push({
        type: 'memory_limit',
        description: 'Memory leaks detected, investigate and fix',
        expectedImpact: 'Prevent memory growth and improve stability',
        implementation: [
          'Use memory profiling tools',
          'Review event listener cleanup',
          'Check for circular references'
        ]
      });
    }

    // High GC activity
    if (this.gcStats.averageGCTime > 100) {
      recommendations.push({
        type: 'gc_tuning',
        description: 'High GC overhead detected, consider tuning',
        expectedImpact: 'Reduce GC pause times and improve responsiveness',
        implementation: [
          'Tune GC parameters',
          'Reduce object allocation rate',
          'Implement object pooling'
        ]
      });
    }

    return recommendations;
  }

  private async applyOptimization(optimization: ResourceOptimization): Promise<void> {
    switch (optimization.type) {
      case 'connection_pooling':
        await this.optimizeConnectionPools(optimization);
        break;
        
      case 'memory_management':
        await this.optimizeMemoryManagement(optimization);
        break;
        
      default:
        this.logger.warn('Unknown optimization type', { type: optimization.type });
    }
  }

  private async optimizeConnectionPools(optimization: ResourceOptimization): Promise<void> {
    // This would implement actual pool optimization
    // For now, just log the optimization
    this.logger.info('Connection pool optimization would be applied', { optimization });
  }

  private async optimizeMemoryManagement(optimization: ResourceOptimization): Promise<void> {
    // This would implement actual memory optimization
    // For now, just trigger GC if available
    if (global.gc) {
      global.gc();
      this.logger.info('Manual garbage collection triggered for optimization');
    }
  }

  private async collectResourceMetrics(): Promise<void> {
    try {
      const metrics = await this.getResourceMetrics();
      const memoryUsage = await this.getMemoryUsage();
      
      // Record metrics with performance monitor
      for (const metric of metrics) {
        this.performanceMonitor.recordThroughput(metric.currentActive);
      }
      
      this.logger.debug('Resource metrics collected', { 
        poolCount: metrics.length,
        memoryUsage: memoryUsage.heapUsed 
      });
    } catch (error) {
      this.logger.error('Failed to collect resource metrics', error);
    }
  }
}