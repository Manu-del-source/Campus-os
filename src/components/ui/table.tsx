import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function DataTable({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-[var(--color-border)] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn('border-b border-[var(--color-border)] px-4 py-3 align-middle', className)}>
      {children}
    </td>
  );
}
