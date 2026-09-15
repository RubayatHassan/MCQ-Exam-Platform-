import { Request, Response } from 'express';
import { z } from 'zod';
import { sendResponse } from '../../utils/sendResponse.js';
import { adminService } from './admin.service.js';

export const adminController = {
  async listUsers(_req: Request, res: Response) {
    return sendResponse(res, await adminService.listUsers());
  },
  async createUser(req: Request, res: Response) {
    const input = z
      .object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(['ADMIN', 'STUDENT']),
      })
      .parse(req.body);
    return sendResponse(res, await adminService.createUser(input), 201, 'User created');
  },
  async results(req: Request, res: Response) {
    const id = z.string().min(1).parse(req.params.id);
    const results = await adminService.results(id);
    return sendResponse(res, { examId: id, total: results.length, results });
  },
};
