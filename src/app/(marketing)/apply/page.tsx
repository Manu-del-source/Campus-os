import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { listPublicInstitutions } from '@/server/admissions/public';

export const metadata: Metadata = { title: 'Apply' };
export const dynamic = 'force-dynamic';

export default async function ApplyIndexPage() {
  const institutions = await listPublicInstitutions();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Apply to a CampusOS institution</h1>
      <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
        Choose an institution that currently has an open intake. You will receive a private
        application reference and access token — keep both to track your application.
      </p>

      <div className="mt-8 space-y-3">
        {institutions.length === 0 ? (
          <EmptyState
            title="No open intakes"
            description="Institutions will appear here when they open an intake for applications."
          />
        ) : (
          institutions.map((institution) => (
            <Card key={institution.slug}>
              <CardBody>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold">{institution.name}</h2>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {[institution.city, institution.type.replaceAll('_', ' ')].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Link
                    href={`/apply/${institution.slug}`}
                    className="text-sm font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
                  >
                    Start application
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
