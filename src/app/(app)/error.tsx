'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Details stay server-side; the browser only ever sees a safe message.
    console.error('Application error');
  }, [error]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        The request could not be completed. If this keeps happening, contact your institution
        administrator.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
