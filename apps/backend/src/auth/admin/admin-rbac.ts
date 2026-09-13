import type pg from 'pg';
import { generateUuidV7 } from '@platform/utils';
import { ALL_ADMIN_PERMISSIONS } from './admin-permissions.js';
import { AppError } from '../../common/errors/app-error.js';

export const SUPER_ADMIN_ROLE_NAME = 'SUPER_ADMIN';

export interface RbacBootstrapResult {
  superAdminRoleId: string;
  permissionCodes: string[];
}

/**
 * Idempotently bootstraps the SUPER_ADMIN role, all canonical Phase-2A1
 * admin permissions, and their role-permission bindings.
 *
 * Safe for repeated execution; executes ON CONFLICT DO NOTHING for all rows.
 */
export async function bootstrapAdminRbac(
  client: pg.Pool | pg.PoolClient | pg.Client,
): Promise<RbacBootstrapResult> {
  const superAdminRoleId = generateUuidV7();

  // 1. Ensure SUPER_ADMIN role exists
  await client.query(
    `INSERT INTO admin_roles (id, name, description, created_at)
     VALUES ($1, $2, 'Platform Super Administrator with full privileges', NOW())
     ON CONFLICT (name) DO NOTHING;`,
    [superAdminRoleId, SUPER_ADMIN_ROLE_NAME],
  );

  const roleRes = await client.query(
    `SELECT id FROM admin_roles WHERE name = $1 LIMIT 1;`,
    [SUPER_ADMIN_ROLE_NAME],
  );
  const activeRoleId: string = roleRes.rows[0].id;

  // 2. Ensure each canonical permission exists and is linked to SUPER_ADMIN
  const seededPermissions: string[] = [];
  for (const code of ALL_ADMIN_PERMISSIONS) {
    const permId = generateUuidV7();
    await client.query(
      `INSERT INTO admin_permissions (id, code, description, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (code) DO NOTHING;`,
      [permId, code, `Permission for ${code}`],
    );

    const permRes = await client.query(
      `SELECT id FROM admin_permissions WHERE code = $1 LIMIT 1;`,
      [code],
    );
    const activePermId: string = permRes.rows[0].id;

    await client.query(
      `INSERT INTO admin_role_permissions (role_id, permission_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING;`,
      [activeRoleId, activePermId],
    );

    seededPermissions.push(code);
  }

  return {
    superAdminRoleId: activeRoleId,
    permissionCodes: seededPermissions,
  };
}

/**
 * Assigns a role to an admin account idempotently.
 */
export async function assignAdminRole(
  client: pg.Pool | pg.PoolClient | pg.Client,
  adminId: string,
  roleName: string,
): Promise<void> {
  const roleRes = await client.query(
    `SELECT id FROM admin_roles WHERE name = $1 LIMIT 1;`,
    [roleName],
  );

  if (roleRes.rows.length === 0) {
    throw new AppError(404, 'NOT_FOUND', `Role "${roleName}" not found`);
  }

  const roleId: string = roleRes.rows[0].id;

  await client.query(
    `INSERT INTO admin_account_roles (admin_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING;`,
    [adminId, roleId],
  );
}
