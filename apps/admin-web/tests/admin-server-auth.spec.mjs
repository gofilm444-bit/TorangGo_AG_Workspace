import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Admin Web Server-Side Auth Boundary & Storage Security Suite', () => {
  const layoutPath = path.resolve(__dirname, '../src/app/(admin)/layout.tsx');
  const serverAuthPath = path.resolve(__dirname, '../src/lib/server-auth.ts');
  const apiPath = path.resolve(__dirname, '../src/lib/api.ts');
  const authContextPath = path.resolve(__dirname, '../src/lib/auth-context.tsx');

  it('1. verifies (admin)/layout.tsx enforces server-side authentication boundary', () => {
    assert.ok(fs.existsSync(layoutPath), '(admin)/layout.tsx must exist');
    const content = fs.readFileSync(layoutPath, 'utf-8');

    // Must enforce server-side execution and dynamic rendering
    assert.ok(content.includes("export const dynamic = 'force-dynamic'"), 'Layout must be force-dynamic');
    assert.ok(content.includes('requireServerAdminSession'), 'Layout must invoke requireServerAdminSession()');
    assert.ok(!content.includes("'use client'"), 'Layout must remain a Server Component');
  });

  it('2. verifies server-auth helper reads HttpOnly toranggo_admin_access cookie', () => {
    assert.ok(fs.existsSync(serverAuthPath), 'server-auth.ts must exist');
    const content = fs.readFileSync(serverAuthPath, 'utf-8');

    assert.ok(content.includes("cookieStore.get('toranggo_admin_access')"), 'Must read toranggo_admin_access cookie');
    assert.ok(content.includes("redirect('/login')"), 'Must redirect unauthenticated callers to /login');
  });

  it('3. verifies server-auth helper performs authoritative backend session validation', () => {
    const content = fs.readFileSync(serverAuthPath, 'utf-8');

    // Must call authoritative backend endpoint
    assert.ok(content.includes('/api/v1/auth/me'), 'Must call /api/v1/auth/me for authoritative session validation');
    assert.ok(content.includes("cache: 'no-store'"), 'Backend validation request must be un-cached (no-store)');
    assert.ok(content.includes('data.status !== \'ACTIVE\''), 'Must verify admin status is ACTIVE');
  });

  it('4. verifies mobile audience tokens (CUSTOMER/MERCHANT/DRIVER) are explicitly rejected by ADMIN_WEB boundary', () => {
    const content = fs.readFileSync(serverAuthPath, 'utf-8');

    // Enforces audience isolation: only ADMIN_WEB can unlock the shell
    assert.ok(content.includes("data.audience !== 'ADMIN_WEB'"), 'Must reject tokens that do not possess ADMIN_WEB audience');
    assert.ok(content.includes("data.principal_type !== 'ADMIN'"), 'Must reject principals that are not ADMIN');
  });

  it('5. proves authentication credentials (access/refresh tokens, passwords) are NEVER stored in localStorage or sessionStorage', () => {
    const srcDir = path.resolve(__dirname, '../src');

    function scanFiles(dir) {
      const files = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...scanFiles(full));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js')) {
          files.push(full);
        }
      }
      return files;
    }

    const allFiles = scanFiles(srcDir);
    assert.ok(allFiles.length > 0, 'Must have source files in admin-web/src');

    for (const file of allFiles) {
      const text = fs.readFileSync(file, 'utf-8');

      // Check localStorage: must NEVER be used for auth credentials
      if (text.includes('localStorage')) {
        assert.ok(!text.includes("localStorage.setItem('access_token'"), `${file} must not store access_token in localStorage`);
        assert.ok(!text.includes("localStorage.setItem('refresh_token'"), `${file} must not store refresh_token in localStorage`);
        assert.ok(!text.includes("localStorage.setItem('jwt'"), `${file} must not store jwt in localStorage`);
        assert.ok(!text.includes("localStorage.setItem('password'"), `${file} must not store password in localStorage`);
      }

      // Check sessionStorage: only allowed for admin_csrf_token
      if (text.includes('sessionStorage.setItem')) {
        const matches = text.match(/sessionStorage\.setItem\s*\(\s*['"`]([^'"`]+)['"`]/g) || [];
        for (const m of matches) {
          const keyMatch = m.match(/['"`]([^'"`]+)['"`]/);
          const key = keyMatch ? keyMatch[1] : '';
          assert.equal(key, 'admin_csrf_token', `sessionStorage key must only be admin_csrf_token, found: ${key} in ${file}`);
        }
      }
    }
  });

  it('6. verifies existing 6 Phase 1F navigation destinations are preserved', () => {
    const navPath = path.resolve(__dirname, '../src/components/shell/navigation.ts');
    const navContent = fs.readFileSync(navPath, 'utf-8');

    const expectedDestinations = [
      '/dashboard',
      '/verifikasi',
      '/operasional',
      '/keuangan',
      '/dukungan',
      '/pengaturan',
    ];

    for (const dest of expectedDestinations) {
      assert.ok(navContent.includes(`'${dest}'`) || navContent.includes(`"${dest}"`), `Navigation must preserve destination: ${dest}`);
    }
  });
});
