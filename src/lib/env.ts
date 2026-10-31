import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000'),
  APP_URL: z.string().optional().transform((val) => {
    if (val && !val.startsWith('http://') && !val.startsWith('https://')) {
      return `https://${val}`;
    }
    if (val) return val;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return 'http://localhost:3000';
  }),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters long'),
  NEXT_PUBLIC_DEMO_MODE: z.string().optional().default('true'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: Record<string, unknown> = process.env): Env {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `CRITICAL: Environment configuration validation failed:\n${errorDetails}\nCheck your .env or .env.local file.`
    );
  }
  return result.data;
}

let parsedEnv: Env;

export function getEnv(): Env {
  if (parsedEnv) return parsedEnv;
  parsedEnv = validateEnv(process.env);
  return parsedEnv;
}

