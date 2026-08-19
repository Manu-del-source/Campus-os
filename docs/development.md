# Development

## Requirements

- Node.js 20+ (developed on 22)
- A PostgreSQL 14+ database, or use the bundled embedded instance below

## Setup

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL / DIRECT_URL
npm run db:generate       # generate the Prisma client into src/generated/prisma
npm run db:deploy         # apply migrations
npm run db:seed           # demo data with Argon2id credentials (development only)
npm run dev
```

### No PostgreSQL to hand?

An embedded PostgreSQL is available for local work and tests — no Docker, no
network:

```bash
npm run db:local          # starts postgres on 127.0.0.1:55432
                          # databases: campusos, campusos_test
npm run db:local -- stop
```

Matching `.env`:

```
DATABASE_URL="postgresql://campusos:campusos@127.0.0.1:55432/campusos"
DIRECT_URL="postgresql://campusos:campusos@127.0.0.1:55432/campusos"
```

### Dev login convenience

Set `CAMPUSOS_DEV_LOGIN_EMAIL` to a seeded user (for example
`admin@demo-college.example`) to browse the institution workspace without entering credentials.
The switch is ignored when `NODE_ENV=production`. Or sign in via `/login` with any seeded demo credentials.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unit + integration) against `DATABASE_URL` — non-destructive lifecycle |
| `npm run test:reset` | **Destructive**: `db:reset`, then `npm test`, then `db:seed` |
| `npm run db:generate` | Prisma client generation |
| `npm run db:migrate create <name>` | Create a migration from schema changes |
| `npm run db:deploy` | Apply pending migrations |
| `npm run db:reset` | Drop everything and re-apply migrations |
| `npm run db:seed` | Seed fictional demo data |
| `npm run db:local` | Start/stop the embedded PostgreSQL |

## Migrations

`scripts/migrate.mts` drives Prisma's schema engine through its WebAssembly
build, so migrations work in environments where `binaries.prisma.sh` is
unreachable. It writes ordinary Prisma migration folders
(`prisma/migrations/<timestamp>_<name>/migration.sql`) plus `migration_lock.toml`,
and records applied migrations in `_prisma_migrations` exactly like the CLI.

Where the network is unrestricted, the standard commands work interchangeably:

```bash
npx prisma migrate dev --name <name>
npx prisma migrate deploy
```

Two constraints of the WebAssembly path:

1. `create` diffs the committed migration history against the datamodel; it
   cannot provision a shadow database, so destructive-change detection is weaker
   than `prisma migrate dev`. Review generated SQL before committing.
2. Partial unique indexes (see `docs/database.md`) are appended by hand.

Note that `prisma generate` also probes for the schema-engine binary. If the
download is blocked, point it at any placeholder file:

```bash
PRISMA_SCHEMA_ENGINE_BINARY=$PWD/.prisma-offline/schema-engine npm run db:generate
```

## Testing

CampusOS uses **one database URL** for development and integration testing:
`DATABASE_URL` (with `DIRECT_URL` for migrations, defaulted from `DATABASE_URL`
when unset). There is no `TEST_DATABASE_URL`.

```bash
npm test          # unit + integration tests against DATABASE_URL
npm run test:watch
npm run test:reset  # DESTRUCTIVE: db:reset, then npm test, then db:seed
```

The test runner loads `.env` (also `.env.local` / `.env.test` / `.env.test.local`,
without overriding variables already exported) and fails fast with an actionable
message when `DATABASE_URL` is missing — integration tests are never silently
skipped.

> **Danger — data loss.** Integration tests run against `DATABASE_URL` itself and
> each suite calls `resetDatabase()`, which truncates the application tables
> (institutions, users, sessions, students, …) before and after it runs. Point
> `DATABASE_URL` only at a development database whose contents are expendable,
> and never run the tests against production. Vitest runs those files in a
> single worker (`fileParallelism: false`) so one suite cannot truncate the
> database while another is still inserting tenant rows.

`npm test` is non-destructive at the *lifecycle* level: the global setup only
verifies the connection and applies pending migrations (`scripts/migrate.mts
deploy`). It never drops the schema. Dropping and rebuilding the database stays
explicit:

```bash
npm run db:reset     # drop everything, re-apply migrations
npm run db:seed      # restore demo data (Argon2id credentials)
```

Re-seed after a test run when you want the demo login credentials back
(`npm run db:seed`).

`tests/integration/tenant-isolation.test.ts` is mandatory: a user from
Institution A must never retrieve Institution B data. Do not merge a change that
weakens it.

## Definition of done for a phase

1. Schema change + migration committed together.
2. Server module with Zod-validated input and explicit permission checks.
3. UI wired to real queries (no invented statistics).
4. Tests for the security-relevant and business-critical paths.
5. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all clean.
6. Documentation updated.
7. Small, meaningful commits (`feat: add admissions workflow`).

## Conventions

- TypeScript `strict`; avoid `any`.
- Server-only modules import `server-only`.
- Validate every external input with Zod at the boundary.
- Prefer Server Components; add `'use client'` only for genuine interactivity.
- Tailwind utilities with the design tokens in `src/app/globals.css`; no ad-hoc
  hex colours.
- Accessible markup: real landmarks, labels, `aria-current`, visible focus.
