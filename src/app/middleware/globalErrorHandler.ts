import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export const globalErrorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof z.ZodError)
    return res
      .status(422)
      .json({ success: false, message: 'Validation failed', errors: error.flatten() });
  console.error(error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
};
