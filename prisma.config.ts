import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * Connection URLs live here (they are no longer allowed in `schema.prisma`).
 * `DIRECT_URL` is preferred for migrations so pooled Neon/PgBouncer
 * connections are bypassed when DDL is applied.
 */
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: migrationUrl,
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});
