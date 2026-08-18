import { describe, expect, it } from 'vitest';

import {
  assertTenantAccess,
  hasPermission,
  hasRole,
  requireInstitutionId,
  requirePermission,
  requirePlatformAdmin,
  requireRole,
  tenantWhere,
} from '@/lib/auth/authorization';
import { ForbiddenError, TenantAccessError, UnauthenticatedError } from '@/lib/auth/errors';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLE_KEYS } from '@/lib/auth/permissions';
import { authContext } from '../helpers/db';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

describe('permission catalogue', () => {
  it('grants no platform permissions to institution roles', () => {
    for (const role of ROLE_KEYS.filter((key) => key !== 'PLATFORM_ADMIN')) {
      const platformGrants = DEFAULT_ROLE_PERMISSIONS[role].filter((permission) =>
        permission.startsWith('platform.'),
      );
      expect(platformGrants, `${role} must not hold platform permissions`).toEqual([]);
    }
  });

  it('grants no institution permissions to the platform administrator', () => {
    const tenantGrants = DEFAULT_ROLE_PERMISSIONS.PLATFORM_ADMIN.filter(
      (permission) => !permission.startsWith('platform.'),
    );
    expect(tenantGrants).toEqual([]);
  });

  it('only references permissions that exist in the catalogue', () => {
    for (const role of ROLE_KEYS) {
      for (const permission of DEFAULT_ROLE_PERMISSIONS[role]) {
        expect(ALL_PERMISSIONS).toContain(permission);
      }
    }
  });

  it('does not let a lecturer approve or publish results', () => {
    const lecturer = authContext({ institutionId: TENANT_A, roleKeys: ['LECTURER'] });
    expect(hasPermission(lecturer, 'marks.enter')).toBe(true);
    expect(hasPermission(lecturer, 'results.approve')).toBe(false);
    expect(hasPermission(lecturer, 'results.publish')).toBe(false);
    expect(hasPermission(lecturer, 'finance.payment')).toBe(false);
  });

  it('does not let a finance officer touch marks', () => {
    const finance = authContext({ institutionId: TENANT_A, roleKeys: ['FINANCE_OFFICER'] });
    expect(hasPermission(finance, 'finance.payment')).toBe(true);
    expect(hasPermission(finance, 'marks.enter')).toBe(false);
    expect(hasPermission(finance, 'students.delete')).toBe(false);
  });

  it('does not grant documents.read to the STUDENT role', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.STUDENT).not.toContain('documents.read');
    expect(DEFAULT_ROLE_PERMISSIONS.STUDENT).not.toContain('documents.manage');
    const student = authContext({ institutionId: TENANT_A, roleKeys: ['STUDENT'] });
    expect(hasPermission(student, 'documents.read')).toBe(false);
  });

  it('gives admissions officers offer and register, but not approve', () => {
    const officer = authContext({ institutionId: TENANT_A, roleKeys: ['ADMISSIONS_OFFICER'] });
    expect(hasPermission(officer, 'admissions.read')).toBe(true);
    expect(hasPermission(officer, 'admissions.review')).toBe(true);
    expect(hasPermission(officer, 'admissions.offer')).toBe(true);
    expect(hasPermission(officer, 'admissions.register')).toBe(true);
    expect(hasPermission(officer, 'admissions.approve')).toBe(false);
  });

  it('requires both documents.read and students.read for staff document access', () => {
    const documentsOnly = authContext({
      institutionId: TENANT_A,
      permissions: ['documents.read'],
    });
    const both = authContext({
      institutionId: TENANT_A,
      permissions: ['documents.read', 'students.read'],
    });
    expect(hasPermission(documentsOnly, 'documents.read')).toBe(true);
    expect(hasPermission(documentsOnly, 'students.read')).toBe(false);
    expect(hasPermission(both, 'documents.read')).toBe(true);
    expect(hasPermission(both, 'students.read')).toBe(true);
  });
});

describe('authorization guards', () => {
  it('rejects anonymous callers', () => {
    expect(() => requirePermission(null, 'students.read')).toThrow(UnauthenticatedError);
    expect(() => requireRole(null, 'REGISTRAR')).toThrow(UnauthenticatedError);
    expect(() => requirePlatformAdmin(null)).toThrow(UnauthenticatedError);
  });

  it('rejects callers without the permission', () => {
    const student = authContext({ institutionId: TENANT_A, roleKeys: ['STUDENT'] });
    expect(() => requirePermission(student, 'students.read')).toThrow(ForbiddenError);
  });

  it('accepts callers holding every requested permission', () => {
    const registrar = authContext({ institutionId: TENANT_A, roleKeys: ['REGISTRAR'] });
    expect(() => requirePermission(registrar, 'students.read', 'students.create')).not.toThrow();
    expect(hasRole(registrar, 'REGISTRAR')).toBe(true);
    expect(hasRole(registrar, 'FINANCE_OFFICER')).toBe(false);
  });

  it('keeps institution administrators out of platform administration', () => {
    const admin = authContext({ institutionId: TENANT_A, roleKeys: ['INSTITUTION_ADMIN'] });
    expect(() => requirePlatformAdmin(admin)).toThrow(ForbiddenError);
    expect(hasPermission(admin, 'platform.institutions.manage')).toBe(false);
  });
});

describe('tenant scoping', () => {
  it('derives the tenant filter from the session', () => {
    const context = authContext({ institutionId: TENANT_A, roleKeys: ['REGISTRAR'] });
    expect(tenantWhere(context)).toEqual({ institutionId: TENANT_A });
    expect(requireInstitutionId(context)).toBe(TENANT_A);
  });

  it('refuses tenant queries for a platform administrator with no tenant', () => {
    const platform = authContext({ institutionId: null, isPlatformAdmin: true, roleKeys: ['PLATFORM_ADMIN'] });
    expect(() => tenantWhere(platform)).toThrow(ForbiddenError);
  });

  it('blocks access to a record owned by another institution', () => {
    const context = authContext({ institutionId: TENANT_A, roleKeys: ['REGISTRAR'] });
    expect(() => assertTenantAccess(context, { institutionId: TENANT_B })).toThrow(TenantAccessError);
    expect(() => assertTenantAccess(context, null)).toThrow(TenantAccessError);
    expect(() => assertTenantAccess(context, { institutionId: TENANT_A })).not.toThrow();
  });

  it('does not let platform administrators read tenant records implicitly', () => {
    const platform = authContext({ institutionId: null, isPlatformAdmin: true, roleKeys: ['PLATFORM_ADMIN'] });
    expect(() => assertTenantAccess(platform, { institutionId: TENANT_A })).toThrow(ForbiddenError);
  });
});
