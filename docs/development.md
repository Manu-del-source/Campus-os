# Development

## Requirements

- Node.js 20+ (developed on 22)
- A PostgreSQL 14+ database, or use the bundled embedded instance below

## Setup

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL / DIRECT_URL (and Supabase keys if available)
npm run db:generate       # generate the Prisma client into src/generated/prisma
npm run db:deploy         # apply migrations
npm run db:seed           # demo data (development only)
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

### Working without Supabase credentials

Set `CAMPUSOS_DEV_LOGIN_EMAIL` to a seeded user (for example
`admin@demo-college.example`) to browse the institution workspace without an auth
provider. The switch is ignored when `NODE_ENV=production`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unit + integration) |
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

```bash
npm test                                   # unit tests only
TEST_DATABASE_URL="postgresql://campusos:campusos@127.0.0.1:55432/campusos_test" npm test
```

Integration tests skip themselves when `TEST_DATABASE_URL` is absent, so unit
tests always run. The global setup applies migrations to the test database; each
suite truncates before and after itself.

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
