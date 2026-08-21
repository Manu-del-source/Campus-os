import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requirePlatformAdmin } from '@/lib/auth/session';
import { listPlans } from '@/server/subscriptions/plans';
import { formatCurrency, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Plans' };

export default async function PlansPage() {
  await requirePlatformAdmin();
  const plans = await listPlans();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description={`${formatNumber(plans.length)} plan${plans.length === 1 ? '' : 's'}.`}
      />

      {plans.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No plans"
              description="Create plans to offer subscription tiers to institutions."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader
                title={
                  <div className="flex items-center gap-2">
                    {plan.name}
                    {!plan.isActive && <Badge tone="neutral">inactive</Badge>}
                  </div>
                }
                description={plan.description}
              />
              <CardBody>
                <div className="space-y-3">
                  <div className="text-3xl font-bold">
                    {formatCurrency(plan.price)}
                    <span className="text-sm font-normal text-[var(--color-muted-foreground)]">
                      /{plan.interval === 'MONTHLY' ? 'mo' : 'yr'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted-foreground)]">Students</span>
                      <span>{plan.maxStudents ? formatNumber(plan.maxStudents) : 'Unlimited'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted-foreground)]">Staff</span>
                      <span>{plan.maxStaff ? formatNumber(plan.maxStaff) : 'Unlimited'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted-foreground)]">Units</span>
                      <span>{plan.maxUnits ? formatNumber(plan.maxUnits) : 'Unlimited'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted-foreground)]">Storage</span>
                      <span>{plan.maxStorageMb ? `${plan.maxStorageMb} MB` : 'Unlimited'}</span>
                    </div>
                  </div>

                  <div className="border-t border-[var(--color-border)] pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-muted-foreground)]">Active subscriptions</span>
                      <span className="font-medium">{plan._count.subscriptions}</span>
                    </div>
                  </div>

                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {(plan.features as string[]).map((feature) => (
                        <Badge key={feature} tone="accent">{feature}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
