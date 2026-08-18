import { describe, expect, it } from 'vitest';
import { toAuthContext, type UserWithRoles } from '@/lib/auth/session';

describe('toAuthContext unit tests', () => {
  it('converts an institution user into an AuthContext with correct permissions and tenant', () => {
    const mockUser = {
      id: '00000000-0000-4000-8000-000000000001',
      authUserId: null,
      email: 'admin@demo-college.example',
      passwordHash: '$argon2id$...',
      firstName: 'Ada',
      lastName: 'Admin',
      phone: null,
      avatarUrl: null,
      status: 'ACTIVE' as const,
      isPlatformAdmin: false,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      institutionId: '11111111-1111-4000-8000-000000000001',
      institution: {
        id: '11111111-1111-4000-8000-000000000001',
        slug: 'demo-college',
        name: 'CampusOS Demo College',
        shortName: 'Demo College',
        type: 'TVET' as const,
        status: 'ACTIVE' as const,
        registrationNumber: null,
        email: 'info@demo.example',
        phone: null,
        websiteUrl: null,
        logoUrl: null,
        addressLine1: null,
        addressLine2: null,
        city: 'Nairobi',
        county: 'Nairobi',
        country: 'KE',
        postalCode: null,
        timezone: 'Africa/Nairobi',
        currency: 'KES',
        locale: 'en-KE',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
      userRoles: [
        {
          id: '22222222-2222-4000-8000-000000000001',
          userId: '00000000-0000-4000-8000-000000000001',
          roleId: '33333333-3333-4000-8000-000000000001',
          institutionId: '11111111-1111-4000-8000-000000000001',
          grantedById: null,
          createdAt: new Date(),
          role: {
            id: '33333333-3333-4000-8000-000000000001',
            institutionId: '11111111-1111-4000-8000-000000000001',
            key: 'INSTITUTION_ADMIN',
            name: 'Institution administrator',
            description: null,
            scope: 'INSTITUTION' as const,
            isSystem: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            rolePermissions: [
              {
                id: '44444444-4444-4000-8000-000000000001',
                roleId: '33333333-3333-4000-8000-000000000001',
                permissionId: '55555555-5555-4000-8000-000000000001',
                createdAt: new Date(),
                permission: {
                  id: '55555555-5555-4000-8000-000000000001',
                  key: 'students.read',
                  module: 'students',
                  description: 'View students',
                  createdAt: new Date(),
                },
              },
            ],
          },
        },
      ],
    } as unknown as NonNullable<UserWithRoles>;

    const context = toAuthContext(mockUser);
    expect(context.userId).toBe('00000000-0000-4000-8000-000000000001');
    expect(context.email).toBe('admin@demo-college.example');
    expect(context.institutionId).toBe('11111111-1111-4000-8000-000000000001');
    expect(context.institution?.slug).toBe('demo-college');
    expect(context.roleKeys).toContain('INSTITUTION_ADMIN');
    expect(context.permissions.has('students.read')).toBe(true);
    expect(context.isPlatformAdmin).toBe(false);
  });

  it('filters out role assignments belonging to a different tenant', () => {
    const mockUser = {
      id: '00000000-0000-4000-8000-000000000001',
      authUserId: null,
      email: 'admin@demo-college.example',
      passwordHash: '$argon2id$...',
      firstName: 'Ada',
      lastName: 'Admin',
      phone: null,
      avatarUrl: null,
      status: 'ACTIVE' as const,
      isPlatformAdmin: false,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      institutionId: 'tenant-A',
      institution: null,
      userRoles: [
        {
          id: 'role-wrong-tenant',
          userId: '00000000-0000-4000-8000-000000000001',
          roleId: 'role-B',
          institutionId: 'tenant-B', // different tenant!
          grantedById: null,
          createdAt: new Date(),
          role: {
            id: 'role-B',
            institutionId: 'tenant-B',
            key: 'PRINCIPAL',
            name: 'Principal',
            description: null,
            scope: 'INSTITUTION' as const,
            isSystem: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            rolePermissions: [],
          },
        },
      ],
    } as unknown as NonNullable<UserWithRoles>;

    const context = toAuthContext(mockUser);
    expect(context.roleKeys).not.toContain('PRINCIPAL');
  });

  it('handles platform admin with null institutionId', () => {
    const mockPlatformAdmin = {
      id: 'platform-user-id',
      authUserId: null,
      email: 'platform-admin@campusos.example',
      passwordHash: '$argon2id$...',
      firstName: 'Pat',
      lastName: 'Platform',
      phone: null,
      avatarUrl: null,
      status: 'ACTIVE' as const,
      isPlatformAdmin: true,
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      institutionId: null,
      institution: null,
      userRoles: [
        {
          id: 'platform-role-assign',
          userId: 'platform-user-id',
          roleId: 'role-platform',
          institutionId: null,
          grantedById: null,
          createdAt: new Date(),
          role: {
            id: 'role-platform',
            institutionId: null,
            key: 'PLATFORM_ADMIN',
            name: 'Platform administrator',
            description: null,
            scope: 'PLATFORM' as const,
            isSystem: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            rolePermissions: [],
          },
        },
      ],
    } as unknown as NonNullable<UserWithRoles>;

    const context = toAuthContext(mockPlatformAdmin);
    expect(context.isPlatformAdmin).toBe(true);
    expect(context.institutionId).toBeNull();
    expect(context.institution).toBeNull();
    expect(context.roleKeys).toContain('PLATFORM_ADMIN');
  });
});
