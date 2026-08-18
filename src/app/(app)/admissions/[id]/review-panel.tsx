import { Button } from '@/components/ui/button';
import { fieldClassName, FormField } from '@/components/ui/form-field';
import { hasPermission } from '@/lib/auth/authorization';
import type { AuthContext } from '@/lib/auth/types';
import {
  issueOfferAction,
  registerApplicantAction,
  rejectApplicationAction,
  reviewApplicationAction,
  withdrawStaffApplicationAction,
} from '@/server/admissions/form-actions';

interface CohortOption {
  id: string;
  code: string;
  name: string;
  groups: { id: string; code: string; name: string }[];
}

export function ReviewPanel({
  context,
  applicationId,
  status,
  cohorts,
}: {
  context: AuthContext;
  applicationId: string;
  status: string;
  cohorts: CohortOption[];
}) {
  const canReview = hasPermission(context, 'admissions.review');
  const canApprove = hasPermission(context, 'admissions.approve');
  const canOffer = hasPermission(context, 'admissions.offer');
  const canRegister = hasPermission(context, 'admissions.register');

  return (
    <div className="space-y-6">
      {status === 'SUBMITTED' && canReview ? (
        <form action={reviewApplicationAction} className="space-y-3">
          <input type="hidden" name="applicationId" value={applicationId} />
          <FormField label="Review note" htmlFor="note">
            <input id="note" name="note" className={fieldClassName} />
          </FormField>
          <Button type="submit">Move to review</Button>
        </form>
      ) : null}

      {status === 'UNDER_REVIEW' && canOffer ? (
        <form action={issueOfferAction} className="space-y-3">
          <input type="hidden" name="applicationId" value={applicationId} />
          {cohorts.length > 0 ? (
            <FormField label="Cohort" htmlFor="cohortId">
              <select id="cohortId" name="cohortId" className={fieldClassName}>
                <option value="">Unassigned</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.code}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          <FormField label="Conditions" htmlFor="conditions">
            <input id="conditions" name="conditions" className={fieldClassName} />
          </FormField>
          <FormField label="Offer expires" htmlFor="expiresAt">
            <input id="expiresAt" name="expiresAt" type="date" className={fieldClassName} />
          </FormField>
          <Button type="submit">Issue offer</Button>
        </form>
      ) : null}

      {status === 'ACCEPTED' && canRegister ? (
        <form action={registerApplicantAction} className="space-y-3">
          <input type="hidden" name="applicationId" value={applicationId} />
          {cohorts.length > 0 ? (
            <FormField label="Cohort" htmlFor="register-cohortId">
              <select id="register-cohortId" name="cohortId" className={fieldClassName}>
                <option value="">Keep offer assignment</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.code}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          <Button type="submit">Register student</Button>
        </form>
      ) : null}

      {(status === 'UNDER_REVIEW' || status === 'OFFERED') && canApprove ? (
        <form action={rejectApplicationAction} className="space-y-3">
          <input type="hidden" name="applicationId" value={applicationId} />
          <FormField label="Rejection reason" htmlFor="reject-note">
            <input id="reject-note" name="note" required className={fieldClassName} />
          </FormField>
          <Button type="submit" variant="danger">
            Reject
          </Button>
        </form>
      ) : null}

      {status !== 'ACCEPTED' && status !== 'REJECTED' && status !== 'WITHDRAWN' && canReview ? (
        <form action={withdrawStaffApplicationAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <Button type="submit" variant="secondary">
            Mark withdrawn
          </Button>
        </form>
      ) : null}
    </div>
  );
}
