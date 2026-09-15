import { Request, Response } from 'express';
import { z } from 'zod';
import { sendResponse } from '../../utils/sendResponse.js';
import { userService } from './user.service.js';

export const userController = {
  async getProfile(req: Request, res: Response) {
    const profile = await userService.getProfile(req.user!.sub);
    return sendResponse(res, profile, 200, 'Profile fetched');
  },
  async updateProfile(req: Request, res: Response) {
    const input = z
      .object({ name: z.string().min(2).max(100).optional(), email: z.string().email().optional() })
      .strict()
      .parse(req.body);
    try {
      return sendResponse(
        res,
        await userService.updateProfile(req.user!.sub, input),
        200,
        'Profile updated',
      );
    } catch (error) {
      if ((error as Error).message === 'EMAIL_IN_USE')
        return res.status(409).json({ success: false, message: 'Email is already in use' });
      throw error;
    }
  },
  async changePassword(req: Request, res: Response) {
    const input = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })
      .parse(req.body);
    try {
      await userService.changePassword(req.user!.sub, input);
      return sendResponse(res, { message: 'Password updated successfully' });
    } catch (error) {
      if ((error as Error).message === 'INVALID_PASSWORD')
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      throw error;
    }
  },
};
