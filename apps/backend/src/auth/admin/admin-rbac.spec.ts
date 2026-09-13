import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_PERMISSIONS,
  ALL_ADMIN_PERMISSIONS,
} from './admin-permissions.js';
import {
  bootstrapAdminRbac,
  assignAdminRole,
  SUPER_ADMIN_ROLE_NAME,
} from './admin-rbac.js';

describe('Admin RBAC Catalog & Provisioning Suite', () => {
  it('1. verifies canonical permission catalog contains exactly the four Phase-2A1 codes', () => {
    const expected = ['admin:access', 'admin:read', 'admin:write', 'admin:ops'];
    assert.deepEqual(
      [...ALL_ADMIN_PERMISSIONS].sort(),
      [...expected].sort(),
      'Catalog must contain exactly admin:access, admin:read, admin:write, admin:ops',
    );
    assert.equal(ADMIN_PERMISSIONS.ACCESS, 'admin:access');
    assert.equal(ADMIN_PERMISSIONS.READ, 'admin:read');
    assert.equal(ADMIN_PERMISSIONS.WRITE, 'admin:write');
    assert.equal(ADMIN_PERMISSIONS.OPS, 'admin:ops');
  });

  it('2. guarantees no duplicate permission codes exist in catalog', () => {
    const uniqueCodes = new Set(ALL_ADMIN_PERMISSIONS);
    assert.equal(
      uniqueCodes.size,
      ALL_ADMIN_PERMISSIONS.length,
      'Permission catalog must not contain duplicate codes',
    );
  });

  it('3. verifies bootstrapAdminRbac executes idempotently without duplicate row errors', async () => {
    // In-memory mock database tracking table state
    const roles: { id: string; name: string }[] = [];
    const permissions: { id: string; code: string }[] = [];
    const rolePermissions: { role_id: string; permission_id: string }[] = [];

    const mockClient = {
      query: async (queryText: string, params?: any[]) => {
        const text = queryText.trim().toUpperCase();

        if (text.startsWith('INSERT INTO ADMIN_ROLES')) {
          const [id, name] = params!;
          if (!roles.some((r) => r.name === name)) {
            roles.push({ id, name });
          }
          return { rows: [] };
        }

        if (text.startsWith('SELECT ID FROM ADMIN_ROLES WHERE NAME = $1')) {
          const [name] = params!;
          const match = roles.find((r) => r.name === name);
          return { rows: match ? [{ id: match.id }] : [] };
        }

        if (text.startsWith('INSERT INTO ADMIN_PERMISSIONS')) {
          const [id, code] = params!;
          if (!permissions.some((p) => p.code === code)) {
            permissions.push({ id, code });
          }
          return { rows: [] };
        }

        if (text.startsWith('SELECT ID FROM ADMIN_PERMISSIONS WHERE CODE = $1')) {
          const [code] = params!;
          const match = permissions.find((p) => p.code === code);
          return { rows: match ? [{ id: match.id }] : [] };
        }

        if (text.startsWith('INSERT INTO ADMIN_ROLE_PERMISSIONS')) {
          const [roleId, permId] = params!;
          if (
            !rolePermissions.some(
              (rp) => rp.role_id === roleId && rp.permission_id === permId,
            )
          ) {
            rolePermissions.push({ role_id: roleId, permission_id: permId });
          }
          return { rows: [] };
        }

        throw new Error(`Unhandled mock query: ${queryText}`);
      },
    } as any;

    // Run 1: initial bootstrap
    const res1 = await bootstrapAdminRbac(mockClient);
    assert.equal(roles.length, 1);
    assert.equal(roles[0].name, SUPER_ADMIN_ROLE_NAME);
    assert.equal(permissions.length, 4);
    assert.equal(rolePermissions.length, 4);
    assert.equal(res1.permissionCodes.length, 4);

    // Run 2: repeated bootstrap (must be idempotent)
    const res2 = await bootstrapAdminRbac(mockClient);
    assert.equal(roles.length, 1, 'Roles must not be duplicated');
    assert.equal(permissions.length, 4, 'Permissions must not be duplicated');
    assert.equal(rolePermissions.length, 4, 'Role permissions must not be duplicated');
    assert.equal(res1.superAdminRoleId, res2.superAdminRoleId);
  });

  it('4. assigns role to admin idempotently', async () => {
    const accountRoles: { admin_id: string; role_id: string }[] = [];
    const mockClient = {
      query: async (queryText: string, params?: any[]) => {
        const text = queryText.trim().toUpperCase();
        if (text.startsWith('SELECT ID FROM ADMIN_ROLES WHERE NAME = $1')) {
          return { rows: [{ id: 'role-super-admin-uuid' }] };
        }
        if (text.startsWith('INSERT INTO ADMIN_ACCOUNT_ROLES')) {
          const [adminId, roleId] = params!;
          if (!accountRoles.some((ar) => ar.admin_id === adminId && ar.role_id === roleId)) {
            accountRoles.push({ admin_id: adminId, role_id: roleId });
          }
          return { rows: [] };
        }
        throw new Error(`Unhandled mock query: ${queryText}`);
      },
    } as any;

    await assignAdminRole(mockClient, 'admin-123', SUPER_ADMIN_ROLE_NAME);
    assert.equal(accountRoles.length, 1);
    assert.equal(accountRoles[0].admin_id, 'admin-123');

    // Repeat assignment - must not duplicate
    await assignAdminRole(mockClient, 'admin-123', SUPER_ADMIN_ROLE_NAME);
    assert.equal(accountRoles.length, 1);
  });
});
