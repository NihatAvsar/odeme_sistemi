const nodeEnv = process.env.NODE_ENV ?? 'development';
const adminSecret = process.env.ADMIN_SECRET ?? 'admin-secret';

if (nodeEnv === 'production' && adminSecret === 'admin-secret') {
  throw new Error('ADMIN_SECRET must be configured in production');
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean),
  databaseUrl: process.env.DATABASE_URL ?? '',
  adminSecret,
  logLevel: process.env.LOG_LEVEL ?? (nodeEnv === 'production' ? 'info' : 'debug'),
  trustProxy: process.env.TRUST_PROXY === 'true',
};
