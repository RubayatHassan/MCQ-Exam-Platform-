import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_ACCESS_SECRET ?? 'development-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
};
