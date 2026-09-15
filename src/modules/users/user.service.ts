import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';

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
  async updateProfile(id: string, data: { name?: string; email?: string }) {
    if (
      data.email &&
      (await prisma.user.findFirst({ where: { email: data.email, id: { not: id } } }))
    )
      throw new Error('EMAIL_IN_USE');
    return prisma.user.update({ where: { id }, data, select: profileSelect });
  },
  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash)))
      throw new Error('INVALID_PASSWORD');
    await prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });
  },
};
