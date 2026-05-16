const nodeEnv = process.env.NODE_ENV ?? 'development';
const adminSecret = process.env.ADMIN_SECRET ?? 'admin-secret';
const paymentProvider = process.env.PAYMENT_PROVIDER ?? 'mock-stripe';

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
  paymentProvider,
  iyzicoApiKey: process.env.IYZICO_API_KEY ?? '',
  iyzicoSecretKey: process.env.IYZICO_SECRET_KEY ?? '',
  iyzicoBaseUrl: process.env.IYZICO_BASE_URL ?? 'https://sandbox-api.iyzipay.com',
  iyzicoCallbackUrl: process.env.IYZICO_CALLBACK_URL ?? 'http://localhost:3000/api/webhooks/iyzico/callback',
  logLevel: process.env.LOG_LEVEL ?? (nodeEnv === 'production' ? 'info' : 'debug'),
  trustProxy: process.env.TRUST_PROXY === 'true',
};
