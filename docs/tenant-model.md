# Tenant model

## The rule

> Every institution-owned row carries `institutionId`, and every query for that
> row includes `institutionId` taken from the authenticated server session.

A tenant id supplied by the client — query string, header, form field, JSON body
— is never read, never trusted and never used to scope a query.

## Who belongs where

| Actor | `User.institutionId` | `isPlatformAdmin` | Can reach |
| --- | --- | --- | --- |
| Institution user (admin, registrar, lecturer, student, …) | the tenant | `false` | `/(app)` for their tenant only |
| Platform administrator | `null` | `true` | `/(platform)` only |

Platform administrators deliberately have **no** implicit access to tenant
records. `assertTenantAccess()` throws for them, and the default platform role
holds only `platform.*` permissions. Cross-tenant reads exist in exactly one
place — `src/server/platform/**` — where aggregates are computed after
`requirePlatformAdmin()`.

## The primitives

`src/lib/auth/authorization.ts` (pure, unit-tested):

| Function | Purpose |
| --- | --- |
| `requireAuthenticated(ctx)` | 401 if there is no session |
| `requirePermission(ctx, …)` | 403 unless every permission is held |
| `requireAnyPermission(ctx, …)` | 403 unless at least one is held |
| `requireRole(ctx, …)` | 403 unless one of the roles is held |
| `requirePlatformAdmin(ctx)` | 403 for institution users |
| `requireInstitutionId(ctx)` | the active tenant, or 403 |
| `tenantWhere(ctx)` | `{ institutionId }` filter for Prisma |
| `assertTenantAccess(ctx, record)` | second line of defence for lookups by id |

`src/lib/auth/session.ts` (server-only) resolves the context from native database sessions +
PostgreSQL and exposes the async wrappers `getCurrentUser()`,
`getCurrentInstitution()`, `requireUser()`, `requirePermission()`,
`requireRole()`, `requirePlatformAdmin()`, `requireInstitution()`.

## Query pattern

```ts
export async function listStudents(context: AuthContext, query: StudentListQuery) {
  requirePermission(context, 'students.read');       // 1. authorize
  const where = { ...tenantWhere(context), deletedAt: null, … }; // 2. scope
  return prisma.student.findMany({ where, … });      // 3. query
}
```

Lookups by primary key use `findFirst({ where: { id, ...tenantWhere(context) } })`
so a foreign id simply does not resolve — the IDOR shape is closed at the query,
not after the fact.

## Database-level scoping

- Business keys are unique **per tenant**: `@@unique([institutionId, code])`,
  `@@unique([institutionId, studentNumber])`, and so on. Two colleges may
  legitimately use the same student number.
- Every tenant table is indexed on `institutionId`, plus composite indexes for the
  common filters (status, programme, cohort, group, intake).
- `onDelete: Cascade` from `Institution` means removing a tenant removes its data.
- Rows with `institutionId IS NULL` (platform roles, platform admins) are
  additionally protected by partial unique indexes; see `docs/database.md`.

## Verification

`tests/integration/tenant-isolation.test.ts` is mandatory and must always pass:

- list queries return only the caller's students,
- a foreign student id resolves to `null`,
- a record loaded carelessly by primary key is still rejected by
  `assertTenantAccess`,
- dashboard aggregates are tenant-scoped,
- a session without an institution cannot run tenant queries,
- missing permissions are rejected before any query runs.

## Future hardening

The schema is compatible with PostgreSQL row-level security. Once the
application role is separated from the migration role, RLS policies keyed on a
session GUC (`app.institution_id`) can be layered underneath these application
guards as defence in depth.
