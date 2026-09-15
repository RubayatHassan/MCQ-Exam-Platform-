import { Response } from 'express';

export const sendResponse = (res: Response, data: unknown, statusCode = 200, message = 'Success') =>
  res.status(statusCode).json({ success: true, statusCode, message, data });
