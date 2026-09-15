import { Router } from 'express';
import { Role } from '@prisma/client';
import { auth } from '../../middleware/checkAuth.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { authController } from './auth.controller.js';

export const AuthRoutes = Router();
AuthRoutes.post('/register', catchAsync(authController.register));
AuthRoutes.post('/login', catchAsync(authController.login));
AuthRoutes.get(
  '/me',
  auth(Role.SUPER_ADMIN, Role.ADMIN, Role.STUDENT),
  catchAsync(authController.me),
);
