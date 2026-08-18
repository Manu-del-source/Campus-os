import { Badge } from '@/components/ui/badge';
import type { ApplicationStatus } from '@/generated/prisma/client';

const tones: Record<ApplicationStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'accent',
  UNDER_REVIEW: 'warning',
  OFFERED: 'accent',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'neutral',
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={tones[status]}>{status.replaceAll('_', ' ').toLowerCase()}</Badge>;
}
