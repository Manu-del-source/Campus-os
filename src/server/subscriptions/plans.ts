import 'server-only';

import { requirePermission } from '@/lib/auth/authorization';
import { DomainError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { createPlanSchema, updatePlanSchema } from '@/server/subscriptions/schemas';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listPlans() {
  return prisma.plan.findMany({
    where: { deletedAt: null },
    orderBy: [{ price: 'asc' }],
    include: { _count: { select: { subscriptions: true } } },
  });
}

export async function getPlanById(id: string) {
  const plan = await prisma.plan.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { subscriptions: true } } },
  });
  if (!plan) throw new DomainError('Plan not found.');
  return plan;
}

// ---------------------------------------------------------------------------
// Mutations (platform admin only)
// ---------------------------------------------------------------------------

export async function createPlan(context: AuthContext, raw: unknown) {
  requirePermission(context, 'platform.subscriptions.manage');
  const input = createPlanSchema.parse(raw);

  const existing = await prisma.plan.findFirst({ where: { code: input.code, deletedAt: null } });
  if (existing) throw new DomainError('A plan with this code already exists.');

  const plan = await prisma.plan.create({
    data: {
      ...input,
      features: input.features,
    },
  });

  await recordAudit(context, {
    action: 'invoice.changed',
    entityType: 'Plan',
    entityId: plan.id,
    summary: `Plan ${plan.code} created (${plan.name})`,
  });

  return plan;
}

export async function updatePlan(context: AuthContext, raw: unknown) {
  requirePermission(context, 'platform.subscriptions.manage');
  const input = updatePlanSchema.parse(raw);

  const existing = await prisma.plan.findFirst({ where: { id: input.id, deletedAt: null } });
  if (!existing) throw new DomainError('Plan not found.');

  const { id, ...data } = input;
  const plan = await prisma.plan.update({
    where: { id },
    data: { ...data, features: data.features ?? undefined },
  });

  return plan;
}

export async function archivePlan(context: AuthContext, id: string) {
  requirePermission(context, 'platform.subscriptions.manage');

  const existing = await prisma.plan.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new DomainError('Plan not found.');

  // Cannot archive a plan with active subscriptions
  const activeCount = await prisma.subscription.count({
    where: { planId: id, status: { in: ['ACTIVE', 'TRIALING'] } },
  });
  if (activeCount > 0) {
    throw new DomainError(`Cannot archive plan with ${activeCount} active subscription${activeCount === 1 ? '' : 's'}. Migrate them first.`);
  }

  await prisma.plan.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
  });

  return { ok: true };
}
