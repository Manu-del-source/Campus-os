import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TenantAccessError } from '@/lib/auth/errors';
import { ApplyForm } from '@/app/(marketing)/apply/[slug]/apply-form';
import { getPublicApplyCatalogue } from '@/server/admissions/public';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Apply · ${slug}` };
}

export default async function ApplyInstitutionPage({ params }: PageProps) {
  const { slug } = await params;

  try {
    const catalogue = await getPublicApplyCatalogue(slug);

    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">Apply to {catalogue.name}</h1>
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          Complete the form to create a draft. You can submit it once you have reviewed the
          details. Keep the reference and access token you receive — they are the only way to
          return to this application.
        </p>

        <Card className="mt-8">
          <CardBody>
            {catalogue.intakes.length === 0 || catalogue.programmes.length === 0 ? (
              <EmptyState
                title="Applications are not open"
                description="This institution has no open intake or active programme at the moment."
              />
            ) : (
              <ApplyForm
                slug={catalogue.slug}
                programmes={catalogue.programmes}
                intakes={catalogue.intakes}
                campuses={catalogue.campuses}
              />
            )}
          </CardBody>
        </Card>
      </div>
    );
  } catch (error) {
    if (error instanceof TenantAccessError) notFound();
    throw error;
  }
}
