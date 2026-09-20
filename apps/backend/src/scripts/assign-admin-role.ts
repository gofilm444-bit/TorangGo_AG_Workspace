import 'reflect-metadata';
import pg from 'pg';
import { loadAppConfig } from '../config/app-config.js';
import {
  bootstrapAdminRbac,
  assignAdminRole,
  SUPER_ADMIN_ROLE_NAME,
} from '../auth/admin/admin-rbac.js';

/**
 * Safe, idempotent Development Script to assign an RBAC role to an existing admin.
 *
 * Does NOT touch passwords, TOTP secrets, recovery codes, or MFA state.
 * Does NOT print secrets.
 *
 * Usage:
 *   node dist/scripts/assign-admin-role.js --username <username> [--role <role>]
 */
async function run() {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };

  const username = getArg('--username');
  const roleName = getArg('--role') ?? SUPER_ADMIN_ROLE_NAME;

  if (!username) {
    console.error('Usage: node dist/scripts/assign-admin-role.js --username <username> [--role <role>]');
    process.exit(1);
  }

  const normalizedUsername = username.trim().toLowerCase();
  const config = loadAppConfig();
  const pool = new pg.Pool({ connectionString: config.databaseUrl });

  try {
    // 1. Ensure RBAC roles and permissions are bootstrapped
    await bootstrapAdminRbac(pool);

    // 2. Find admin by username
    const adminRes = await pool.query(
      `SELECT id, username, status FROM admin_accounts WHERE username = $1 LIMIT 1;`,
      [normalizedUsername],
    );

    if (adminRes.rows.length === 0) {
      console.error(`Admin account "${normalizedUsername}" not found.`);
      process.exit(1);
    }

    const adminId = adminRes.rows[0].id;

    // 3. Assign role idempotently
    await assignAdminRole(pool, adminId, roleName);

    console.log(`✔ Assigned role "${roleName}" to admin "${normalizedUsername}" (ID: ${adminId}).`);
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Failed to assign admin role:', err);
  process.exit(1);
});
