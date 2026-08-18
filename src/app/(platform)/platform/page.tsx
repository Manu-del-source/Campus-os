import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { getPlatformOverview } from '@/server/platform/overview';
import { formatDate, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Platform' };

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin();
  const overview = await getPlatformOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Tenants running on this CampusOS installation."
      />

      <section aria-label="Platform figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Institutions" value={formatNumber(overview.institutionCount)} />
        <StatCard label="Active institutions" value={formatNumber(overview.activeInstitutionCount)} />
        <StatCard label="Users" value={formatNumber(overview.userCount)} />
        <StatCard label="Students" value={formatNumber(overview.studentCount)} hint="Across all tenants" />
      </section>

      <Card>
        <CardHeader title="Institutions" description="Each row is an isolated tenant." />
        {overview.institutions.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No institutions yet" description="Create the first tenant to get started." />
          </div>
        ) : (
          <DataTable caption="Institutions">
            <thead>
              <tr>
                <Th>Institution</Th>
                <Th>Slug</Th>
                <Th className="hidden sm:table-cell">Type</Th>
                <Th>Students</Th>
                <Th className="hidden md:table-cell">Created</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {overview.institutions.map((institution) => (
                <tr key={institution.id}>
                  <Td className="font-medium">{institution.name}</Td>
                  <Td className="font-mono text-xs">{institution.slug}</Td>
                  <Td className="hidden sm:table-cell">{institution.type.replaceAll('_', ' ').toLowerCase()}</Td>
                  <Td className="tabular-nums">{formatNumber(institution.studentCount)}</Td>
                  <Td className="hidden md:table-cell">{formatDate(institution.createdAt)}</Td>
                  <Td>
                    <Badge tone={institution.status === 'ACTIVE' ? 'accent' : 'neutral'}>
                      {institution.status.toLowerCase()}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
