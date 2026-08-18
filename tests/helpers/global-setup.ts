import { execFileSync } from 'node:child_process';

/**
 * Prepares the integration test database.
 *
 * Integration tests are skipped entirely when `TEST_DATABASE_URL` is not set,
 * so unit tests still run in environments without PostgreSQL.
 */
export async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn('[tests] TEST_DATABASE_URL is not set — database integration tests will be skipped.');
    return;
  }

  execFileSync('npx', ['tsx', 'scripts/migrate.mts', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
