import { execFileSync } from 'node:child_process';
import pg from 'pg';

import { requireDatabaseUrl } from './env';

/**
 * Prepares the database used by the test suite.
 *
 * There is a single database URL for development and integration testing:
 * `DATABASE_URL`. This setup verifies the connection and applies pending
 * migrations with the project's own migration runner (`scripts/migrate.mts`).
 *
 * It never truncates or resets data — destructive resets stay explicit
 * (`npm run db:reset`, or `npm run test:reset`). Individual integration suites
 * do truncate application tables while they run, so never point `DATABASE_URL`
 * at a database whose contents matter.
 */
export async function setup(): Promise<void> {
  const url = requireDatabaseUrl();

  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } catch (error) {
    throw new Error(
      `[tests] Cannot reach DATABASE_URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await client.end().catch(() => {
      /* connection already closed */
    });
  }

  try {
    execFileSync('npx', ['tsx', 'scripts/migrate.mts', 'deploy'], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: process.env.DIRECT_URL ?? url },
    });
  } catch (error) {
    throw new Error(
      `[tests] Failed to apply migrations to DATABASE_URL: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
