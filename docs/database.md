# Database

Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/`.

## Conventions

- **Primary keys**: UUIDv7 (`@default(uuid(7)) @db.Uuid`) — non-sequential, so ids
  cannot be enumerated, but still index-friendly.
- **Tenant column**: every institution-owned table has `institutionId` with an
  index and a cascading foreign key to `institutions`.
- **Business keys are tenant-scoped**: `@@unique([institutionId, <key>])`.
- **Soft deletes**: `deletedAt` on records of record (institutions, campuses,
  departments, programmes, cohorts, groups, units, staff, students, users).
  Student records are never hard-deleted.
- **Timestamps**: `createdAt` / `updatedAt` everywhere except the append-only
  audit trail, which has `createdAt` only.
- **Table names** are snake_case plurals via `@@map`; model names stay singular
  PascalCase.

## Models in the foundation (phase 1)

### Tenancy
| Model | Notes |
| --- | --- |
| `Institution` | Tenant root: slug, type, status, locale/currency/timezone, JSON `settings` |
| `Campus` | Physical sites, `@@unique([institutionId, code])` |

### Identity & access
| Model | Notes |
| --- | --- |
| `User` | `authUserId` maps to Supabase Auth; `institutionId` null only for platform admins |
| `Role` | System roles per tenant; `institutionId = null` for the platform role |
| `Permission` | Global catalogue keyed `module.action` (`students.read`) |
| `RolePermission` | Role → permission grants |
| `UserRole` | Assignment, with `institutionId` denormalised for tenant filtering |

### Academic structure
| Model | Notes |
| --- | --- |
| `Department` | Optional campus, optional head of department |
| `AcademicLevel` | Configurable qualification ladder (`rank` orders it) — never hard-coded |
| `Programme` | Code, duration + `durationUnit`, `stages`, examining body, accreditation |
| `AcademicYear` | `isCurrent`, status |
| `Semester` | Sequence within the year, `@@unique([academicYearId, sequence])` |
| `Intake` | January/May/September style intakes with application windows |
| `Cohort` | One programme intake, e.g. `ICT-DIP-SEP26` |
| `Group` | Teachable subdivision of a cohort (`…-A`, `…-B`) — the timetable/attendance unit |
| `Unit` | Module belonging to a programme, with level, semester, stage, credits |

### People
| Model | Notes |
| --- | --- |
| `Staff` | Staff number, category, employment status, department, campus, optional linked `User` |
| `Student` | Full learner profile, programme/level/intake/cohort/group/campus, `StudentStatus` lifecycle |

### Admissions (phase 2)
| Model | Notes |
| --- | --- |
| `Application` | Public application; unique `(institutionId, reference)`; hashed access token |
| `Admission` | Offer + registration link from an application to a `Student` |
| `Document` | Metadata only (`storageKey`, checksum, visibility); bytes live in object storage |

### Audit
| Model | Notes |
| --- | --- |
| `AuditLog` | Append-only: actor, institution, action, entity, metadata, IP, user agent |

The academic hierarchy is deliberately college/TVET-shaped:

```
Institution → Campus → Department → Programme → Academic level
            → Academic year → Intake → Cohort → Group
            → Semester → Unit
```

There is no Form 1–4 ladder and no "stream" entity. A `Group` plays the role a
stream plays elsewhere: timetabling, attendance, lecturer allocation and class
lists.

## Indexes

Beyond the primary keys and tenant-scoped unique constraints:

- `institutionId` on every tenant table.
- `students`: `(institutionId, status)`, `(institutionId, programmeId)`,
  `(institutionId, cohortId)`, `(institutionId, groupId)`,
  `(institutionId, intakeId)`, `(institutionId, lastName)`;
  unique `(institutionId, studentNumber)` and `(institutionId, applicationReference)`.
- `staff`: `(institutionId, departmentId)`, `(institutionId, employmentStatus)`.
- `programmes`: `(institutionId, departmentId)`, `(institutionId, levelId)`.
- `intakes`: `(institutionId, academicYearId)`, `(institutionId, status)`.
- `academic_years` / `semesters`: `(institutionId, isCurrent)`.
- `audit_logs`: `(institutionId, createdAt)`, `(institutionId, entityType, entityId)`.

Payment/invoice reference indexes arrive with the finance phase.

## Manually maintained partial indexes

PostgreSQL treats `NULL`s as distinct, so composite unique constraints on
`(institutionId, …)` do not constrain platform-scoped rows. The initial
migration therefore adds three partial unique indexes:

```sql
CREATE UNIQUE INDEX "roles_platform_key_key"            ON "roles"("key")               WHERE "institutionId" IS NULL;
CREATE UNIQUE INDEX "users_platform_email_key"          ON "users"("email")             WHERE "institutionId" IS NULL;
CREATE UNIQUE INDEX "user_roles_platform_user_role_key" ON "user_roles"("userId","roleId") WHERE "institutionId" IS NULL;
```

Prisma cannot express partial indexes, so if migrations are ever regenerated from
scratch these three statements must be re-appended.

## Seed data

`prisma/seed.ts` creates **clearly fictional** demo data and refuses to run in
production. It seeds two independent tenants — *CampusOS Demo College* and
*Harbour Point Technical Institute* — which makes tenant isolation observable in
the UI, plus the permission catalogue, system roles, demo users for each role,
levels, departments, programmes, an academic year with three semesters, three
intakes, units, a cohort with two groups, staff and students.
