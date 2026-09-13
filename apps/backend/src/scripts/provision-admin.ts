import 'reflect-metadata';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { loadAppConfig } from '../config/app-config.js';
import { AdminCryptoService } from '../auth/admin/admin-crypto.service.js';
import {
  bootstrapAdminRbac,
  assignAdminRole,
  SUPER_ADMIN_ROLE_NAME,
} from '../auth/admin/admin-rbac.js';
import {
  adminAccounts,
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

    // 1. Ensure default super_admin role and canonical permissions are bootstrapped
    await bootstrapAdminRbac(pool);

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

    // 3. Assign SUPER_ADMIN role to newly provisioned admin
    await assignAdminRole(pool, adminId, SUPER_ADMIN_ROLE_NAME);

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
