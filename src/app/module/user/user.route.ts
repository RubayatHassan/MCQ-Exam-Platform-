import { Router } from 'express';
import { Role } from '@prisma/client';
import { auth } from '../../middleware/checkAuth.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { userController } from './user.controller.js';

export const UserRoutes = Router();
UserRoutes.get('/me/profile', auth(Role.STUDENT), catchAsync(userController.getProfile));
UserRoutes.patch('/me/profile', auth(Role.STUDENT), catchAsync(userController.updateProfile));
UserRoutes.patch('/me/password', auth(Role.STUDENT), catchAsync(userController.changePassword));
