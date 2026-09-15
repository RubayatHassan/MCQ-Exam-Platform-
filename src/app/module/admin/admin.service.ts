import bcrypt from 'bcryptjs';
import { AttemptStatus, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const adminService = {
  listUsers: () =>
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    }),
  async createUser(data: {
    name: string;
    email: string;
    password: string;
    role: 'ADMIN' | 'STUDENT';
  }) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role as Role,
        passwordHash: await bcrypt.hash(data.password, 12),
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
  },
  results: (examId: string) =>
    prisma.attempt.findMany({
      where: { examId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED] } },
      orderBy: { score: 'desc' },
      include: { student: { select: { id: true, name: true, email: true } } },
    }),
};
