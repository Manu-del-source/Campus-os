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
| CSRF | Mutations run as POST-only Server Actions / route handlers with SameSite, HTTP-only session cookies |
| Secret exposure | Secrets are read through `serverEnv()` in server-only modules; only `NEXT_PUBLIC_APP_URL` is public |
| Insecure file access | Documents are stored in object storage with signed, expiring URLs issued after a server-side permission check; only metadata lives in PostgreSQL. Staff need `documents.read` **and** `students.read`. Learners never receive `documents.read`; they reach their own files through ownership. Probing another student's id or document returns 404, not 403 |
| Replayed payment callbacks | The finance phase records a unique provider transaction reference per payment; callbacks are idempotent and never trusted without server-side verification against the provider |
| Untrusted input | All external input is parsed with Zod before use (see `studentListQuerySchema`) |

## Authentication

CampusOS issues its own sessions. Passwords are hashed with scrypt and stored on
`users.passwordHash`. The raw session token lives only in an HTTP-only, SameSite
cookie; PostgreSQL stores the SHA-256 hash, expiry and revocation timestamp.
Sessions whose user is missing, soft-deleted or not `ACTIVE` are refused.

Institution users are invited or created by administrators — there is no public
self-registration. Platform administrators (`isPlatformAdmin`, `institutionId`
null) remain distinct from institution users. The active tenant is always taken
from the user row, never from the browser.

Development seed accounts use a documented demo password that is hashed at seed
time and is never a production default.

## Auditing

`src/lib/audit.ts` is the only writer to `audit_logs`. Rows are never updated or
deleted by application code. Each entry records actor, institution, action,
entity type/id, a summary, JSON metadata, IP address and user agent. Reading the
trail requires `audit.read` (tenant) or `platform.audit.read` (platform).

## Secrets

- `.env` is git-ignored; `.env.example` documents every variable with placeholders.
- Future M-Pesa Daraja credentials are server-only and must never be prefixed
  `NEXT_PUBLIC_`.
- `src/lib/env.ts` validates the environment with Zod and throws early on
  misconfiguration.

## Reporting

Security issues should be reported privately to the maintainers before any public
disclosure.
