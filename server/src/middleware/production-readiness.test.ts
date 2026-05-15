import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { renderMetrics, resetMetrics } from '../lib/metrics.js';
import { sanitizeLogValue } from '../lib/logger.js';
import { createReadinessHandler } from '../lib/readiness.js';
import { createErrorHandler } from './error-handler.js';
import { createRateLimit } from './rate-limit.js';
import { validate } from './validate.js';

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key.toLowerCase()] = value;
    },
  };

  return response;
}

test('validation middleware returns 400 for invalid payload', () => {
  const req = { body: { amount: -1 }, params: {}, query: {} };
  const res = createResponse();
  let nextCalled = false;

  validate({ body: z.object({ amount: z.number().positive() }).strict() })(req as never, res as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual((res.body as { code: string }).code, 'VALIDATION_FAILED');
});

test('rate limit returns 429 after limit is exceeded', () => {
  resetMetrics();
  const limiter = createRateLimit({ name: 'test', windowMs: 60_000, max: 1, now: () => 1, store: new Map() });
  const req = { ip: '127.0.0.1' };
  const first = createResponse();
  const second = createResponse();

  limiter(req as never, first as never, () => undefined);
  limiter(req as never, second as never, () => undefined);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 429);
  assert.deepEqual(second.body, { message: 'Too many requests', code: 'RATE_LIMITED' });
});

test('error handler response does not leak stack traces in production mode', () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    const handler = createErrorHandler({ isProduction: true });
    const res = createResponse();

    handler(new Error('database exploded'), { method: 'GET', path: '/boom', requestId: 'req-1' } as never, res as never, () => undefined);

    assert.equal(res.statusCode, 400);
    assert.equal(JSON.stringify(res.body).includes('stack'), false);
    assert.equal(JSON.stringify(res.body).includes('Error:'), false);
  } finally {
    console.error = originalConsoleError;
  }
});

test('logger sanitizer removes sensitive fields recursively', () => {
  assert.deepEqual(sanitizeLogValue({
    user: 'admin',
    authorization: 'Bearer token',
    nested: { apiSecret: 'hidden', ok: true },
  }), {
    user: 'admin',
    nested: { ok: true },
  });
});

test('readiness handler returns 503 when database check fails', async () => {
  const handler = createReadinessHandler({
    $queryRaw: async () => {
      throw new Error('db down');
    },
  });
  const res = createResponse();

  await handler({} as never, res as never);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { ok: false, dependencies: { database: 'error' } });
});

test('metrics renderer exposes prometheus text format', () => {
  resetMetrics();
  const limiter = createRateLimit({ name: 'metrics-test', windowMs: 60_000, max: 0, now: () => 1, store: new Map() });
  const res = createResponse();

  limiter({ ip: '127.0.0.1' } as never, res as never, () => undefined);
  const metrics = renderMetrics();

  assert.match(metrics, /# TYPE http_requests_total counter/);
  assert.match(metrics, /rate_limit_hits_total\{limiter="metrics-test"\} 1/);
});
