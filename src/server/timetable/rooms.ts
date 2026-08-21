import 'server-only';

import { requirePermission, tenantWhere } from '@/lib/auth/authorization';
import { DomainError, TenantAccessError } from '@/lib/auth/errors';
import type { AuthContext } from '@/lib/auth/types';
import { recordAudit } from '@/lib/audit';
import { prisma } from '@/lib/db';
import {
  createRoomSchema,
  updateRoomSchema,
  roomListQuerySchema,
  type RoomListQuery,
} from '@/server/timetable/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomListRow {
  id: string;
  code: string;
  name: string;
  building: string | null;
  floor: number | null;
  capacity: number | null;
  roomType: string | null;
  isActive: boolean;
}

export interface RoomListResult {
  rows: RoomListRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listRooms(
  context: AuthContext,
  raw: RoomListQuery,
): Promise<RoomListResult> {
  requirePermission(context, 'academics.read');
  const query = roomListQuerySchema.parse(raw);

  const where = {
    ...tenantWhere(context),
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' as const } },
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { building: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, rooms] = await Promise.all([
    prisma.room.count({ where }),
    prisma.room.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    rows: rooms,
  };
}

export async function getRoomById(context: AuthContext, id: string) {
  requirePermission(context, 'academics.read');

  const room = await prisma.room.findFirst({
    where: { id, ...tenantWhere(context), deletedAt: null },
  });

  if (!room) throw new TenantAccessError();
  return room;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createRoom(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = createRoomSchema.parse(raw);
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.room.findFirst({
    where: { institutionId, code: input.code, deletedAt: null },
  });
  if (existing) throw new DomainError('A room with this code already exists.');

  const room = await prisma.room.create({
    data: { institutionId, ...input },
  });

  await recordAudit(context, {
    action: 'room.created',
    entityType: 'Room',
    entityId: room.id,
    summary: `Room ${room.code} created`,
  });

  return room;
}

export async function updateRoom(context: AuthContext, raw: unknown) {
  requirePermission(context, 'academics.manage');
  const input = updateRoomSchema.parse(raw);

  const existing = await prisma.room.findFirst({
    where: { id: input.id, ...tenantWhere(context), deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  const { id, ...data } = input;
  const room = await prisma.room.update({
    where: { id },
    data,
  });

  await recordAudit(context, {
    action: 'room.updated',
    entityType: 'Room',
    entityId: room.id,
    summary: `Room ${room.code} updated`,
  });

  return room;
}

export async function archiveRoom(context: AuthContext, id: string) {
  requirePermission(context, 'academics.manage');
  const institutionId = tenantWhere(context).institutionId;

  const existing = await prisma.room.findFirst({
    where: { id, institutionId, deletedAt: null },
  });
  if (!existing) throw new TenantAccessError();

  await prisma.room.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
  });

  await recordAudit(context, {
    action: 'room.archived',
    entityType: 'Room',
    entityId: id,
    summary: `Room ${existing.code} archived`,
  });
}
