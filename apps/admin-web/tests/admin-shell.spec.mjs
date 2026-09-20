import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveClientConfig } from '@platform/config';
import { createApiClient, ApiClient } from '@platform/api-client';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Admin Web Shell Foundation Suite', () => {
  it('resolves admin client configuration with ADMIN_WEB audience', () => {
    const config = resolveClientConfig({ audience: 'ADMIN_WEB' });
    assert.equal(config.audience, 'ADMIN_WEB');
    assert.ok(config.apiBaseUrl, 'API base URL must be resolved');
    assert.ok(!config.apiBaseUrl.endsWith('/'), 'Base URL must not have trailing slash');
  });

  it('guarantees configuration is client-safe and does not expose secrets', () => {
    const config = resolveClientConfig({ audience: 'ADMIN_WEB' });
    const keys = Object.keys(config);

    // Allowed client-safe keys only
    const allowedKeys = new Set(['apiBaseUrl', 'appEnv', 'audience']);
    for (const key of keys) {
      assert.ok(allowedKeys.has(key), `Unexpected potentially unsafe key in client config: ${key}`);
    }

    // Explicitly verify sensitive keywords are absent
    const configString = JSON.stringify(config).toLowerCase();
    assert.ok(!configString.includes('password'), 'Client config must not leak passwords');
    assert.ok(!configString.includes('secret'), 'Client config must not leak secrets');
    assert.ok(!configString.includes('postgres'), 'Client config must not leak database credentials');
    assert.ok(!configString.includes('redis'), 'Client config must not leak redis credentials');
  });

  it('initializes admin ApiClient with non-hardcoded configuration', () => {
    const config = resolveClientConfig({
      apiBaseUrl: 'http://localhost:3000',
      audience: 'ADMIN_WEB',
    });
    const client = createApiClient({ baseUrl: config.apiBaseUrl });
    assert.ok(client instanceof ApiClient);
  });

  it('allows overriding API base URL dynamically without hardcoded URLs', () => {
    const customUrl = 'https://custom-admin-api.toranggo.com';
    const config = resolveClientConfig({
      apiBaseUrl: customUrl,
      audience: 'ADMIN_WEB',
    });
    assert.equal(config.apiBaseUrl, customUrl);
    const client = createApiClient({ baseUrl: config.apiBaseUrl });
    assert.ok(client instanceof ApiClient);
  });

  it('establishes canonical navigation foundation with all 6 required destinations', () => {
    const navFilePath = path.resolve(__dirname, '../src/components/shell/navigation.ts');
    assert.ok(fs.existsSync(navFilePath), 'navigation.ts file must exist');

    const navContent = fs.readFileSync(navFilePath, 'utf-8');

    const expectedDestinations = [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
      { id: 'verifikasi', label: 'Verifikasi', href: '/verifikasi' },
      { id: 'operasional', label: 'Operasional', href: '/operasional' },
      { id: 'keuangan', label: 'Keuangan', href: '/keuangan' },
      { id: 'dukungan', label: 'Dukungan', href: '/dukungan' },
      { id: 'pengaturan', label: 'Pengaturan', href: '/pengaturan' },
    ];

    for (const item of expectedDestinations) {
      assert.ok(
        navContent.includes(`'${item.id}'`) || navContent.includes(`"${item.id}"`),
        `Nav item id ${item.id} must be present in navigation.ts`
      );
      assert.ok(
        navContent.includes(`'${item.label}'`) || navContent.includes(`"${item.label}"`),
        `Nav item label ${item.label} must be present in navigation.ts`
      );
      assert.ok(
        navContent.includes(`'${item.href}'`) || navContent.includes(`"${item.href}"`),
        `Nav item href ${item.href} must be present in navigation.ts`
      );
    }
  });

  it('preserves auth readiness without introducing fake authenticated sessions', () => {
    const config = resolveClientConfig({ audience: 'ADMIN_WEB' });
    assert.equal((config).token, undefined, 'Must not include token');
    assert.equal((config).session, undefined, 'Must not include session');
    assert.equal((config).user, undefined, 'Must not include fake user');

    const libConfigPath = path.resolve(__dirname, '../src/lib/config.ts');
    const libConfigContent = fs.readFileSync(libConfigPath, 'utf-8');
    assert.ok(!libConfigContent.includes('fakeToken'), 'Must not include fake tokens');
    assert.ok(!libConfigContent.includes('mockSession'), 'Must not include mock sessions');
  });

  it('ensures shell foundation avoids fabricated business metrics', () => {
    const dashboardPagePath = path.resolve(__dirname, '../src/app/(admin)/dashboard/page.tsx');
    assert.ok(fs.existsSync(dashboardPagePath), 'Dashboard page must exist');
    const dashboardContent = fs.readFileSync(dashboardPagePath, 'utf-8');

    // Verify honest placeholder messaging is used instead of fake production metrics
    assert.ok(dashboardContent.includes('Data belum tersedia'), 'Dashboard must display honest empty/placeholder states');
    assert.ok(!dashboardContent.includes('Rp 1'), 'Dashboard must not fabricate revenue amounts');
    assert.ok(!dashboardContent.includes('Rp 2'), 'Dashboard must not fabricate revenue amounts');
    assert.ok(!dashboardContent.includes('Rp 5'), 'Dashboard must not fabricate revenue amounts');
    assert.ok(!dashboardContent.includes('Rp 9'), 'Dashboard must not fabricate revenue amounts');
  });

  it('verifies config statically exposes NEXT_PUBLIC_API_URL without hardcoding and targets backend auth login hermetically', async () => {
    // 1. Static inspection of apps/admin-web/src/lib/config.ts
    const libConfigPath = path.resolve(__dirname, '../src/lib/config.ts');
    assert.ok(fs.existsSync(libConfigPath), 'config.ts must exist');
    const libConfigContent = fs.readFileSync(libConfigPath, 'utf-8');

    assert.ok(
      libConfigContent.includes('process.env.NEXT_PUBLIC_API_URL'),
      'config.ts must statically access process.env.NEXT_PUBLIC_API_URL for compiler inlining',
    );
    assert.ok(
      !libConfigContent.includes('4000'),
      'config.ts must not hardcode port 4000 or specific host/port',
    );

    // Explicit hermetic environment isolation harness
    const ISOLATED_VARS = [
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_APP_ENV',
      'NEXT_PUBLIC_APP_AUDIENCE',
      'EXPO_PUBLIC_API_URL',
      'EXPO_PUBLIC_APP_ENV',
      'EXPO_PUBLIC_APP_AUDIENCE',
      'API_BASE_URL',
      'NODE_ENV',
    ];

    const runHermetic = async (scenarioEnv, fn) => {
      const savedEnv = new Map();

      // Collect and remove all keys matching ISOLATED_VARS case-insensitively
      for (const key of Object.keys(process.env)) {
        for (const target of ISOLATED_VARS) {
          if (key.toUpperCase() === target.toUpperCase()) {
            savedEnv.set(key, process.env[key]);
            delete process.env[key];
          }
        }
      }

      // Ensure exact named targets are recorded and removed
      for (const target of ISOLATED_VARS) {
        if (!savedEnv.has(target)) {
          savedEnv.set(target, process.env[target]);
        }
        delete process.env[target];
      }

      // Apply scenario-specific overrides
      for (const [k, v] of Object.entries(scenarioEnv)) {
        if (v !== undefined) {
          process.env[k] = v;
        }
      }

      try {
        await fn();
      } finally {
        // Clear all scenario overrides
        for (const target of ISOLATED_VARS) {
          delete process.env[target];
        }
        for (const key of Object.keys(process.env)) {
          for (const target of ISOLATED_VARS) {
            if (key.toUpperCase() === target.toUpperCase()) {
              delete process.env[key];
            }
          }
        }
        // Restore original ambient environment
        for (const [key, val] of savedEnv.entries()) {
          if (val !== undefined) {
            process.env[key] = val;
          } else {
            delete process.env[key];
          }
        }
      }
    };

    // CASE A — Explicit API URL
    await runHermetic(
      {
        NEXT_PUBLIC_API_URL: 'http://localhost:4000',
        NEXT_PUBLIC_APP_ENV: 'development',
      },
      async () => {
        const config = resolveClientConfig({
          apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || undefined,
          appEnv: process.env.NEXT_PUBLIC_APP_ENV,
          audience: 'ADMIN_WEB',
        });
        assert.equal(config.apiBaseUrl, 'http://localhost:4000');
        assert.notEqual(config.apiBaseUrl, 'http://localhost:3000');
      },
    );

    // CASE B — Trailing slash normalization
    await runHermetic(
      {
        NEXT_PUBLIC_API_URL: 'http://localhost:4000/',
        NEXT_PUBLIC_APP_ENV: 'development',
      },
      async () => {
        const configWithSlash = resolveClientConfig({
          apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || undefined,
          appEnv: process.env.NEXT_PUBLIC_APP_ENV,
          audience: 'ADMIN_WEB',
        });
        assert.equal(configWithSlash.apiBaseUrl, 'http://localhost:4000');
      },
    );

    // CASE C — Explicitly absent API URL (development fallback)
    await runHermetic(
      {
        NEXT_PUBLIC_APP_ENV: 'development',
      },
      async () => {
        // Confirm all candidate base URL variables are genuinely absent
        assert.equal(process.env.NEXT_PUBLIC_API_URL, undefined);
        assert.equal(process.env.EXPO_PUBLIC_API_URL, undefined);
        assert.equal(process.env.API_BASE_URL, undefined);

        const fallbackConfig = resolveClientConfig({
          apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || undefined,
          appEnv: process.env.NEXT_PUBLIC_APP_ENV,
          audience: 'ADMIN_WEB',
        });
        assert.equal(fallbackConfig.apiBaseUrl, 'http://localhost:3000');
      },
    );

    // CASE D — Admin login URL target
    await runHermetic(
      {
        NEXT_PUBLIC_API_URL: 'http://localhost:4000',
        NEXT_PUBLIC_APP_ENV: 'development',
      },
      async () => {
        let interceptedUrl = null;
        let interceptedMethod = null;
        let interceptedBody = null;

        const mockFetch = async (url, init) => {
          interceptedUrl = typeof url === 'string' ? url : url.toString();
          interceptedMethod = init?.method;
          interceptedBody = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;

          return new Response(
            JSON.stringify({
              mfa_required: true,
              mfa_challenge_token: 'mock-challenge-token',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        };

        const configuredClient = createApiClient({
          baseUrl: 'http://localhost:4000',
          fetchFn: mockFetch,
        });

        const loginResult = await configuredClient.adminLogin({
          identifier: 'testadmin',
          password: 'testpassword',
        });

        assert.equal(
          interceptedUrl,
          'http://localhost:4000/api/v1/auth/admin/login',
          'adminLogin must target backend login URL http://localhost:4000/api/v1/auth/admin/login',
        );
        assert.equal(interceptedMethod, 'POST');
        assert.deepEqual(interceptedBody, {
          identifier: 'testadmin',
          password: 'testpassword',
        });
        assert.equal(loginResult.mfaRequired, true);
        assert.equal(loginResult.mfaChallengeToken, 'mock-challenge-token');
      },
    );
  });
});
