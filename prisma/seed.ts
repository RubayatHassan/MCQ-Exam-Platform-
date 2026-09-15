import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!', 12);
  await prisma.user.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL ?? 'superadmin@example.com' },
    update: { role: Role.SUPER_ADMIN, status: 'ACTIVE' },
    create: { name: 'Super Admin', email: process.env.SUPER_ADMIN_EMAIL ?? 'superadmin@example.com', passwordHash, role: Role.SUPER_ADMIN },
  });
}
main().finally(() => prisma.$disconnect());
