import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './app/config/index.js';
import { AuthRoutes } from './app/module/auth/auth.route.js';
import { UserRoutes } from './app/module/user/user.route.js';
import { AdminRoutes } from './app/module/admin/admin.route.js';
import { assessmentRouter } from './app/module/assessment/assessment.route.js';
import { globalErrorHandler } from './app/middleware/globalErrorHandler.js';
import { notFound } from './app/middleware/notFound.js';

export const app = express();
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
app.get('/', (_req, res) => res.json({ success: true, message: 'MCQ Exam Platform Backend' }));
app.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/v1/auth', AuthRoutes);
app.use('/api/v1/students', UserRoutes);
app.use('/api/v1/admin', AdminRoutes);
app.use('/', assessmentRouter);
app.use(notFound);
app.use(
  globalErrorHandler as (error: unknown, req: Request, res: Response, next: NextFunction) => void,
);
