import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'development-only-secret-change-me',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
};
