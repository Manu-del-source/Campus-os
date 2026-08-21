import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Td, Th } from '@/components/ui/table';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { listSubscriptions } from '@/server/subscriptions/subscriptions';
import { formatCurrency, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Subscriptions' };

export default async function SubscriptionsPage() {
  await requirePlatformAdmin();
  const subscriptions = await listSubscriptions();

  const statusTone = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success' as const;
      case 'TRIALING': return 'accent' as const;
      case 'PAST_DUE': return 'warning' as const;
      case 'CANCELLED': return 'neutral' as const;
      case 'SUSPENDED': return 'danger' as const;
      default: return 'neutral' as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description={`${formatNumber(subscriptions.length)} subscription${subscriptions.length === 1 ? '' : 's'}.`}
      />

      <Card>
        {subscriptions.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No subscriptions"
              description="Institutions will appear here once they subscribe."
            />
          </div>
        ) : (
          <DataTable caption="Subscriptions">
            <thead>
              <tr>
                <Th>Institution</Th>
                <Th>Plan</Th>
                <Th className="hidden md:table-cell">Price</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Period ends</Th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <Td>
                    <div>
                      <div className="font-medium">{sub.institution.name}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">{sub.institution.slug}</div>
                    </div>
                  </Td>
                  <Td className="font-medium">{sub.plan.name}</Td>
                  <Td className="hidden md:table-cell text-sm">
                    {formatCurrency(sub.plan.price)}/mo
                  </Td>
                  <Td>
                    <Badge tone={statusTone(sub.status)}>
                      {sub.status.toLowerCase()}
                    </Badge>
                  </Td>
                  <Td className="hidden lg:table-cell text-sm text-[var(--color-muted-foreground)]">
                    {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : '—'}
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
