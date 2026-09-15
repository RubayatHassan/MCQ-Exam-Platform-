import { Request, Response } from 'express';
import { z } from 'zod';
import { sendResponse } from '../../utils/sendResponse.js';
import { authService } from './auth.service.js';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string() });
export const authController = {
  async register(req: Request, res: Response) {
    return sendResponse(
      res,
      await authService.register(registerSchema.parse(req.body)),
      201,
      'Registration successful',
    );
  },
  async login(req: Request, res: Response) {
    try {
      return sendResponse(
        res,
        await authService.login(loginSchema.parse(req.body)),
        200,
        'Login successful',
      );
    } catch (error) {
      if ((error as Error).message === 'INVALID_CREDENTIALS')
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      throw error;
    }
  },
  async me(req: Request, res: Response) {
    return sendResponse(res, await authService.getMe(req.user!.sub));
  },
};
