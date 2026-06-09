import { Request, Response } from 'express';

interface Counter { _value: number; inc: (n?: number) => void; reset: () => void; }
interface Gauge { _value: number; set: (n: number) => void; inc: (n?: number) => void; dec: (n?: number) => void; reset: () => void; }
interface Histogram { observe: (value: number) => void; reset: () => void; toPrometheus: (name: string, help: string) => string[]; }

function counter(): Counter {
  let value = 0;
  return {
    get _value() { return value; },
    inc: (n = 1) => { value += n; },
    reset: () => { value = 0; },
  };
}

function gauge(): Gauge {
  let value = 0;
  return {
    get _value() { return value; },
    set: (n) => { value = n; },
    inc: (n = 1) => { value += n; },
    dec: (n = 1) => { value -= n; },
    reset: () => { value = 0; },
  };
}

function histogram(buckets: number[] = [0.01, 0.05, 0.1, 0.5, 1, 2, 5]): Histogram {
  let counts = new Array(buckets.length).fill(0);
  let count = 0;
  let sum = 0;
  return {
    observe: (value) => {
      count++;
      sum += value;
      for (let i = 0; i < buckets.length; i++) {
        if (value <= buckets[i]) { counts[i]++; break; }
      }
    },
    reset: () => { count = 0; sum = 0; counts = counts.map(() => 0); },
    toPrometheus: (name: string, help: string) => {
      const lines: string[] = [];
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} histogram`);
      for (let i = 0; i < buckets.length; i++) {
        lines.push(`${name}_bucket{le="${buckets[i]}"} ${counts[i]}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${count}`);
      lines.push(`${name}_count ${count}`);
      lines.push(`${name}_sum ${sum}`);
      return lines;
    },
  };
}

export const httpRequestDuration = histogram();
export const activeRequests = gauge();
export const rateLimitExceeded = counter();
export const esIndexErrors = counter();

export function metricsMiddleware(req: Request, _res: Response, next: () => void): void {
  activeRequests.inc();
  const start = Date.now();
  _res.on('finish', () => {
    httpRequestDuration.observe((Date.now() - start) / 1000);
    activeRequests.dec();
  });
  next();
}

export function getMetricsText(): string {
  const lines: string[] = [];
  lines.push(...httpRequestDuration.toPrometheus('yotop10_http_request_duration_seconds', 'HTTP request duration'));
  lines.push(`# HELP yotop10_active_requests Active requests\n# TYPE yotop10_active_requests gauge\nyotop10_active_requests ${activeRequests._value}`);
  lines.push(`# HELP yotop10_rate_limit_exceeded_total Rate limit exceeded\n# TYPE yotop10_rate_limit_exceeded_total counter\nyotop10_rate_limit_exceeded_total ${rateLimitExceeded._value}`);
  lines.push(`# HELP yotop10_es_index_errors_total ES index errors\n# TYPE yotop10_es_index_errors_total counter\nyotop10_es_index_errors_total ${esIndexErrors._value}`);
  lines.push('# EOF');
  return lines.join('\n');
}
