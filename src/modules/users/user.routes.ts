import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { userController } from './user.controller.js';

export const userRouter = Router();
userRouter.get('/me/profile', requireAuth([Role.STUDENT]), asyncHandler(userController.profile));
userRouter.patch(
  '/me/profile',
  requireAuth([Role.STUDENT]),
  asyncHandler(userController.updateProfile),
);
userRouter.patch(
  '/me/password',
  requireAuth([Role.STUDENT]),
  asyncHandler(userController.changePassword),
);
