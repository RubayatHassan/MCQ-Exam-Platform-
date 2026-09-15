import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config/index.js';

export type AuthUser = { sub: string; role: Role; email: string };
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const auth =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
    try {
      const user = jwt.verify(token, config.jwtAccessSecret) as AuthUser;
      if (roles.length && !roles.includes(user.role))
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  };
