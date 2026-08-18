import { z } from 'zod';

/**
 * Server-side environment contract.
 *
 * Secrets are validated here and MUST never be re-exported through
 * `NEXT_PUBLIC_*`. Client components read only `publicEnv`.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().min(1).optional(),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

let cachedServerEnv: ServerEnv | null = null;

/** Validated server environment. Throws on first use if misconfigured. */
export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid server environment:\n${issues.join('\n')}`);
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/**
 * Public environment. Values are inlined by Next.js at build time, so they are
 * read as explicit property accesses rather than from a dynamic object.
 */
export const publicEnv: PublicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
