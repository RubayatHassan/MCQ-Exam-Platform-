import { Router } from 'express';
import { Role } from '@prisma/client';
import { auth } from '../../middleware/checkAuth.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { adminController } from './admin.controller.js';

export const AdminRoutes = Router();
AdminRoutes.get('/users', auth(Role.SUPER_ADMIN), catchAsync(adminController.listUsers));
AdminRoutes.post('/users', auth(Role.SUPER_ADMIN), catchAsync(adminController.createUser));
AdminRoutes.get(
  '/exams/:id/results',
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  catchAsync(adminController.results),
);
