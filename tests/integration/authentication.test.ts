import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  authenticateUser,
  changePassword,
  createSession,
  hashSessionToken,
  toAuthContext,
} from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { assertTenantAccess, requireInstitutionId, tenantWhere } from '@/lib/auth/authorization';
import { TenantAccessError } from '@/lib/auth/errors';
import {
  disconnectTestPrisma,
  hasTestDatabase,
  resetDatabase,
  seedTenant,
  testPrisma,
  type SeededTenant,
} from '../helpers/db';

describe.skipIf(!hasTestDatabase)('native authentication and session lifecycle', () => {
  let tenantAlpha: SeededTenant;
  let tenantBeta: SeededTenant;
  let adminAlphaId: string;
  let adminBetaId: string;

  const adminPassword = 'DemoAdmin123!';
  const wrongPassword = 'WrongPassword999!';

  beforeAll(async () => {
    await resetDatabase();
    const prisma = testPrisma();

    tenantAlpha = await seedTenant('auth-alpha', ['Learner1']);
    tenantBeta = await seedTenant('auth-beta', ['Learner2']);

    const adminHash = await hashPassword(adminPassword);

    const adminAlpha = await prisma.user.create({
      data: {
        institutionId: tenantAlpha.institutionId,
        email: 'admin@auth-alpha.test',
        firstName: 'Ada',
        lastName: 'Admin',
        status: 'ACTIVE',
        passwordHash: adminHash,
      },
    });
    adminAlphaId = adminAlpha.id;

    const adminBeta = await prisma.user.create({
      data: {
        institutionId: tenantBeta.institutionId,
        email: 'admin@auth-beta.test',
        firstName: 'Bob',
        lastName: 'Admin',
        status: 'ACTIVE',
        passwordHash: adminHash,
      },
    });
    adminBetaId = adminBeta.id;

    // Create a suspended user
    await prisma.user.create({
      data: {
        institutionId: tenantAlpha.institutionId,
        email: 'suspended@auth-alpha.test',
        firstName: 'Sam',
        lastName: 'Suspended',
        status: 'SUSPENDED',
        passwordHash: adminHash,
      },
    });
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  it('authenticates an active user with correct password', async () => {
    const user = await authenticateUser('admin@auth-alpha.test', adminPassword);
    expect(user).not.toBeNull();
    expect(user?.id).toBe(adminAlphaId);
    expect(user?.email).toBe('admin@auth-alpha.test');
    expect(user?.institutionId).toBe(tenantAlpha.institutionId);
    expect(user?.lastLoginAt).toBeInstanceOf(Date);
  });

  it('authenticates case-insensitively for email addresses', async () => {
    const user = await authenticateUser('ADMIN@AUTH-ALPHA.TEST', adminPassword);
    expect(user).not.toBeNull();
    expect(user?.id).toBe(adminAlphaId);
  });

  it('rejects authentication with an incorrect password', async () => {
    const user = await authenticateUser('admin@auth-alpha.test', wrongPassword);
    expect(user).toBeNull();
  });

  it('rejects authentication for a nonexistent user', async () => {
    const user = await authenticateUser('nobody@nowhere.test', adminPassword);
    expect(user).toBeNull();
  });

  it('rejects authentication for a suspended or deactivated user', async () => {
    const user = await authenticateUser('suspended@auth-alpha.test', adminPassword);
    expect(user).toBeNull();
  });

  it('creates a session, stores only tokenHash in DB, and can find it by hash', async () => {
    const prisma = testPrisma();
    const { session, token } = await createSession(adminAlphaId);

    expect(session.id).toBeDefined();
    expect(session.userId).toBe(adminAlphaId);
    expect(session.tokenHash).toBeDefined();
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Raw token must never match the token hash
    expect(token).not.toBe(session.tokenHash);
    expect(session.tokenHash).toBe(hashSessionToken(token));

    // Verify record in database
    const dbSession = await prisma.session.findUnique({
      where: { tokenHash: session.tokenHash },
    });
    expect(dbSession).not.toBeNull();
    expect(dbSession?.userId).toBe(adminAlphaId);
  });

  it('detects and rejects expired sessions', async () => {
    const prisma = testPrisma();
    const { session } = await createSession(adminAlphaId);
    expect(session.id).toBeDefined();

    // Set expiry in the past
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1000 * 60) },
    });

    const expiredSession = await prisma.session.findUnique({
      where: { tokenHash: session.tokenHash },
    });
    expect(expiredSession?.expiresAt.getTime()).toBeLessThan(Date.now());
  });

  it('revokes sessions on logout and prevents further access', async () => {
    const prisma = testPrisma();
    const { session, token } = await createSession(adminAlphaId);
    expect(session.id).toBeDefined();

    const tokenHash = hashSessionToken(token);
    await prisma.session.deleteMany({ where: { tokenHash } });

    const lookup = await prisma.session.findUnique({ where: { tokenHash } });
    expect(lookup).toBeNull();
  });

  it('revokes all sessions for a user upon logoutAllSessions', async () => {
    const prisma = testPrisma();
    const session1 = await createSession(adminBetaId);
    const session2 = await createSession(adminBetaId);
    expect(session1.session.id).toBeDefined();
    expect(session2.session.id).toBeDefined();

    const countBefore = await prisma.session.count({ where: { userId: adminBetaId } });
    expect(countBefore).toBeGreaterThanOrEqual(2);

    await prisma.session.deleteMany({ where: { userId: adminBetaId } });

    const countAfter = await prisma.session.count({ where: { userId: adminBetaId } });
    expect(countAfter).toBe(0);
  });

  it('allows password change for an authenticated user and rejects old password', async () => {
    const userBefore = await authenticateUser('admin@auth-alpha.test', adminPassword);
    expect(userBefore).not.toBeNull();

    const newPassword = 'NewSecretPassword456!';
    const changed = await changePassword(adminAlphaId, adminPassword, newPassword);

    expect(changed).toBe(true);

    // Old password must now fail
    const oldLogin = await authenticateUser('admin@auth-alpha.test', adminPassword);
    expect(oldLogin).toBeNull();

    // New password must succeed
    const newLogin = await authenticateUser('admin@auth-alpha.test', newPassword);
    expect(newLogin).not.toBeNull();
    expect(newLogin?.id).toBe(adminAlphaId);
  });

  it('preserves tenant isolation across authenticated user contexts', async () => {
    const userAlpha = await testPrisma().user.findUnique({
      where: { id: adminAlphaId },
      include: { institution: true, userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });
    const userBeta = await testPrisma().user.findUnique({
      where: { id: adminBetaId },
      include: { institution: true, userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } },
    });

    const contextAlpha = toAuthContext(userAlpha!);
    const contextBeta = toAuthContext(userBeta!);

    expect(requireInstitutionId(contextAlpha)).toBe(tenantAlpha.institutionId);
    expect(requireInstitutionId(contextBeta)).toBe(tenantBeta.institutionId);
    expect(tenantWhere(contextAlpha)).toEqual({ institutionId: tenantAlpha.institutionId });

    // Asserting tenant access against another tenant's record must fail
    expect(() =>
      assertTenantAccess(contextAlpha, { institutionId: tenantBeta.institutionId }),
    ).toThrow(TenantAccessError);
  });
});
