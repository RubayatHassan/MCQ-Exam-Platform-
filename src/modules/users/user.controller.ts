import { Request, Response } from 'express';
import { z } from 'zod';
import { badRequest, ok } from '../../lib/http.js';
import { userService } from './user.service.js';

const profileSchema = z
  .object({ name: z.string().min(2).max(100).optional(), email: z.string().email().optional() })
  .strict()
  .refine((data) => Object.keys(data).length > 0);
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const userController = {
  async profile(req: Request, res: Response) {
    const profile = await userService.getProfile(req.user!.sub);
    if (!profile) return badRequest(res, 'Profile not found', 404);
    return ok(res, profile);
  },
  async updateProfile(req: Request, res: Response) {
    const input = profileSchema.parse(req.body);
    try {
      return ok(res, await userService.updateProfile(req.user!.sub, input));
    } catch (error) {
      if ((error as Error).message === 'EMAIL_IN_USE')
        return badRequest(res, 'Email is already in use', 409);
      throw error;
    }
  },
  async changePassword(req: Request, res: Response) {
    const input = passwordSchema.parse(req.body);
    try {
      await userService.changePassword(req.user!.sub, input.currentPassword, input.newPassword);
      return ok(res, { message: 'Password updated successfully' });
    } catch (error) {
      if ((error as Error).message === 'INVALID_PASSWORD')
        return badRequest(res, 'Current password is incorrect');
      throw error;
    }
  },
};
