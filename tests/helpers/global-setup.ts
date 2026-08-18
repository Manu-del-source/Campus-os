import { execFileSync } from 'node:child_process';
import pg from 'pg';

/**
 * Prepares the integration test database.
 *
 * Integration tests are skipped cleanly when `TEST_DATABASE_URL` is not set or
 * the database is unreachable, so unit tests still run in all environments.
 */
export async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn('[tests] TEST_DATABASE_URL is not set — database integration tests will be skipped.');
    return;
  }

  try {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
  } catch (error) {
    console.warn(
      `[tests] Cannot reach TEST_DATABASE_URL — database integration tests will be skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    delete process.env.TEST_DATABASE_URL;
    return;
  }

  try {
    execFileSync('npx', ['tsx', 'scripts/migrate.mts', 'deploy'], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    });
  } catch (error) {
    console.warn(
      `[tests] Failed to apply migrations to TEST_DATABASE_URL — skipping integration tests: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    delete process.env.TEST_DATABASE_URL;
  }
}
