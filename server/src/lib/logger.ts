import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

const sensitiveKeyPattern = /password|token|secret|card|cvv|cvc|pan|authorization|cookie|session/i;
const levelPriority = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type LogLevel = keyof typeof levelPriority;

function shouldLog(level: LogLevel) {
  const configured = env.logLevel in levelPriority ? (env.logLevel as LogLevel) : 'info';
  return levelPriority[level] >= levelPriority[configured];
}

export function sanitizeLogValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeLogValue);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKeyPattern.test(key))
      .map(([key, childValue]) => [key, sanitizeLogValue(childValue)]),
  );
}

export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}) {
  if (!shouldLog(level)) return;
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...sanitizeLogValue(fields) as Record<string, unknown>,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export type RequestWithId = Request & { requestId?: string };

export function requestLogger(req: RequestWithId, res: Response, next: NextFunction) {
  const requestId = req.header('x-request-id') ?? randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const startedAt = Date.now();

  log('info', 'request started', { requestId, method: req.method, path: req.path, ip: req.ip });

  res.on('finish', () => {
    log(res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info', 'request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}
