import type { Metadata } from 'next';

import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { requirePermission } from '@/lib/auth/session';
import { getInstitutionProfile } from '@/server/institution/settings';
import { UpdateProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const context = await requirePermission('institution.read');
  const institution = await getInstitutionProfile(context);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Manage your institution profile and configuration.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Institution profile"
            description="Basic information about your institution."
          />
          <CardBody>
            <UpdateProfileForm institution={institution} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Quick info" />
          <CardBody>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Status</dt>
                <dd className="font-medium">{institution.status}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Slug</dt>
                <dd className="font-mono text-xs">{institution.slug}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Timezone</dt>
                <dd>{institution.timezone}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Currency</dt>
                <dd>{institution.currency}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted-foreground)]">Locale</dt>
                <dd>{institution.locale}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
