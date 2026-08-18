# Admissions and student management

Phase 2 of CampusOS. Applicants apply in public, staff review and offer
admission, and registration promotes an accepted applicant into a `Student`
with a `User` account.

## Application workflow

```
DRAFT → SUBMITTED → UNDER_REVIEW → OFFERED → ACCEPTED
                       ↘ REJECTED / WITHDRAWN
          ↘ WITHDRAWN                 ↘ REJECTED / WITHDRAWN
```

| From | To | Who |
| --- | --- | --- |
| `DRAFT` | `SUBMITTED` | Applicant (public token) |
| `DRAFT` / `SUBMITTED` / `UNDER_REVIEW` / `OFFERED` | `WITHDRAWN` | Applicant or staff with `admissions.review` |
| `SUBMITTED` | `UNDER_REVIEW` | Staff with `admissions.review` |
| `UNDER_REVIEW` | `OFFERED` | Staff with `admissions.offer` |
| `UNDER_REVIEW` / `OFFERED` | `REJECTED` | Staff with `admissions.approve` |
| `OFFERED` | `ACCEPTED` | Applicant accepting the offer |

`ACCEPTED`, `REJECTED` and `WITHDRAWN` are terminal. Illegal transitions throw
a `DomainError` (HTTP 400). The graph lives in
`src/server/admissions/workflow.ts` and is unit-tested.

A public application is identified by a non-sequential reference
(`APP-2026-K7M2QX`) plus an opaque access token. Only the SHA-256 of the token
is stored. A wrong token is indistinguishable from a missing record (404).

## Offers and registration

Issuing an offer (`admissions.offer`) creates an `Admission` row and a private
offer-letter document. The applicant accepts with the public token; staff then
register (`admissions.register` + `students.create`):

1. A `User` is created in `INVITED` status (no password is stored).
2. The tenant `STUDENT` role is assigned when it exists.
3. A `Student` is created in `ADMITTED` with a tenant-scoped student number
   and the application reference copied across.
4. Application documents are linked to the new student.

Student numbers and application references are allocated with collision retry.
They are unique per institution, never globally.

## Tenant isolation and IDOR

Every application, admission and document carries `institutionId`. Staff queries
use `findFirst({ id, ...tenantWhere(context) })`, so a foreign id does not
resolve. Public lookups are scoped by institution slug + reference + token.

`getStudentForViewer` is the student-profile entry point:

- Staff with `students.read` see any student in their tenant.
- A learner may only see the record linked to their own `User`.
- A learner probing another student's id receives **404**, never 403, so the
  existence of that record is not confirmed.

## Private document access

Bytes live in object storage (the local-disk adapter writes under
`.data/documents` or `DOCUMENT_STORAGE_DIR`). PostgreSQL stores metadata only.
Downloads are short-lived HMAC URLs issued after a server-side check
(`/api/documents/:id`).

Staff may read a document only when they hold **both** `documents.read` and
`students.read`. `documents.read` alone is a 403.

The `STUDENT` role no longer carries `documents.read`. Learners reach their own
files through ownership (the linked student record or the parent application's
email), not through the staff permission. Probing another student's document is
a 404.

## Permissions added in this phase

| Key | Meaning |
| --- | --- |
| `admissions.offer` | Issue an offer letter |
| `admissions.register` | Promote an accepted applicant to a student |

Existing keys `admissions.read`, `admissions.review` and `admissions.approve`
are unchanged. Registrars hold the full set; admissions officers can review,
offer and register but cannot reject.

## Surfaces

| Route | Audience |
| --- | --- |
| `/apply` | Public list of institutions with an open intake |
| `/apply/[slug]` | Public application form |
| `/apply/[slug]/[reference]?token=` | Applicant status, submit, accept, withdraw |
| `/admissions` | Staff inbox |
| `/admissions/[id]` | Review, offer, reject, register |
| `/students/[id]` | Student profile (`getStudentForViewer`) |
| `/api/documents/[id]` | Private download |

## Tests

`tests/unit/application-workflow.test.ts` covers the transition graph,
reference generation and signed download tokens.
`tests/integration/admissions.test.ts` walks the public → offer → register
path, including illegal skips and missing permissions.
`tests/integration/documents.test.ts` covers the staff/learner access matrix.
The mandatory tenant-isolation suite now also asserts application and document
queries cannot cross tenants.
