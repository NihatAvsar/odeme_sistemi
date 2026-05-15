import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { log, type RequestWithId } from '../lib/logger.js';

type ErrorHandlerOptions = {
  isProduction?: boolean;
};

export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  const isProduction = options.isProduction ?? env.isProduction;

  return (error: unknown, req: RequestWithId, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const statusCode = message === 'CORS origin not allowed' ? 403 : 400;

    log('error', 'request failed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode,
      error: { message, stack: isProduction ? undefined : error instanceof Error ? error.stack : undefined },
    });

    res.status(statusCode).json({
      message: isProduction && statusCode >= 500 ? 'Internal server error' : message,
      code: statusCode === 403 ? 'FORBIDDEN' : 'REQUEST_FAILED',
      requestId: req.requestId,
    });
  };
}

export type ExpressErrorHandler = ReturnType<typeof createErrorHandler>;
