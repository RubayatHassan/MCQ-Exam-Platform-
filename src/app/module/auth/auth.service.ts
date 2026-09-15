import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { prisma } from '../../lib/prisma.js';
import { LoginPayload, RegisterPayload } from './auth.interface.js';

export const authService = {
  async register(payload: RegisterPayload) {
    const passwordHash = await bcrypt.hash(payload.password, 12);
    return prisma.user.create({
      data: { name: payload.name, email: payload.email, passwordHash },
      select: { id: true, name: true, email: true, role: true },
    });
  },
  async login(payload: LoginPayload) {
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !(await bcrypt.compare(payload.password, user.passwordHash))
    )
      throw new Error('INVALID_CREDENTIALS');
    const accessToken = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      config.jwtAccessSecret,
      { expiresIn: config.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'] },
    );
    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  },
  getMe: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, status: true },
    }),
};
