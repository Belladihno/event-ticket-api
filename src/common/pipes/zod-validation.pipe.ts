import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.filter((p): p is string | number => typeof p !== 'symbol'),
          message: issue.message,
        })),
      });
      return;
    }
    const data = result.data as { body?: Record<string, unknown> };
    if (data.body) {
      req.body = data.body;
    }
    next();
  };
}
