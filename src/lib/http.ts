import { NextFunction, Request, RequestHandler, Response } from 'express';

export const asyncHandler =
  (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

export const badRequest = (res: Response, message: string, status = 400) =>
  res.status(status).json({ success: false, error: { message } });
