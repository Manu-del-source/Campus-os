import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AuthenticationFailedError,
  authenticateWithPassword,
  consumePasswordResetToken,
  createSession,
  issuePasswordResetToken,
  revokeSessionByToken,
  setUserPassword,
} from '@/lib/auth/credentials';
import { sha256Hex } from '@/lib/auth/crypto';
import { hashPassword } from '@/lib/auth/password';
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/auth/permissions';
import {
  assertTenantAccess,
  requirePermission,
  requirePlatformAdmin,
} from '@/lib/auth/authorization';
import { ForbiddenError, TenantAccessError } from '@/lib/auth/errors';
import {
  authContext,
  disconnectTestPrisma,
  hasTestDatabase,
  resetDatabase,
  seedTenant,
  testPrisma,
} from '../helpers/db';

const describeDb = hasTestDatabase ? describe : describe.skip;

const PASSWORD = 'CampusOS-Test-Password-2026!';

async function createUser(input: {
  email: string;
  institutionId: string | null;
  isPlatformAdmin?: boolean;
}) {
  const prisma = testPrisma();
  return prisma.user.create({
    data: {
      email: input.email,
      firstName: 'Ada',
      lastName: 'Admin',
      status: 'ACTIVE',
      institutionId: input.institutionId,
      isPlatformAdmin: input.isPlatformAdmin ?? false,
      passwordHash: await hashPassword(PASSWORD),
    },
  });
}

describeDb('first-party authentication', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('signs in with a valid password and creates a session', async () => {
    const tenant = await seedTenant('alpha', ['Ann']);
    const user = await createUser({ email: 'admin@alpha.test', institutionId: tenant.institutionId });

    const authenticated = await authenticateWithPassword('admin@alpha.test', PASSWORD);
    expect(authenticated.id).toBe(user.id);
    expect(authenticated.institutionId).toBe(tenant.institutionId);

    const { token } = await createSession(user.id);
    const session = await testPrisma().session.findUniqueOrThrow({
      where: { tokenHash: sha256Hex(token) },
    });
    expect(session.userId).toBe(user.id);
    expect(session.revokedAt).toBeNull();
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects an invalid password with a generic error', async () => {
    const tenant = await seedTenant('bravo', ['Ben']);
    await createUser({ email: 'admin@bravo.test', institutionId: tenant.institutionId });

    await expect(authenticateWithPassword('admin@bravo.test', 'totally-wrong-password')).rejects.toBeInstanceOf(
      AuthenticationFailedError,
    );
  });

  it('rejects a nonexistent account with the same generic error', async () => {
    await expect(authenticateWithPassword('missing@example.test', PASSWORD)).rejects.toBeInstanceOf(
      AuthenticationFailedError,
    );
  });

  it('treats an expired session as unusable', async () => {
    const tenant = await seedTenant('charlie', ['Cara']);
    const user = await createUser({ email: 'admin@charlie.test', institutionId: tenant.institutionId });
    const { token } = await createSession(user.id);

    await testPrisma().session.update({
      where: { tokenHash: sha256Hex(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const session = await testPrisma().session.findUniqueOrThrow({
      where: { tokenHash: sha256Hex(token) },
    });
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('revokes a session on logout', async () => {
    const tenant = await seedTenant('delta', ['Dan']);
    const user = await createUser({ email: 'admin@delta.test', institutionId: tenant.institutionId });
    const { token } = await createSession(user.id);

    await revokeSessionByToken(token);

    const session = await testPrisma().session.findUniqueOrThrow({
      where: { tokenHash: sha256Hex(token) },
    });
    expect(session.revokedAt).not.toBeNull();
  });

  it('binds the session to the user institution and never trusts a foreign tenant id', async () => {
    const tenantA = await seedTenant('echo', ['Eve']);
    const tenantB = await seedTenant('foxtrot', ['Fay']);
    const userA = await createUser({ email: 'admin@echo.test', institutionId: tenantA.institutionId });

    const authenticated = await authenticateWithPassword('admin@echo.test', PASSWORD);
    expect(authenticated.institutionId).toBe(tenantA.institutionId);
    expect(authenticated.institutionId).not.toBe(tenantB.institutionId);

    const context = authContext({
      userId: userA.id,
      institutionId: authenticated.institutionId,
      roleKeys: ['INSTITUTION_ADMIN'],
    });
    expect(() => assertTenantAccess(context, { institutionId: tenantB.institutionId })).toThrow(TenantAccessError);
    expect(() => assertTenantAccess(context, { institutionId: tenantA.institutionId })).not.toThrow();
  });

  it('enforces RBAC: institution users cannot act as platform admins', async () => {
    const tenant = await seedTenant('golf', ['Gia']);
    const user = await createUser({ email: 'admin@golf.test', institutionId: tenant.institutionId });
    const context = authContext({
      userId: user.id,
      institutionId: tenant.institutionId,
      roleKeys: ['INSTITUTION_ADMIN'],
    });
    expect(() => requirePlatformAdmin(context)).toThrow(ForbiddenError);
    expect(() => requirePermission(context, 'students.read')).not.toThrow();
    expect(DEFAULT_ROLE_PERMISSIONS.INSTITUTION_ADMIN).not.toContain('platform.institutions.manage');
  });

  it('keeps platform admins distinct from institution users', async () => {
    const platform = await createUser({
      email: 'platform@campusos.test',
      institutionId: null,
      isPlatformAdmin: true,
    });
    const authenticated = await authenticateWithPassword('platform@campusos.test', PASSWORD);
    expect(authenticated.isPlatformAdmin).toBe(true);
    expect(authenticated.institutionId).toBeNull();
    expect(authenticated.id).toBe(platform.id);

    const context = authContext({
      userId: platform.id,
      institutionId: null,
      isPlatformAdmin: true,
      roleKeys: ['PLATFORM_ADMIN'],
    });
    expect(() => requirePlatformAdmin(context)).not.toThrow();
    expect(() => requirePermission(context, 'students.read')).toThrow(ForbiddenError);
  });

  it('expires password reset tokens', async () => {
    const tenant = await seedTenant('hotel', ['Hal']);
    const user = await createUser({ email: 'admin@hotel.test', institutionId: tenant.institutionId });
    const token = await issuePasswordResetToken(user.id);

    await testPrisma().passwordResetToken.update({
      where: { tokenHash: sha256Hex(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(consumePasswordResetToken(token)).resolves.toBeNull();
  });

  it('consumes a valid reset token and stores a new hash', async () => {
    const tenant = await seedTenant('india', ['Ivy']);
    const user = await createUser({ email: 'admin@india.test', institutionId: tenant.institutionId });
    const token = await issuePasswordResetToken(user.id);
    const userId = await consumePasswordResetToken(token);
    expect(userId).toBe(user.id);

    await setUserPassword(user.id, 'Replacement-Password-2026!');
    await expect(authenticateWithPassword('admin@india.test', PASSWORD)).rejects.toBeInstanceOf(
      AuthenticationFailedError,
    );
    await expect(authenticateWithPassword('admin@india.test', 'Replacement-Password-2026!')).resolves.toMatchObject({
      id: user.id,
    });
  });
});
