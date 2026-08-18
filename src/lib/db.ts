import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import { serverEnv } from '@/lib/env';

/**
 * Prisma client singleton.
 *
 * Prisma 7 talks to PostgreSQL through a driver adapter, which keeps the
 * runtime engine-free and therefore deployable to Vercel's serverless and edge
 * build pipeline.
 */
function createPrismaClient(): PrismaClient {
  const env = serverEnv();
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
