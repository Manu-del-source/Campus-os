import { DomainError } from '@/lib/auth/errors';
import type { ApplicationStatus } from '@/generated/prisma/client';

/**
 * Legal status transitions for an application.
 *
 *   DRAFT → SUBMITTED → UNDER_REVIEW → OFFERED → ACCEPTED
 *                         ↘ REJECTED / WITHDRAWN
 *              ↘ WITHDRAWN              ↘ REJECTED / WITHDRAWN
 *
 * Terminal states (ACCEPTED, REJECTED, WITHDRAWN) have no outbound edges.
 */
export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN'],
  UNDER_REVIEW: ['OFFERED', 'REJECTED', 'WITHDRAWN'],
  OFFERED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export const TERMINAL_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
];

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return APPLICATION_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError(`Cannot move an application from ${from} to ${to}.`);
  }
}

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return TERMINAL_APPLICATION_STATUSES.includes(status);
}
