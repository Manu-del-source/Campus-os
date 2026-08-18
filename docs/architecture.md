# CampusOS architecture

CampusOS is a multi-tenant SaaS platform for colleges and TVET institutions. One
installation serves many independent institutions, each with strictly isolated
data.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router) + React Server Components | Server-first rendering keeps authorization and data access on the server |
| Language | TypeScript, `strict` | No `any` in application code |
| Styling | Tailwind CSS v4 with CSS custom-property design tokens | One design system, no component-library lock-in |
| Database | PostgreSQL (Neon) | Managed hosting, connection pooling, row-level features available later |
| ORM | Prisma 7 with the `@prisma/adapter-pg` driver adapter | Engine-free runtime → deploys cleanly to Vercel |
| Validation | Zod | One schema per input, reused for parsing and types |
| Auth | First-party (Prisma + HTTP-only sessions) | Passwords, sessions and reset tokens live in Neon |

## Layering

```
src/app/**            Routes. Thin: resolve session, call a server module, render.
src/components/**     Presentational building blocks. No data access, no auth logic.
src/server/<module>/  Server-only business logic and queries (tenant-scoped).
src/lib/auth/**       Session resolution, RBAC, tenant guards. The security core.
src/lib/db.ts         Prisma singleton.
src/lib/env.ts        Zod-validated environment. Secrets never reach the client.
prisma/               Schema, migrations, seed.
```

Rules that keep the layering honest:

1. **Routes never query Prisma directly for tenant data.** They call a function in
   `src/server/**`, which starts by asserting permissions and applying the tenant
   filter.
2. **Components never decide authorization.** They may hide affordances, but the
   server has already decided what is allowed.
3. **`server-only` is imported** by every module that must never be bundled into
   the browser (`src/lib/db.ts`, `src/lib/auth/session.ts`, `src/server/**`).

## Route areas

| Area | Route group | Guard |
| --- | --- | --- |
| Public / marketing | `src/app/(marketing)` | none |
| Authentication | `src/app/(auth)` | redirects signed-in users onward |
| Institution workspace | `src/app/(app)` | authenticated **and** bound to an institution |
| Platform administration | `src/app/(platform)` | `isPlatformAdmin` |

`src/middleware.ts` checks for a session cookie and bounces obviously
unauthenticated traffic. It is a convenience, never the security boundary: each
page and server module re-checks on every request.

## Request lifecycle (institution page)

1. Middleware checks that a session cookie is present.
2. The layout calls `getCurrentUser()`, which hashes the cookie, loads the
   `Session` and then the CampusOS `User`, roles, permissions and institution
   from PostgreSQL. The result is memoised per request with React `cache`.
3. The page calls `requirePermission('…')` and passes the resulting context into a
   `src/server/**` function.
4. That function calls `tenantWhere(context)` and includes `institutionId` in the
   Prisma query.
5. Rendered output contains only the caller's tenant data.

## Data access decisions

- **Driver adapter, not the query engine binary.** Prisma 7 talks to PostgreSQL
  through `pg`, so no native engine has to be shipped or downloaded at runtime.
- **UUIDv7 primary keys.** Non-sequential (no enumeration) but index friendly.
- **Soft deletes on records of record** (`Student`, `Staff`, `Programme`,
  `Cohort`, …). Academic and financial history is never destroyed.
- **Append-only audit trail.** `src/lib/audit.ts` is the single writer.

## Offline-capable migration tooling

`prisma migrate` downloads a native schema-engine binary. Where that download is
blocked, `scripts/migrate.mts` drives the same engine through its WebAssembly
build (`@prisma/schema-engine-wasm`) and writes ordinary Prisma migration
folders. Environments with normal network access can use the standard Prisma CLI
interchangeably. See `docs/development.md`.

## Deployment

Vercel-compatible: no native binaries, no long-running processes, all secrets
read from server environment variables. Persistence — including authentication —
is Neon PostgreSQL through Prisma.

## Roadmap after the foundation

Phases are built one at a time, each with schema, server module, UI and tests.
Students & admissions is shipped (`docs/admissions.md`). Next: institution
administration and academic administration, then staff, timetable & attendance,
examinations/results, finance (with the M-Pesa integration boundary), and
subscriptions.
