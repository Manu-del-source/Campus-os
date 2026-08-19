/**
 * Prepares environment variables before any module (including the Prisma
 * singleton) is imported.
 *
 * CampusOS uses ONE database URL: `DATABASE_URL`. Unit and integration tests
 * both run against it — there is intentionally no separate test database URL.
 *
 * WARNING: integration tests call `resetDatabase()`, which truncates the
 * application tables of `DATABASE_URL`.
 */
import { requireDatabaseUrl } from './env';

requireDatabaseUrl();

if (!process.env.NODE_ENV) {
  Object.assign(process.env, { NODE_ENV: 'test' });
}
