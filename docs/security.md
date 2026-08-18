# Security

Security is a product requirement, not a hardening pass. The rules below are
enforced in code and covered by tests.

## Principles

1. **The server is the only security boundary.** The browser may hide a button;
   it never decides access. Every page, server module and route handler
   re-authorizes on each request.
2. **Least privilege by role.** There is no generic "admin". Permissions are
   granular (`marks.enter`, `results.approve`, `finance.payment`, …) and roles
   are compositions of them.
3. **Tenant first.** Authorization checks run before the query; the query itself
   carries the tenant filter.
4. **Fail closed.** Missing session → 401. Missing permission → 403. Foreign
   record → 404 (existence of another tenant's data is never confirmed).

## Threats and mitigations

| Threat | Mitigation |
| --- | --- |
| Tenant data leakage | `tenantWhere()` on every tenant query; `assertTenantAccess()` on id lookups; mandatory isolation test suite |
| IDOR | Records are fetched with `findFirst({ where: { id, institutionId } })`, so a foreign id returns `null` |
| Privilege escalation | Roles and permissions are read from the database per request; nothing is taken from client input, cookies or JWT claims the app writes |
| Institution admin reaching platform admin | `isPlatformAdmin` is a database column; `/(platform)` checks it, and no institution role grants `platform.*` |
| Unauthorized marks / finance changes | Separate permissions per workflow stage (`marks.enter`, `marks.submit`, `marks.verify`, `results.approve`, `results.publish`; `finance.invoice`, `finance.payment`, `finance.receipt`) |
| XSS | React escapes by default; no `dangerouslySetInnerHTML` anywhere in the codebase |
| SQL injection | Prisma parameterises all queries; the single raw statement (test truncation helper) uses no user input |
| CSRF | Mutations run as POST-only Server Actions / route handlers with SameSite session cookies managed by Supabase SSR |
| Secret exposure | Secrets are read through `serverEnv()` in server-only modules; only `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL` and the anon key are public |
| Insecure file access | Documents are stored in object storage with signed, expiring URLs issued after a server-side permission check; only metadata lives in PostgreSQL. Staff need `documents.read` **and** `students.read`. Learners never receive `documents.read`; they reach their own files through ownership. Probing another student's id or document returns 404, not 403 |
| Replayed payment callbacks | The finance phase records a unique provider transaction reference per payment; callbacks are idempotent and never trusted without server-side verification against the provider |
| Untrusted input | All external input is parsed with Zod before use (see `studentListQuerySchema`) |

## Authentication

Supabase Auth (GoTrue) handles credentials, email verification, password reset
and session cookies. CampusOS stores no passwords. The application maps
`auth.users.id` to `User.authUserId` and refuses sessions whose CampusOS user is
missing, soft-deleted or not `ACTIVE`.

A development-only impersonation escape hatch (`CAMPUSOS_DEV_LOGIN_EMAIL`) exists
for working without Supabase credentials. It is disabled whenever
`NODE_ENV === 'production'`.

## Auditing

`src/lib/audit.ts` is the only writer to `audit_logs`. Rows are never updated or
deleted by application code. Each entry records actor, institution, action,
entity type/id, a summary, JSON metadata, IP address and user agent. Reading the
trail requires `audit.read` (tenant) or `platform.audit.read` (platform).

## Secrets

- `.env` is git-ignored; `.env.example` documents every variable with placeholders.
- `SUPABASE_SERVICE_ROLE_KEY` and future M-Pesa Daraja credentials are server-only
  and must never be prefixed `NEXT_PUBLIC_`.
- `src/lib/env.ts` validates the environment with Zod and throws early on
  misconfiguration.

## Reporting

Security issues should be reported privately to the maintainers before any public
disclosure.
