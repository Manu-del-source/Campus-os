import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-[var(--color-accent)]">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        The page you requested does not exist, or you do not have access to it.
      </p>
      <ButtonLink href="/">Back to home</ButtonLink>
    </div>
  );
}
