import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)]',
  accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  success: 'bg-[var(--color-accent-soft)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-surface-muted)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-surface-muted)] text-[var(--color-danger)]',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
