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

  it('implements Phase 2C business setup and profile requirements', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const dirname = path.dirname(fileURLToPath(import.meta.url));

    const setupScreenPath = path.resolve(dirname, '../src/business-setup/business-setup-screen.tsx');
    const profileScreenPath = path.resolve(dirname, '../src/business-setup/business-profile-screen.tsx');
    const gatePath = path.resolve(dirname, '../src/onboarding/onboarding-gate.tsx');

    assert.ok(fs.existsSync(setupScreenPath), 'business-setup-screen.tsx must exist');
    assert.ok(fs.existsSync(profileScreenPath), 'business-profile-screen.tsx must exist');

    const setupContent = fs.readFileSync(setupScreenPath, 'utf-8');
    const profileContent = fs.readFileSync(profileScreenPath, 'utf-8');
    const gateContent = fs.readFileSync(gatePath, 'utf-8');

    // 1. Categories: uses canonical Phase 2B categories, no future parked placeholders
    assert.ok(setupContent.includes('MERCHANT_BUSINESS_CATEGORIES'), 'Uses canonical categories');
    assert.ok(!setupContent.includes("'PHARMACY'"), 'Does not include parked PHARMACY vertical');
    assert.ok(!setupContent.includes("'SERVICE'"), 'Does not include parked SERVICE vertical');

    // 2. Coordinate autosave: never converts empty to 0, preserves explicit 0
    assert.ok(
      setupContent.includes("const parsedLat = trimmedLat !== '' ? parseFloat(trimmedLat) : undefined"),
      'Preserves empty latitude as undefined',
    );
    assert.ok(
      setupContent.includes("const parsedLon = trimmedLon !== '' ? parseFloat(trimmedLon) : undefined"),
      'Preserves empty longitude as undefined',
    );
    assert.ok(!setupContent.includes('isNaN(latNum) ? 0 : latNum'), 'Does not coerce NaN/empty latitude to 0');
    assert.ok(!setupContent.includes('isNaN(lonNum) ? 0 : lonNum'), 'Does not coerce NaN/empty longitude to 0');

    // 3. COMPLETE flow: opens profile screen, does not initialize new setup draft
    assert.ok(gateContent.includes('BusinessProfileScreen'), 'Gate renders BusinessProfileScreen for COMPLETE');
    assert.ok(gateContent.includes('setViewingProfile(true)'), 'COMPLETE CTA triggers profile view');
    assert.ok(profileContent.includes('merchantApiClient.getBusiness'), 'Profile screen fetches business');
    assert.ok(profileContent.includes('merchantApiClient.getPrimaryOutlet'), 'Profile screen fetches primary outlet');
    assert.ok(
      !profileContent.includes('getOrCreateBusinessSetupDraft'),
      'Profile screen never initializes setup draft',
    );
    assert.ok(profileContent.includes('merchantApiClient.updateBusiness'), 'Profile screen supports business update');
    assert.ok(
      profileContent.includes('merchantApiClient.updatePrimaryOutlet'),
      'Profile screen supports outlet update',
    );

    // 4. Pre-Checkpoint Final Correction: Canonical categories and complete outlet editing
    const onboardingScreenContent = fs.readFileSync(
      path.resolve(dirname, '../src/onboarding/onboarding-screen.tsx'),
      'utf-8',
    );
    assert.ok(
      onboardingScreenContent.includes("from '@platform/shared-types'"),
      'Onboarding screen imports from @platform/shared-types',
    );
    assert.ok(
      onboardingScreenContent.includes('MERCHANT_BUSINESS_CATEGORIES'),
      'Onboarding screen uses canonical MERCHANT_BUSINESS_CATEGORIES',
    );
    assert.ok(
      !setupContent.includes("useState('FOOD_BEVERAGE')"),
      'BusinessSetupScreen does not initialize category to FOOD_BEVERAGE',
    );
    assert.ok(
      setupContent.includes("useState('')"),
      'BusinessSetupScreen initializes category to empty string',
    );

    // Complete Outlet Profile mutability in BusinessProfileScreen
    assert.ok(profileContent.includes('contactPhone'), 'Profile screen edits outlet contact phone');
    assert.ok(profileContent.includes('province'), 'Profile screen edits outlet province');
    assert.ok(profileContent.includes('regencyOrCity'), 'Profile screen edits outlet regency/city');
    assert.ok(profileContent.includes('district'), 'Profile screen edits outlet district');
    assert.ok(profileContent.includes('villageOrSubdistrict'), 'Profile screen edits outlet village');
    assert.ok(profileContent.includes('addressDetail'), 'Profile screen edits outlet address detail');
    assert.ok(profileContent.includes('postalCode'), 'Profile screen edits outlet postal code');
    assert.ok(profileContent.includes('latitude'), 'Profile screen edits outlet latitude');
    assert.ok(profileContent.includes('longitude'), 'Profile screen edits outlet longitude');
    assert.ok(profileContent.includes('timezone'), 'Profile screen edits outlet timezone');
    assert.ok(profileContent.includes('schedule'), 'Profile screen edits 7-day schedule');
  });
});
