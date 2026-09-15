import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { ChangePasswordPayload, UpdateProfilePayload } from './user.interface.js';

const profileSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
export const userService = {
  getProfile: (id: string) => prisma.user.findUnique({ where: { id }, select: profileSelect }),
  async updateProfile(id: string, payload: UpdateProfilePayload) {
    if (
      payload.email &&
      (await prisma.user.findFirst({ where: { email: payload.email, id: { not: id } } }))
    )
      throw new Error('EMAIL_IN_USE');
    return prisma.user.update({ where: { id }, data: payload, select: profileSelect });
  },
  async changePassword(id: string, payload: ChangePasswordPayload) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !(await bcrypt.compare(payload.currentPassword, user.passwordHash)))
      throw new Error('INVALID_PASSWORD');
    await prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(payload.newPassword, 12) },
    });
  },
};
