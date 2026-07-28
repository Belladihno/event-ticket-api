import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appName: process.env.APP_NAME ?? 'EventTicketingAPI',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'event_ticketing',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  qrSigningSecret: process.env.QR_SIGNING_SECRET ?? '',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? '',
  },
  flutterwave: {
    publicKey: process.env.FLW_PUBLIC_KEY ?? '',
    secretKey: process.env.FLW_SECRET_KEY ?? '',
    encryptionKey: process.env.FLW_ENCRYPTION_KEY ?? '',
    webhookHash: process.env.FLW_WEBHOOK_HASH ?? '',
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    eventBannersBucket: process.env.SUPABASE_EVENT_BANNERS_BUCKET ?? 'event-banners',
    ticketsBucket: process.env.SUPABASE_TICKETS_BUCKET ?? 'tickets',
  },
  email: {
    smtpHost: process.env.SMTP_HOST ?? 'smtp.resend.com',
    smtpPort: parseInt(process.env.SMTP_PORT ?? '465', 10),
    smtpUser: process.env.SMTP_USER ?? '',
    smtpPass: process.env.SMTP_PASS ?? '',
    mailFrom: process.env.MAIL_FROM ?? 'noreply@yourdomain.com',
  },
};

export function validateConfig(): void {
  const required: { name: string; value: string }[] = [
    { name: 'JWT_ACCESS_SECRET', value: config.jwt.accessSecret },
    { name: 'JWT_REFRESH_SECRET', value: config.jwt.refreshSecret },
    { name: 'QR_SIGNING_SECRET', value: config.qrSigningSecret },
  ];
  const missing = required.filter((entry) => !entry.value).map((entry) => entry.name);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
