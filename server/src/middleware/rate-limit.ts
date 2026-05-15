import type { NextFunction, Request, Response } from 'express';
import { incrementMetric } from '../lib/metrics.js';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  name: string;
  now?: () => number;
  store?: Map<string, { count: number; resetAt: number }>;
};

export function createRateLimit(options: RateLimitOptions) {
  const store = options.store ?? new Map<string, { count: number; resetAt: number }>();
  const now = options.now ?? Date.now;

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = `${options.name}:${req.ip}`;
    const currentTime = now();
    const current = store.get(key);
    const bucket = !current || current.resetAt <= currentTime ? { count: 0, resetAt: currentTime + options.windowMs } : current;
    bucket.count += 1;
    store.set(key, bucket);

    res.setHeader('ratelimit-limit', String(options.max));
    res.setHeader('ratelimit-remaining', String(Math.max(0, options.max - bucket.count)));
    res.setHeader('ratelimit-reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      incrementMetric('rate_limit_hits_total', { limiter: options.name });
      res.status(429).json({ message: 'Too many requests', code: 'RATE_LIMITED' });
      return;
    }

    next();
  };
}
