# CampusOS

Multi-tenant SaaS for colleges and TVET institutions. One installation serves
many independent institutions — admissions, academics, attendance, examinations
and finance — with strict tenant isolation.

> **Status:** foundation (phase 1). Multi-tenant data model, authentication
> plumbing, RBAC, tenant guards, seed data, institution dashboard and platform
> overview are in place. Remaining modules are listed in `docs/modules.md`.

## Why it is not a school system

CampusOS models post-secondary education directly:

```
Institution → Campus → Department → Programme → Academic level
            → Academic year → Intake → Cohort → Group
            → Semester → Unit
```

No Form 1–4, no streams. Levels, grading, fees, intakes and academic calendars
are per-institution configuration, never hard-coded.

## Stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS v4 · PostgreSQL ·
Prisma 7 · Supabase Auth · Zod · Vitest. Vercel-compatible.

## Quick start

```bash
npm install
cp .env.example .env
npm run db:local          # optional: embedded PostgreSQL for local development
npm run db:generate
npm run db:deploy
npm run db:seed           # fictional demo data
npm run dev
```

Full instructions: `docs/development.md`.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Stack, layering, request lifecycle, deployment |
| [docs/tenant-model.md](docs/tenant-model.md) | Multi-tenancy rules and authorization primitives |
| [docs/database.md](docs/database.md) | Schema conventions, models, indexes, seed data |
| [docs/security.md](docs/security.md) | Threat model and mitigations |
| [docs/modules.md](docs/modules.md) | Module status and roadmap |
| [docs/development.md](docs/development.md) | Setup, scripts, migrations, testing, conventions |

## Tenant isolation

Every institution-owned row carries `institutionId`; the active tenant is
resolved from the authenticated server session and never from client input.
`tests/integration/tenant-isolation.test.ts` proves a user from Institution A
cannot retrieve Institution B data and must always pass.
