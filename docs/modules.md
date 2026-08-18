# Modules

Status legend: **Done** (shipped in the foundation) · **Next** (in the immediate
roadmap) · **Planned** (schema and boundaries designed, not yet built).

## Foundation — Done

| Module | Contents |
| --- | --- |
| Multi-tenancy | `Institution`, `Campus`, tenant guards, tenant-scoped queries and constraints |
| Identity & RBAC | `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, permission catalogue, role defaults |
| Academic structure | `Department`, `AcademicLevel`, `Programme`, `AcademicYear`, `Semester`, `Intake`, `Cohort`, `Group`, `Unit` |
| People | `Staff`, `Student` (full profile + lifecycle status) |
| Admissions | `Application`, `Admission`, public apply → offer → register |
| Documents | `Document` metadata; bytes in object storage; signed downloads |
| Audit | `AuditLog` and the append-only writer |
| Institution workspace | App shell, permission-filtered navigation, dashboard with real aggregates, student register |
| Platform administration | Platform shell and tenant overview |
| Public | Marketing home, sign-in |

## Next

**Institution administration** — profile and settings, user invitations, role
management UI, audit viewer.

**Academic administration** — CRUD for departments, programmes, levels, years,
intakes, cohorts, groups and units, with Zod-validated Server Actions.

## Planned

| Module | Key models | Notes |
| --- | --- | --- |
| Units & registration | `UnitRegistration` | Per student, per semester, capacity and prerequisite checks |
| Timetable | `Room`, `TimetableEntry` | Validation rejects lecturer, room and group clashes before saving |
| Attendance | `AttendanceSession`, `AttendanceRecord` | `PRESENT/ABSENT/LATE/EXCUSED`, percentages derived from sessions, lecturers limited to their own sessions |
| Assessment & results | `Assessment`, `Mark`, `Result`, grading configuration | Marks entry → submission → verification → approval → publication, each stage permission-gated, all changes audited; grading scales are per-institution data, never hard-coded |
| Finance | `FeeStructure`, `FeeItem`, `Invoice`, `InvoiceItem`, `Payment`, `PaymentAllocation`, `Receipt`, `FinancialTransaction` | Double-entry-friendly; balances are derived, never a single mutable field |
| M-Pesa | integration boundary over the finance models | STK push, callback verification, idempotent transaction references, reconciliation, allocation. Credentials stay server-side; no simulated successes |
| Documents (further kinds) | `Document` | Certificates, transcripts and finance artefacts beyond admissions |
| Notifications | `Notification` + channel adapters | In-app and email first; SMS and WhatsApp behind the same interface |
| Reports | — | Reads from real data only |
| Subscriptions | `Plan`, `Subscription`, `SubscriptionEvent`, `UsageRecord` | Configurable limits (students, staff, storage) and feature flags enforced server-side |
| Student portal | — | `/student/**`, mobile-first |
| Staff portal | — | `/staff/**`, scoped to the classes a lecturer is allocated |
