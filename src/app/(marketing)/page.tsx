import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';

const modules = [
  {
    title: 'Admissions',
    body: 'Online applications, document review, offers and registration — with an auditable decision trail.',
  },
  {
    title: 'Academics',
    body: 'Departments, programmes, levels, intakes, cohorts, groups, semesters and units, configured per institution.',
  },
  {
    title: 'Timetable & attendance',
    body: 'Conflict-checked scheduling for lecturers, rooms and groups, with attendance captured against real sessions.',
  },
  {
    title: 'Examinations & results',
    body: 'Marks entry, submission, verification, approval and publication — each stage bound to a role.',
  },
  {
    title: 'Finance',
    body: 'Fee structures, invoices, payments, allocations and receipts. Built so M-Pesa Daraja plugs in without redesign.',
  },
  {
    title: 'Platform administration',
    body: 'Run many institutions on one installation: plans, subscriptions, usage and strict tenant isolation.',
  },
];

export default function MarketingHomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--color-accent)]">
          Multi-tenant SaaS for colleges &amp; TVET institutions
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
          One platform to run admissions, academics, examinations and finance.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-[var(--color-muted-foreground)] sm:text-lg">
          CampusOS is built for post-secondary institutions — programmes, intakes, cohorts and units,
          not school forms and streams. Every institution runs in its own isolated tenant.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/login" size="lg">
            Sign in
          </ButtonLink>
          <ButtonLink href="/contact" size="lg" variant="secondary">
            Talk to us
          </ButtonLink>
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-6xl gap-px bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <article key={module.title} className="bg-[var(--color-surface)] p-6">
              <h2 className="text-sm font-semibold">{module.title}</h2>
              <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{module.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Designed for tenant isolation</h2>
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          Every record belongs to exactly one institution. The active tenant is resolved from the
          authenticated server session — never from a value supplied by the browser — and
          authorization is enforced in server code before any query runs.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/features" className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline">
            Explore the platform architecture
          </Link>
        </p>
      </section>
    </>
  );
}
