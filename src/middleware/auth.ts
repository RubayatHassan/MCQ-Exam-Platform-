import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env.js';

export type AuthUser = { sub: string; role: Role; email: string };
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth =
  (roles?: Role[]) => (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token)
      return res
        .status(401)
        .json({ success: false, error: { message: 'Authentication required' } });
    try {
      const user = jwt.verify(token, env.jwtSecret) as AuthUser;
      if (roles && !roles.includes(user.role))
        return res
          .status(403)
          .json({ success: false, error: { message: 'Insufficient permissions' } });
      req.user = user;
      next();
    } catch {
      return res
        .status(401)
        .json({ success: false, error: { message: 'Invalid or expired token' } });
    }
  };
