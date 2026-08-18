import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {label}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="text-xs text-[var(--color-muted-foreground)]">{hint}</p> : null}
        </div>
        {icon ? <span className="text-[var(--color-accent)]">{icon}</span> : null}
      </div>
    </Card>
  );
}
