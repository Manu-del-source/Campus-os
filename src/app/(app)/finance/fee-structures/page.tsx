import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requirePermission } from '@/lib/auth/session';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { listFeeStructures } from '@/server/finance/invoices';

export const metadata: Metadata = { title: 'Fee Structures' };

export default async function FeeStructuresPage() {
  const context = await requirePermission('finance.read');
  const structures = await listFeeStructures(context);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Structures"
        description={`${formatNumber(structures.length)} fee structure${structures.length === 1 ? '' : 's'}.`}
      />

      {structures.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No fee structures"
              description="Create fee structures to define charges for programmes."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {structures.map((structure) => (
            <Card key={structure.id}>
              <CardHeader
                title={
                  <div className="flex items-center gap-2">
                    {structure.code} — {structure.name}
                    {!structure.isActive && <Badge tone="neutral">inactive</Badge>}
                  </div>
                }
                description={
                  <div className="flex items-center gap-3 text-xs">
                    {structure.programme && <span>{structure.programme.code}</span>}
                    {structure.cohort && <span>{structure.cohort.code}</span>}
                    <span>{structure.feeItems.length} item{structure.feeItems.length === 1 ? '' : 's'}</span>
                  </div>
                }
              />
              <CardBody className="p-0">
                {structure.feeItems.length > 0 ? (
                  <div className="divide-y divide-[var(--color-border)]">
                    {structure.feeItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <span className="font-medium">{item.code}</span>
                          <span className="mx-2 text-[var(--color-muted-foreground)]">—</span>
                          <span>{item.name}</span>
                          {!item.isMandatory && (
                            <Badge tone="neutral">optional</Badge>
                          )}
                        </div>
                        <span className="font-medium">{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
                    No fee items configured.
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
