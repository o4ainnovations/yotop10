import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { redis } from './redis';
import { AppError } from './errors';

export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail';
  observedValue: number | string;
  threshold: number | string;
  observedUnit: string;
}

export interface ComponentHealth {
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number | null;
  detail: string;
}

export interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptime: number;
  timestamp: string;
  components: Record<string, ComponentHealth>;
  checks: HealthCheckResult[];
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number; heapUsagePct: number };
}

function getPackageVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

class HealthCheckRegistry {
  private checks = new Map<string, () => Promise<HealthCheckResult>>();

  register(name: string, check: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, check);
  }

  async runAll(): Promise<{ results: HealthCheckResult[]; componentHealth: Record<string, ComponentHealth> }> {
    const results: HealthCheckResult[] = [];
    const componentHealth: Record<string, ComponentHealth> = {};

    for (const [name, checkFn] of this.checks) {
      try {
        const result = await checkFn();
        results.push(result);
        componentHealth[name] = {
          status: result.status === 'pass' ? 'ok' : 'degraded',
          latencyMs: typeof result.observedValue === 'number' ? result.observedValue : null,
          detail: `${result.observedValue}${result.observedUnit}`,
        };
      } catch (err) {
        results.push({ name, status: 'fail', observedValue: 0, threshold: 'N/A', observedUnit: '' });
        componentHealth[name] = { status: 'down', latencyMs: null, detail: (err as Error).message };
      }
    }

    return { results, componentHealth };
  }

  async generateReport(): Promise<HealthReport> {
    const { results, componentHealth } = await this.runAll();
    const mem = process.memoryUsage();

    const failedChecks = results.filter(r => r.status !== 'pass');
    const criticalFailures = failedChecks.filter(r =>
      r.name === 'mongodb-ping' || r.name === 'redis-ping'
    );
    const overallStatus: HealthReport['status'] =
      criticalFailures.length === 0 ? 'ok'
      : 'down';

    return {
      status: overallStatus,
      version: process.env.APP_VERSION || getPackageVersion(),
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      components: componentHealth,
      checks: results,
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
        rssMb: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
        heapUsagePct: Math.round((mem.heapUsed / mem.heapTotal) * 10000) / 100,
      },
    };
  }
}

export const healthRegistry = new HealthCheckRegistry();

healthRegistry.register('mongodb-ping', async () => {
  const start = Date.now();
  try {
    const db = mongoose.connection.db;
    if (!db) throw new AppError('MongoDB not connected', 'SERVICE_UNAVAILABLE', 503);
    await db.admin().ping();
    const latency = Date.now() - start;
    return { name: 'mongodb-ping', status: latency < 5000 ? 'pass' : 'fail', observedValue: latency, threshold: 5000, observedUnit: 'ms' };
  } catch {
    throw new Error('MongoDB unreachable');
  }
});

healthRegistry.register('redis-ping', async () => {
  const start = Date.now();
  try {
    await redis.ping();
    const latency = Date.now() - start;
    return { name: 'redis-ping', status: latency < 2000 ? 'pass' : 'fail', observedValue: latency, threshold: 2000, observedUnit: 'ms' };
  } catch {
    throw new Error('Redis unreachable');
  }
});

healthRegistry.register('memory-heap', () => {
  const mem = process.memoryUsage();
  const pct = (mem.heapUsed / mem.heapTotal) * 100;
  return Promise.resolve({
    name: 'memory-heap',
    status: pct < 85 ? 'pass' : (pct < 95 ? 'fail' : 'fail'),
    observedValue: Math.round(pct * 100) / 100,
    threshold: '85',
    observedUnit: '%',
  });
});

healthRegistry.register('event-loop-lag', () => {
  return new Promise((resolve) => {
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      resolve({
        name: 'event-loop-lag',
        status: lag < 50 ? 'pass' : (lag < 200 ? 'fail' : 'fail'),
        observedValue: lag,
        threshold: 50,
        observedUnit: 'ms',
      });
    });
  });
});
