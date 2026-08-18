/**
 * Local development database (offline friendly).
 *
 * Spins up an embedded PostgreSQL instance so contributors can run migrations,
 * seeds and integration tests without Docker or a hosted database. Production
 * and preview environments use Supabase Postgres instead.
 *
 *   tsx scripts/local-db.ts start
 *   tsx scripts/local-db.ts stop
 */
import EmbeddedPostgres from 'embedded-postgres';

const DATA_DIR = process.env.LOCAL_DB_DIR ?? '/tmp/campusos-pgdata';
const PORT = Number(process.env.LOCAL_DB_PORT ?? 55432);
const USER = 'campusos';
const PASSWORD = 'campusos';
const DATABASES = ['campusos', 'campusos_test'];

function createInstance(): EmbeddedPostgres {
  return new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });
}

async function start(): Promise<void> {
  const pg = createInstance();
  await pg.initialise().catch(() => {
    /* already initialised */
  });
  await pg.start();
  for (const database of DATABASES) {
    await pg.createDatabase(database).catch(() => {
      /* already exists */
    });
  }
  console.log('Local PostgreSQL is running.');
  for (const database of DATABASES) {
    console.log(`  postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${database}`);
  }
}

async function stop(): Promise<void> {
  await createInstance().stop();
  console.log('Local PostgreSQL stopped.');
}

const command = process.argv[2];

const run = command === 'stop' ? stop : start;

run()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
