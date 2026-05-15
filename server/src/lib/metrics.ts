import type { NextFunction, Request, Response } from 'express';

const counters = new Map<string, number>();
const durations = new Map<string, { count: number; sum: number }>();

function labelsToString(labels: Record<string, string | number | undefined> = {}) {
  const entries = Object.entries(labels).filter((entry): entry is [string, string | number] => entry[1] !== undefined);
  if (entries.length === 0) return '';
  return `{${entries.map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`).join(',')}}`;
}

function keyFor(name: string, labels: Record<string, string | number | undefined> = {}) {
  return `${name}${labelsToString(labels)}`;
}

export function incrementMetric(name: string, labels?: Record<string, string | number | undefined>, amount = 1) {
  const key = keyFor(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + amount);
}

export function observeDuration(name: string, seconds: number, labels?: Record<string, string | number | undefined>) {
  const key = keyFor(name, labels);
  const current = durations.get(key) ?? { count: 0, sum: 0 };
  durations.set(key, { count: current.count + 1, sum: current.sum + seconds });
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    const labels = { method: req.method, route, status: res.statusCode };
    incrementMetric('http_requests_total', labels);
    if (res.statusCode >= 400) incrementMetric('http_errors_total', labels);
    observeDuration('http_request_duration_seconds', durationSeconds, { method: req.method, route });
  });
  next();
}

export function renderMetrics() {
  const lines = [
    '# TYPE http_requests_total counter',
    '# TYPE http_errors_total counter',
    '# TYPE rate_limit_hits_total counter',
    '# TYPE payment_events_total counter',
    '# TYPE order_request_events_total counter',
    '# TYPE http_request_duration_seconds summary',
  ];

  for (const [key, value] of counters.entries()) {
    lines.push(`${key} ${value}`);
  }
  for (const [key, value] of durations.entries()) {
    lines.push(`${key}_count ${value.count}`);
    lines.push(`${key}_sum ${value.sum}`);
  }

  return `${lines.join('\n')}\n`;
}

export function resetMetrics() {
  counters.clear();
  durations.clear();
}
