import { PageHeader } from '@/components/ui/page-header';

import { ChangePasswordForm } from './change-password-form';

export const dynamic = 'force-dynamic';

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader
        title="Change password"
        description="Choose a new password for your CampusOS account. Other sessions will be signed out."
      />
      <div className="rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
