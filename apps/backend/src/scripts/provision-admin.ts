import 'reflect-metadata';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { loadAppConfig } from '../config/app-config.js';
import { AdminCryptoService } from '../auth/admin/admin-crypto.service.js';
import {
  adminAccounts,
  adminAccountRoles,
  adminRecoveryCodes,
} from '../database/schema/identity.js';
import { generateUuidV7 } from '@platform/utils';

/**
 * Secure Admin Account Provisioning CLI.
 * Usage: node dist/scripts/provision-admin.js --username <username> --email <email> --password <password>
 */
async function provisionAdmin() {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };

  const username = getArg('--username');
  const email = getArg('--email');
  const password = getArg('--password');

  if (!username || !email || !password) {
    console.error(
      'Usage: node dist/scripts/provision-admin.js --username <username> --email <email> --password <password>',
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('Password must be at least 12 characters long for admin security.');
    process.exit(1);
  }

  const config = loadAppConfig();
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const db = drizzle(pool);
  const cryptoService = new AdminCryptoService();

  try {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    // Check existing
    const existing = await db
      .select({ id: adminAccounts.id })
      .from(adminAccounts)
      .where(eq(adminAccounts.username, normalizedUsername))
      .limit(1);

    if (existing.length > 0) {
      console.error(`Admin with username "${normalizedUsername}" already exists.`);
      process.exit(1);
    }

    const passwordHash = await cryptoService.hashPassword(password);
    const totpSecret = cryptoService.generateTotpSecret();
    const totpSecretEncrypted = cryptoService.encryptSecret(totpSecret);
    const { rawCodes, hashedCodes } = cryptoService.generateRecoveryCodes(8);

    const adminId = generateUuidV7();

    // 1. Create or ensure default super_admin role and permissions
    const superAdminRoleId = generateUuidV7();

    await pool.query(
      `INSERT INTO admin_roles (id, name, description, created_at)
       VALUES ($1, 'SUPER_ADMIN', 'Platform Super Administrator with full privileges', NOW())
       ON CONFLICT (name) DO NOTHING;`,
      [superAdminRoleId],
    );

    const roleRow = await pool.query(`SELECT id FROM admin_roles WHERE name = 'SUPER_ADMIN';`);
    const activeRoleId = roleRow.rows[0].id;

    const basePermissions = ['admin:read', 'admin:write', 'admin:ops', 'admin:access'];
    for (const code of basePermissions) {
      const pId = generateUuidV7();
      await pool.query(
        `INSERT INTO admin_permissions (id, code, description, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (code) DO NOTHING;`,
        [pId, code, `Permission for ${code}`],
      );

      const pRow = await pool.query(`SELECT id FROM admin_permissions WHERE code = $1;`, [code]);
      const activePermId = pRow.rows[0].id;

      await pool.query(
        `INSERT INTO admin_role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING;`,
        [activeRoleId, activePermId],
      );
    }

    // 2. Insert admin account
    await db.insert(adminAccounts).values({
      id: adminId,
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      status: 'ACTIVE',
      mfaEnabled: true,
      totpSecretEncrypted,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Assign SUPER_ADMIN role
    await db.insert(adminAccountRoles).values({
      adminId,
      roleId: activeRoleId,
    });

    // 4. Insert recovery codes
    for (const codeHash of hashedCodes) {
      await db.insert(adminRecoveryCodes).values({
        id: generateUuidV7(),
        adminId,
        codeHash,
        isUsed: false,
        usedAt: null,
        createdAt: new Date(),
      });
    }

    console.log('✔ Admin account provisioned successfully.');
    console.log(`  Admin ID   : ${adminId}`);
    console.log(`  Username   : ${normalizedUsername}`);
    console.log(`  Email      : ${normalizedEmail}`);
    console.log(`  TOTP Secret: ${totpSecret}`);
    console.log('  Recovery Codes (one-time use, store securely):');
    rawCodes.forEach((code, idx) => {
      console.log(`    ${idx + 1}. ${code}`);
    });
  } finally {
    await pool.end();
  }
}

provisionAdmin().catch((err) => {
  console.error('Failed to provision admin:', err);
  process.exit(1);
});
