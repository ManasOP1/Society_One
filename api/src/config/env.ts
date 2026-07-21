import { registerAs } from '@nestjs/config';
import { z } from 'zod';

/** Treats blank env vars (common with unfilled optional .env placeholders) as unset. */
const emptyToUndefined = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().optional(),
);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    API_PREFIX: z.string().default('api/v1'),
    DATABASE_URL: z
      .string()
      .min(1)
      .refine(
        (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
        'DATABASE_URL must be a postgres:// or postgresql:// connection string (not prisma+postgres)',
      ),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('7d'),
    REDIS_HOST: z.string().default('127.0.0.1'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    BCRYPT_ROUNDS: z.coerce.number().min(8).max(14).default(10),
    /** Set true for Upstash / other TLS Redis (e.g. rediss://). */
    REDIS_TLS: z
      .string()
      .optional()
      .transform((v) => {
        const s = (v ?? 'false').trim().toLowerCase();
        return s === 'true' || s === '1';
      }),
    /** Optional full URL — overrides host/port/password when set (rediss:// for Upstash). */
    REDIS_URL: emptyToUndefined,
    SUPABASE_URL: z.string().url(),
    /** Preferred name used by Nest services */
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    /** Newer Supabase dashboard key name — mapped to SERVICE_ROLE below */
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    SUPABASE_STORAGE_BUCKET: z.string().default('societyone-docs'),
    RAZORPAY_ENABLED: z
      .string()
      .optional()
      .transform((v) => {
        const s = (v ?? 'false').trim().toLowerCase();
        return s === 'true' || s === '1';
      }),
    RAZORPAY_KEY_ID: emptyToUndefined,
    RAZORPAY_KEY_SECRET: emptyToUndefined,
    RAZORPAY_WEBHOOK_SECRET: emptyToUndefined,
    SMTP_HOST: emptyToUndefined,
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: emptyToUndefined,
    SMTP_PASS: emptyToUndefined,
    SMTP_FROM: z.preprocess((v) => (v === '' ? undefined : v), z.string().email().optional()),
    WHATSAPP_API_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
    WHATSAPP_API_TOKEN: emptyToUndefined,
    THROTTLE_TTL_MS: z.coerce.number().default(60_000),
    THROTTLE_LIMIT: z.coerce.number().optional(),
    /** pg.Pool max connections per API instance (Supabase pooler ~15–20 total). */
    DB_POOL_MAX: z.coerce.number().default(10),
    DB_POOL_IDLE_MS: z.coerce.number().default(30_000),
    DB_POOL_CONN_TIMEOUT_MS: z.coerce.number().default(30_000),
    APP_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
    CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8081'),
  })
  .superRefine((data, ctx) => {
    if (!data.SUPABASE_SERVICE_ROLE_KEY && !data.SUPABASE_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message: 'Provide SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY',
      });
    }
  })
  .transform((data) => ({
    ...data,
    SUPABASE_SERVICE_ROLE_KEY:
      data.SUPABASE_SERVICE_ROLE_KEY ?? data.SUPABASE_SECRET_KEY!,
    THROTTLE_LIMIT:
      data.THROTTLE_LIMIT ??
      (data.NODE_ENV === 'development' ? 600 : 120),
  }));

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  return parsed.data;
}

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  publicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:4000',
}));
