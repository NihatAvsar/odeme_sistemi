import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

type Schemas = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = schemas.body?.safeParse(req.body);
    if (body && !body.success) {
      res.status(400).json({ message: 'Validation failed', code: 'VALIDATION_FAILED', issues: body.error.issues });
      return;
    }

    const params = schemas.params?.safeParse(req.params);
    if (params && !params.success) {
      res.status(400).json({ message: 'Validation failed', code: 'VALIDATION_FAILED', issues: params.error.issues });
      return;
    }

    const query = schemas.query?.safeParse(req.query);
    if (query && !query.success) {
      res.status(400).json({ message: 'Validation failed', code: 'VALIDATION_FAILED', issues: query.error.issues });
      return;
    }

    if (body) req.body = body.data;
    if (params) Object.assign(req.params, params.data);
    if (query) Object.assign(req.query, query.data);
    next();
  };
}
