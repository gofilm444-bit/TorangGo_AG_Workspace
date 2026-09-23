import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientConfig } from '@platform/config';
import { createApiClient, ApiClient } from '@platform/api-client';

describe('TorangGo Mitra / Merchant Mobile Shell Foundation Suite', () => {
  it('resolves partner client configuration with canonical PARTNER_APP audience', () => {
    const config = resolveClientConfig({ audience: 'PARTNER_APP' });
    assert.equal(config.audience, 'PARTNER_APP');
    assert.ok(config.apiBaseUrl, 'API base URL must be resolved');
    assert.ok(!config.apiBaseUrl.endsWith('/'), 'Base URL must not have trailing slash');
  });

  it('supports legacy MERCHANT_APP audience for migration compatibility', () => {
    const config = resolveClientConfig({ audience: 'MERCHANT_APP' });
    assert.equal(config.audience, 'MERCHANT_APP');
  });

  it('initializes partner ApiClient with non-hardcoded configuration and PARTNER_APP', () => {
    const config = resolveClientConfig({
      apiBaseUrl: 'http://localhost:3000',
      audience: 'PARTNER_APP',
    });
    const client = createApiClient({ baseUrl: config.apiBaseUrl });
    assert.ok(client instanceof ApiClient);
  });

  it('implements Phase 2B onboarding module files and components', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dirname = path.dirname(fileURLToPath(import.meta.url));

    const contextPath = path.resolve(dirname, '../src/onboarding/onboarding-context.tsx');
    const screenPath = path.resolve(dirname, '../src/onboarding/onboarding-screen.tsx');
    const gatePath = path.resolve(dirname, '../src/onboarding/onboarding-gate.tsx');
    const layoutPath = path.resolve(dirname, '../app/(app)/_layout.tsx');

    assert.ok(fs.existsSync(contextPath), 'onboarding-context.tsx must exist');
    assert.ok(fs.existsSync(screenPath), 'onboarding-screen.tsx must exist');
    assert.ok(fs.existsSync(gatePath), 'onboarding-gate.tsx must exist');

    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
    assert.ok(layoutContent.includes('OnboardingGate'), 'App layout must be gated by OnboardingGate');
    assert.ok(layoutContent.includes('OnboardingProvider'), 'App layout must provide OnboardingProvider');
  });

  it('enforces 6 onboarding gate states and 5-step form requirements', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dirname = path.dirname(fileURLToPath(import.meta.url));

    const gateContent = fs.readFileSync(
      path.resolve(dirname, '../src/onboarding/onboarding-gate.tsx'),
      'utf-8',
    );
    const screenContent = fs.readFileSync(
      path.resolve(dirname, '../src/onboarding/onboarding-screen.tsx'),
      'utf-8',
    );

    // Gate state handling
    assert.ok(gateContent.includes('NOT_STARTED'), 'Handles NOT_STARTED state');
    assert.ok(gateContent.includes('DRAFT'), 'Handles DRAFT state');
    assert.ok(gateContent.includes('PENDING'), 'Handles PENDING state');
    assert.ok(gateContent.includes('REJECTED'), 'Handles REJECTED state');
    assert.ok(gateContent.includes('APPROVED'), 'Handles APPROVED state');
    assert.ok(gateContent.includes('SUSPENDED'), 'Handles SUSPENDED state');

    // 5-step form
    assert.ok(screenContent.includes('Data Diri Pemilik Usaha'), 'Step 1: Data Pemilik');
    assert.ok(screenContent.includes('Informasi Calon Usaha'), 'Step 2: Calon Usaha');
    assert.ok(screenContent.includes('Alamat Korespondensi Usaha'), 'Step 3: Alamat');
    assert.ok(screenContent.includes('Dokumen Identitas Pemilik'), 'Step 4: KTP');
    assert.ok(screenContent.includes('Tinjau & Kirim Pendaftaran'), 'Step 5: Review & Persetujuan');

    // Consents
    assert.ok(screenContent.includes('dataAccuracyAccepted'), 'Requires data accuracy consent');
    assert.ok(screenContent.includes('merchantTermsAccepted'), 'Requires merchant terms consent');
    assert.ok(screenContent.includes('privacyConsentAccepted'), 'Requires privacy consent');

    // Autosave
    assert.ok(screenContent.includes('autosaveStatus'), 'Displays autosave status');
    assert.ok(screenContent.includes('autosaveStatus'), 'Displays autosaveStatus');
    assert.ok(screenContent.includes('Menyimpan...'), 'Shows saving indicator');
    assert.ok(screenContent.includes('Tersimpan'), 'Shows saved indicator');
  });

  it('implements Phase 2B correction pass mobile requirements', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dirname = path.dirname(fileURLToPath(import.meta.url));

    const gateContent = fs.readFileSync(
      path.resolve(dirname, '../src/onboarding/onboarding-gate.tsx'),
      'utf-8',
    );
    const screenContent = fs.readFileSync(
      path.resolve(dirname, '../src/onboarding/onboarding-screen.tsx'),
      'utf-8',
    );
    const contextContent = fs.readFileSync(
      path.resolve(dirname, '../src/onboarding/onboarding-context.tsx'),
      'utf-8',
    );

    // 1. Real Image Picker for KTP
    assert.ok(screenContent.includes('expo-image-picker'), 'Uses expo-image-picker for KTP');
    assert.ok(screenContent.includes('launchImageLibraryAsync'), 'Launches image library');
    assert.ok(screenContent.includes('localKtpUri'), 'Maintains local preview URI');

    // 2. Step 5 section Ubah buttons
    assert.ok(screenContent.includes('setCurrentStep(1)'), 'Edit button for Step 1');
    assert.ok(screenContent.includes('setCurrentStep(2)'), 'Edit button for Step 2');
    assert.ok(screenContent.includes('setCurrentStep(3)'), 'Edit button for Step 3');
    assert.ok(screenContent.includes('setCurrentStep(4)'), 'Edit button for Step 4');
    assert.ok(screenContent.includes('Ubah'), 'Contains Ubah labels');

    // 3. Submit confirmation dialog
    assert.ok(screenContent.includes('Konfirmasi Pengiriman'), 'Presents confirmation dialog title');
    assert.ok(
      screenContent.includes('Setelah dikirim, data pengajuan tidak dapat diubah'),
      'Presents confirmation dialog warning',
    );

    // 4. Approved View & Setup Usaha CTA
    assert.ok(gateContent.includes('Pendaftaran Merchant Disetujui'), 'Explicit Phase 2B APPROVED title');
    assert.ok(gateContent.includes('Identitas Merchant Anda telah diverifikasi.'), 'Explicit Phase 2B APPROVED message');
    assert.ok(gateContent.includes('Lanjutkan Setup Usaha'), 'CTA for Phase 2C Setup Usaha');

    // 5. REJECTED / SUSPENDED audit metadata
    assert.ok(gateContent.includes('rejectionDate'), 'Displays rejection date');
    assert.ok(gateContent.includes('suspensionReason'), 'Displays suspension reason');
    assert.ok(gateContent.includes('suspensionDate'), 'Displays suspension date');

    // 6. Context step resume calculation and sequence guard
    assert.ok(contextContent.includes('computeFirstIncompleteStep'), 'Computes first incomplete step on resume');
    assert.ok(contextContent.includes('saveSequenceRef'), 'Uses sequence guard against stale autosaves');
  });
});
