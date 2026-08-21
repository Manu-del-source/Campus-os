import 'server-only';

import { DomainError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { changePlanSchema, cancelSubscriptionSchema } from '@/server/subscriptions/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstitutionLimits {
  maxStudents: number | null;
  maxStaff: number | null;
  maxStorageMb: number | null;
  maxUnits: number | null;
  currentStudents: number;
  currentStaff: number;
  currentStorageMb: number;
  currentUnits: number;
  features: string[];
  planCode: string;
  planName: string;
}

// ---------------------------------------------------------------------------
// Subscription queries
// ---------------------------------------------------------------------------

export async function getSubscriptionByInstitution(institutionId: string) {
  return prisma.subscription.findFirst({
    where: { institutionId },
    include: {
      plan: true,
      events: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
}

export async function listSubscriptions() {
  return prisma.subscription.findMany({
    orderBy: [{ createdAt: 'desc' }],
    include: {
      institution: { select: { id: true, name: true, slug: true } },
      plan: { select: { code: true, name: true, price: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Subscription mutations
// ---------------------------------------------------------------------------

export async function createSubscription(context: AuthContext, institutionId: string, planId: string) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, deletedAt: null } });
  if (!plan) throw new DomainError('Plan not found.');

  const existing = await prisma.subscription.findFirst({ where: { institutionId } });
  if (existing) throw new DomainError('Institution already has a subscription.');

  const now = new Date();
  const periodEnd = plan.interval === 'MONTHLY'
    ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
    : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  const subscription = await prisma.subscription.create({
    data: {
      institutionId,
      planId,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    include: { plan: true },
  });

  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId: subscription.id,
      type: 'created',
      description: `Subscription created on ${plan.name} plan`,
      performedById: context.userId,
    },
  });

  await recordAudit(context, {
    action: 'invoice.changed',
    entityType: 'Subscription',
    entityId: subscription.id,
    summary: `Subscription created: ${plan.name}`,
  });

  return subscription;
}

export async function changePlan(context: AuthContext, raw: unknown) {
  const input = changePlanSchema.parse(raw);

  const subscription = await prisma.subscription.findFirst({
    where: { institutionId: input.institutionId },
    include: { plan: true },
  });
  if (!subscription) throw new DomainError('No active subscription found.');

  const newPlan = await prisma.plan.findFirst({ where: { id: input.planId, deletedAt: null } });
  if (!newPlan) throw new DomainError('Plan not found.');

  if (subscription.planId === input.planId) {
    throw new DomainError('Already on this plan.');
  }

  // Check if new plan limits would be exceeded
  await checkLimits(input.institutionId, newPlan.id);

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { planId: input.planId },
    include: { plan: true },
  });

  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId: subscription.id,
      type: 'plan_changed',
      description: `Plan changed from ${subscription.plan.name} to ${newPlan.name}`,
      performedById: context.userId,
      metadata: { fromPlanId: subscription.planId, toPlanId: input.planId },
    },
  });

  return updated;
}

export async function cancelSubscription(context: AuthContext, raw: unknown) {
  const input = cancelSubscriptionSchema.parse(raw);

  const subscription = await prisma.subscription.findFirst({
    where: { institutionId: input.institutionId },
    include: { plan: true },
  });
  if (!subscription) throw new DomainError('No active subscription found.');
  if (subscription.status === 'CANCELLED') throw new DomainError('Subscription is already cancelled.');

  const data: Record<string, unknown> = {};
  if (input.cancelAtPeriodEnd) {
    data.cancelAtPeriodEnd = true;
  } else {
    data.status = 'CANCELLED';
    data.cancelledAt = new Date();
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data,
  });

  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId: subscription.id,
      type: input.cancelAtPeriodEnd ? 'cancel_scheduled' : 'cancelled',
      description: input.reason ?? (input.cancelAtPeriodEnd ? 'Cancellation scheduled at period end' : 'Subscription cancelled immediately'),
      performedById: context.userId,
      metadata: { cancelAtPeriodEnd: input.cancelAtPeriodEnd, reason: input.reason },
    },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Limit enforcement
// ---------------------------------------------------------------------------

export async function getInstitutionLimits(institutionId: string): Promise<InstitutionLimits | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { institutionId },
    include: { plan: true },
  });

  if (!subscription || !subscription.plan) return null;

  const plan = subscription.plan;

  const [currentStudents, currentStaff, currentUnits] = await Promise.all([
    prisma.student.count({ where: { institutionId, deletedAt: null } }),
    prisma.staff.count({ where: { institutionId, deletedAt: null } }),
    prisma.unit.count({ where: { institutionId, deletedAt: null } }),
  ]);

  // Storage would need to be tracked via object storage API — placeholder
  const currentStorageMb = 0;

  return {
    maxStudents: plan.maxStudents,
    maxStaff: plan.maxStaff,
    maxStorageMb: plan.maxStorageMb,
    maxUnits: plan.maxUnits,
    currentStudents,
    currentStaff,
    currentStorageMb,
    currentUnits,
    features: (plan.features as string[]) ?? [],
    planCode: plan.code,
    planName: plan.name,
  };
}

async function checkLimits(institutionId: string, planId: string) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, deletedAt: null } });
  if (!plan) throw new DomainError('Plan not found.');

  const [studentCount, staffCount, unitCount] = await Promise.all([
    prisma.student.count({ where: { institutionId, deletedAt: null } }),
    prisma.staff.count({ where: { institutionId, deletedAt: null } }),
    prisma.unit.count({ where: { institutionId, deletedAt: null } }),
  ]);

  if (plan.maxStudents && studentCount > plan.maxStudents) {
    throw new DomainError(`Plan limit exceeded: ${studentCount} students but plan allows ${plan.maxStudents}.`);
  }
  if (plan.maxStaff && staffCount > plan.maxStaff) {
    throw new DomainError(`Plan limit exceeded: ${staffCount} staff but plan allows ${plan.maxStaff}.`);
  }
  if (plan.maxUnits && unitCount > plan.maxUnits) {
    throw new DomainError(`Plan limit exceeded: ${unitCount} units but plan allows ${plan.maxUnits}.`);
  }
}

export async function recordUsage(institutionId: string, metric: string, quantity: number) {
  const subscription = await prisma.subscription.findFirst({
    where: { institutionId, status: { in: ['ACTIVE', 'TRIALING'] } },
  });
  if (!subscription) return;

  // Current billing period
  const now = new Date();
  const periodStart = subscription.currentPeriodStart ?? now;
  const periodEnd = subscription.currentPeriodEnd ?? now;

  await prisma.usageRecord.upsert({
    where: {
      subscriptionId_metric_periodStart: {
        subscriptionId: subscription.id,
        metric,
        periodStart,
      },
    },
    update: { quantity, periodEnd },
    create: {
      subscriptionId: subscription.id,
      metric,
      quantity,
      periodStart,
      periodEnd,
    },
  });
}
