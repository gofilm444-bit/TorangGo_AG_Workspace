import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { generateUuidV7 } from '@platform/utils';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index.js';
import { TransactionService, type DrizzleDb } from '../../database/transaction/transaction.service.js';
import { LocalDocumentStorage } from '../../storage/local-document-storage.js';
import { MerchantOnboardingService } from '../../merchant-onboarding/merchant-onboarding.service.js';
import { AdminVerificationService } from '../../admin/admin-verification.service.js';
import { MerchantBusinessService } from '../merchant-business.service.js';
import {
  BadRequestError,
  ForbiddenError,
} from '../../common/errors/app-error.js';
import type { OperatingHourItemDto } from '../dto/merchant-business.dto.js';

const { Pool } = pg;

describe('Phase 2C: Merchant Business & Single Outlet Foundation Integration Suite', () => {
  let pool: pg.Pool;
  let db: DrizzleDb;
  let transactionService: TransactionService;
  let storage: LocalDocumentStorage;
  let onboardingService: MerchantOnboardingService;
  let adminService: AdminVerificationService;
  let businessService: MerchantBusinessService;
  let testAdminId: string;

  before(async () => {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL is required for Phase 2C tests');
    }
    pool = new Pool({ connectionString: connStr });
    db = drizzle(pool, { schema });
    transactionService = new TransactionService(db);
    storage = new LocalDocumentStorage();
    onboardingService = new MerchantOnboardingService(pool, transactionService, storage);
    adminService = new AdminVerificationService(pool, transactionService, storage);
    businessService = new MerchantBusinessService(pool, transactionService);

    // Create seed admin account for audit log foreign keys
    testAdminId = generateUuidV7();
    await pool.query(
      `INSERT INTO admin_accounts (id, username, email, password_hash, status, mfa_enabled, created_at, updated_at)
       VALUES ($1, 'business_admin', 'business_admin@toranggo.id', 'dummy_hash', 'ACTIVE', false, now(), now())
       ON CONFLICT (username) DO UPDATE SET updated_at = now()
       RETURNING id;`,
      [testAdminId],
    );
  });

  after(async () => {
    try {
      await pool.query(`DELETE FROM profile_verification_audit_logs WHERE actor_admin_id = $1;`, [testAdminId]);
      await pool.query(`DELETE FROM admin_accounts WHERE id = $1;`, [testAdminId]);
    } catch {
      // Ignore cleanup error
    }
    await pool.end();
  });

  // Helper to create synthetic test user
  async function createTestUser(phoneSuffix = '') {
    const userId = generateUuidV7();
    const phone = `+62813${Math.floor(10000000 + Math.random() * 90000000)}${phoneSuffix}`;
    await pool.query(
      `INSERT INTO users (id, phone, status, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', now(), now());`,
      [userId, phone],
    );
    return { userId, phone };
  }

  // Helper: Valid mock JPEG buffer
  function createValidJpegBuffer(): Buffer {
    const buf = Buffer.alloc(1024);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    buf[3] = 0xe0;
    buf.write('JFIF', 6, 'ascii');
    return buf;
  }

  // Helper: Create an APPROVED merchant profile via Phase 2B onboarding pipeline
  async function createApprovedMerchant(suffix = '') {
    const { userId, phone } = await createTestUser(suffix);
    await onboardingService.getOrCreateDraft(userId);
    await onboardingService.saveDraft(userId, {
      fullName: `Pemilik Usaha ${suffix || 'Utama'}`,
      nik: `71710123456789${String(Math.floor(10 + Math.random() * 89))}`,
      proposedBusinessName: `RM Manado Mantap ${suffix}`,
      businessCategory: 'KULINER',
      businessDescription: 'Masakan autentik Manado rica-rica dan woku',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Wenang',
      villageOrSubdistrict: 'Calaca',
      addressDetail: 'Jl. Sam Ratulangi No. 123 (Alamat Korespondensi)',
    });
    await onboardingService.uploadDraftKtp(userId, createValidJpegBuffer(), 'ktp.jpg');

    const sub = await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });

    const profileId = sub.merchantProfileId!;
    await adminService.approveMerchant(profileId, testAdminId, 'Verifikasi lengkap dan disetujui');

    return { userId, phone, profileId, submissionId: sub.currentSubmission!.id };
  }

  // Standard valid 7-day schedule
  function createValid7DaySchedule(): OperatingHourItemDto[] {
    return [
      { dayOfWeek: 1, isClosed: false, openTime: '08:00', closeTime: '21:00' },
      { dayOfWeek: 2, isClosed: false, openTime: '08:00', closeTime: '21:00' },
      { dayOfWeek: 3, isClosed: false, openTime: '08:00', closeTime: '21:00' },
      { dayOfWeek: 4, isClosed: false, openTime: '08:00', closeTime: '21:00' },
      { dayOfWeek: 5, isClosed: false, openTime: '08:00', closeTime: '22:00' },
      { dayOfWeek: 6, isClosed: false, openTime: '09:00', closeTime: '22:00' },
      { dayOfWeek: 7, isClosed: true, openTime: null, closeTime: null },
    ];
  }

  // =========================================================================
  // 1. Authorization & Role Isolation
  // =========================================================================

  it('1. rejects setup status and draft when user has no merchant profile', async () => {
    const { userId } = await createTestUser('no_p');
    await assert.rejects(
      async () => businessService.getSetupStatus(userId),
      (err: any) => err instanceof ForbiddenError && err.message.includes('Profil merchant tidak ditemukan'),
    );
    await assert.rejects(
      async () => businessService.getOrCreateDraft(userId),
      (err: any) => err instanceof ForbiddenError,
    );
  });

  it('2. rejects business setup endpoints when merchant profile is PENDING', async () => {
    const { userId } = await createTestUser('pnd');
    await onboardingService.getOrCreateDraft(userId);
    await onboardingService.saveDraft(userId, {
      fullName: 'Budi Pending',
      nik: '7171012345678901',
      proposedBusinessName: 'Warung Pending',
      businessCategory: 'KULINER',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Wenang',
      villageOrSubdistrict: 'Calaca',
      addressDetail: 'Jl. Roda No. 1',
    });
    await onboardingService.uploadDraftKtp(userId, createValidJpegBuffer(), 'ktp.jpg');
    await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });

    await assert.rejects(
      async () => businessService.getSetupStatus(userId),
      (err: any) => err instanceof ForbiddenError && err.message.includes('status APPROVED'),
    );
    await assert.rejects(
      async () => businessService.getOrCreateDraft(userId),
      (err: any) => err instanceof ForbiddenError,
    );
  });

  it('3. rejects business setup endpoints when merchant profile is REJECTED', async () => {
    const { userId } = await createTestUser('rej');
    await onboardingService.getOrCreateDraft(userId);
    await onboardingService.saveDraft(userId, {
      fullName: 'Budi Tolak',
      nik: '7171012345678902',
      proposedBusinessName: 'Warung Tolak',
      businessCategory: 'KULINER',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Wenang',
      villageOrSubdistrict: 'Calaca',
      addressDetail: 'Jl. Roda No. 2',
    });
    await onboardingService.uploadDraftKtp(userId, createValidJpegBuffer(), 'ktp.jpg');
    const sub = await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });
    await adminService.rejectMerchant(sub.merchantProfileId!, testAdminId, 'Foto KTP buram');

    await assert.rejects(
      async () => businessService.getSetupStatus(userId),
      (err: any) => err instanceof ForbiddenError && err.message.includes('status APPROVED'),
    );
  });

  it('4. isolates cross-merchant draft and entity access', async () => {
    const merchantA = await createApprovedMerchant('isoA');
    const merchantB = await createApprovedMerchant('isoB');

    const draftA = await businessService.getOrCreateDraft(merchantA.userId);
    const draftB = await businessService.getOrCreateDraft(merchantB.userId);

    assert.notEqual(draftA.id, draftB.id);
    assert.equal(draftA.merchantProfileId, merchantA.profileId);
    assert.equal(draftB.merchantProfileId, merchantB.profileId);
  });

  // =========================================================================
  // 2. Draft Lifecycle & Autosave
  // =========================================================================

  it('5. returns NOT_STARTED before draft initialization, then pre-populates draft from Phase 2B submission', async () => {
    const merchant = await createApprovedMerchant('prefill');

    // State is initially NOT_STARTED
    const initialStatus = await businessService.getSetupStatus(merchant.userId);
    assert.equal(initialStatus.state, 'NOT_STARTED');
    assert.equal(initialStatus.draft, null);
    assert.equal(initialStatus.business, null);

    // Initializing draft pre-populates business information from Phase 2B approved submission
    const draft = await businessService.getOrCreateDraft(merchant.userId);
    assert.equal(draft.currentStep, 1);
    assert.equal(draft.business.name, `RM Manado Mantap prefill`);
    assert.equal(draft.business.categoryCode, 'KULINER');
    assert.equal(draft.business.description, 'Masakan autentik Manado rica-rica dan woku');

    // Invariant: Physical address from Phase 2B onboarding correspondence MUST NOT be copied to outlet setup payload
    assert.equal(draft.outlet.addressDetail, undefined);
    assert.equal(draft.outlet.province, undefined);

    // Subsequent calls return the same active draft
    const draftAgain = await businessService.getOrCreateDraft(merchant.userId);
    assert.equal(draftAgain.id, draft.id);

    // Setup status is now DRAFT
    const draftStatus = await businessService.getSetupStatus(merchant.userId);
    assert.equal(draftStatus.state, 'DRAFT');
    assert.equal(draftStatus.draft?.id, draft.id);
  });

  it('6. verifies partial autosave and resume functionality', async () => {
    const merchant = await createApprovedMerchant('autosave');
    await businessService.getOrCreateDraft(merchant.userId);

    // Autosave Step 1 & 2 fields partially
    const saved = await businessService.saveDraft(merchant.userId, {
      currentStep: 2,
      business: {
        name: 'RM Manado Mantap Updated',
      },
      outlet: {
        name: 'Outlet Pusat Sam Ratulangi',
        contactPhone: '081234567890',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Sam Ratulangi No. 88',
      },
    });

    assert.equal(saved.currentStep, 2);
    assert.equal(saved.business.name, 'RM Manado Mantap Updated');
    // Pre-filled category preserved
    assert.equal(saved.business.categoryCode, 'KULINER');
    assert.equal(saved.outlet.name, 'Outlet Pusat Sam Ratulangi');
    assert.equal(saved.outlet.addressDetail, 'Jl. Sam Ratulangi No. 88');

    // Resume: Fetching setup status returns the exact updated draft
    const status = await businessService.getSetupStatus(merchant.userId);
    assert.equal(status.draft?.business.name, 'RM Manado Mantap Updated');
    assert.equal(status.draft?.outlet.addressDetail, 'Jl. Sam Ratulangi No. 88');

    // Empty coordinates in partial autosave are NOT converted to 0
    const draftWithoutCoords = await businessService.saveDraft(merchant.userId, {
      outlet: {
        name: 'Outlet Belum Set Lokasi',
      },
    });
    assert.strictEqual(draftWithoutCoords.outlet.latitude, undefined, 'Omitted latitude must remain undefined');
    assert.strictEqual(draftWithoutCoords.outlet.longitude, undefined, 'Omitted longitude must remain undefined');

    // Explicit 0 coordinate input is preserved as numeric 0
    const draftWithZeroCoords = await businessService.saveDraft(merchant.userId, {
      outlet: {
        latitude: 0,
        longitude: 0,
      },
    });
    assert.strictEqual(draftWithZeroCoords.outlet.latitude, 0, 'Explicit numeric 0 latitude must be preserved');
    assert.strictEqual(draftWithZeroCoords.outlet.longitude, 0, 'Explicit numeric 0 longitude must be preserved');
  });

  // =========================================================================
  // 3. Coordinate & Timezone Validation
  // =========================================================================

  it('7. validates WGS84 coordinate boundaries and IANA timezones without universal fallback', async () => {
    const merchant = await createApprovedMerchant('coord');
    await businessService.getOrCreateDraft(merchant.userId);

    const validSchedule = createValid7DaySchedule();

    // 1. Missing timezone => FAIL
    await assert.rejects(
      async () =>
        businessService.completeSetup(merchant.userId, {
          business: { name: 'Warung Mantap', categoryCode: 'KULINER' },
          outlet: {
            name: 'Outlet 1',
            contactPhone: '081234567890',
            province: 'Sulut',
            regencyOrCity: 'Manado',
            district: 'Wenang',
            villageOrSubdistrict: 'Calaca',
            addressDetail: 'Jl. Samrat',
            latitude: 1.47,
            longitude: 124.84,
            timezone: '' as any, // Missing
          },
          operatingHours: validSchedule,
        }),
      (err: any) => err instanceof BadRequestError && err.message.includes('Zona waktu outlet wajib diisi'),
    );

    // 2. Invalid IANA timezone => FAIL
    await assert.rejects(
      async () =>
        businessService.completeSetup(merchant.userId, {
          business: { name: 'Warung Mantap', categoryCode: 'KULINER' },
          outlet: {
            name: 'Outlet 1',
            contactPhone: '081234567890',
            province: 'Sulut',
            regencyOrCity: 'Manado',
            district: 'Wenang',
            villageOrSubdistrict: 'Calaca',
            addressDetail: 'Jl. Samrat',
            latitude: 1.47,
            longitude: 124.84,
            timezone: 'Invalid/NonExistent_Zone', // Invalid
          },
          operatingHours: validSchedule,
        }),
      (err: any) => err instanceof BadRequestError && err.message.includes('Zona waktu outlet wajib valid'),
    );

    // 3. Invalid latitude (> 90) => FAIL
    await assert.rejects(
      async () =>
        businessService.completeSetup(merchant.userId, {
          business: { name: 'Warung Mantap', categoryCode: 'KULINER' },
          outlet: {
            name: 'Outlet 1',
            contactPhone: '081234567890',
            province: 'Sulut',
            regencyOrCity: 'Manado',
            district: 'Wenang',
            villageOrSubdistrict: 'Calaca',
            addressDetail: 'Jl. Samrat',
            latitude: 95.0, // Invalid
            longitude: 124.84,
            timezone: 'Asia/Makassar',
          },
          operatingHours: validSchedule,
        }),
      (err: any) => err instanceof BadRequestError && err.message.includes('Latitude'),
    );

    // 4. Invalid longitude (< -180) => FAIL
    await assert.rejects(
      async () =>
        businessService.completeSetup(merchant.userId, {
          business: { name: 'Warung Mantap', categoryCode: 'KULINER' },
          outlet: {
            name: 'Outlet 1',
            contactPhone: '081234567890',
            province: 'Sulut',
            regencyOrCity: 'Manado',
            district: 'Wenang',
            villageOrSubdistrict: 'Calaca',
            addressDetail: 'Jl. Samrat',
            latitude: 1.47,
            longitude: -190.0, // Invalid
            timezone: 'Asia/Makassar',
          },
          operatingHours: validSchedule,
        }),
      (err: any) => err instanceof BadRequestError && err.message.includes('Longitude'),
    );

    // 5. Jakarta + Asia/Jakarta = PASS
    const merchantJkt = await createApprovedMerchant('jkt');
    await businessService.getOrCreateDraft(merchantJkt.userId);
    const resJkt = await businessService.completeSetup(merchantJkt.userId, {
      business: { name: 'Soto Betawi Jakarta', categoryCode: 'KULINER' },
      outlet: {
        name: 'Gerai Menteng',
        contactPhone: '081211112222',
        province: 'DKI Jakarta',
        regencyOrCity: 'Kota Jakarta Pusat',
        district: 'Menteng',
        villageOrSubdistrict: 'Menteng',
        addressDetail: 'Jl. Teuku Umar No. 10',
        latitude: -6.1963,
        longitude: 106.8317,
        timezone: 'Asia/Jakarta',
      },
      operatingHours: validSchedule,
    });
    assert.equal(resJkt.primaryOutlet.timezone, 'Asia/Jakarta');

    // 6. Makassar + Asia/Makassar = PASS
    const merchantMks = await createApprovedMerchant('mks');
    await businessService.getOrCreateDraft(merchantMks.userId);
    const resMks = await businessService.completeSetup(merchantMks.userId, {
      business: { name: 'Coto Makassar Mantap', categoryCode: 'KULINER' },
      outlet: {
        name: 'Gerai Losari',
        contactPhone: '081233334444',
        province: 'Sulawesi Selatan',
        regencyOrCity: 'Kota Makassar',
        district: 'Ujung Pandang',
        villageOrSubdistrict: 'Maloku',
        addressDetail: 'Jl. Penghibur No. 5',
        latitude: -5.1476,
        longitude: 119.4327,
        timezone: 'Asia/Makassar',
      },
      operatingHours: validSchedule,
    });
    assert.equal(resMks.primaryOutlet.timezone, 'Asia/Makassar');

    // 7. Jayapura + Asia/Jayapura = PASS
    const merchantJyp = await createApprovedMerchant('jyp');
    await businessService.getOrCreateDraft(merchantJyp.userId);
    const resJyp = await businessService.completeSetup(merchantJyp.userId, {
      business: { name: 'Ikan Bakar Jayapura', categoryCode: 'KULINER' },
      outlet: {
        name: 'Gerai Pantai Hamadi',
        contactPhone: '081255556666',
        province: 'Papua',
        regencyOrCity: 'Kota Jayapura',
        district: 'Jayapura Selatan',
        villageOrSubdistrict: 'Hamadi',
        addressDetail: 'Jl. Pantai Hamadi No. 20',
        latitude: -2.5768,
        longitude: 140.7139,
        timezone: 'Asia/Jayapura',
      },
      operatingHours: validSchedule,
    });
    assert.equal(resJyp.primaryOutlet.timezone, 'Asia/Jayapura');
  });

  // =========================================================================
  // 4. Operating Hours Constraints
  // =========================================================================

  it('8. validates 7-day operating hours rules', async () => {
    const merchant = await createApprovedMerchant('hours');
    await businessService.getOrCreateDraft(merchant.userId);

    const basePayload = {
      business: { name: 'Warung Mantap', categoryCode: 'KULINER' },
      outlet: {
        name: 'Outlet 1',
        contactPhone: '081234567890',
        province: 'Sulut',
        regencyOrCity: 'Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Samrat',
        latitude: 1.47,
        longitude: 124.84,
        timezone: 'Asia/Makassar',
      },
    };

    // Case 1: Incomplete days (< 7)
    await assert.rejects(
      async () =>
        businessService.completeSetup(merchant.userId, {
          ...basePayload,
          operatingHours: [
            { dayOfWeek: 1, isClosed: false, openTime: '08:00', closeTime: '20:00' },
          ],
        }),
      (err: any) => err instanceof BadRequestError && err.message.includes('tepat 7 hari'),
    );

    // Case 2: Closed day with times provided
    await assert.rejects(
      async () =>
        businessService.completeSetup(merchant.userId, {
          ...basePayload,
          operatingHours: [
            { dayOfWeek: 1, isClosed: true, openTime: '08:00', closeTime: '20:00' }, // Invalid!
            { dayOfWeek: 2, isClosed: false, openTime: '08:00', closeTime: '20:00' },
            { dayOfWeek: 3, isClosed: false, openTime: '08:00', closeTime: '20:00' },
            { dayOfWeek: 4, isClosed: false, openTime: '08:00', closeTime: '20:00' },
            { dayOfWeek: 5, isClosed: false, openTime: '08:00', closeTime: '20:00' },
            { dayOfWeek: 6, isClosed: false, openTime: '08:00', closeTime: '20:00' },
            { dayOfWeek: 7, isClosed: false, openTime: '08:00', closeTime: '20:00' },
          ],
        }),
      (err: any) => err instanceof BadRequestError && err.message.includes('tidak boleh memiliki jam buka'),
    );

    // Case 3: Open day with open >= close
    await assert.rejects(
      async () =>
        businessService.completeSetup(merchant.userId, {
          ...basePayload,
          operatingHours: [
            { dayOfWeek: 1, isClosed: false, openTime: '21:00', closeTime: '08:00' }, // Invalid!
            { dayOfWeek: 2, isClosed: false, openTime: '08:00', closeTime: '20:00' },
            { dayOfWeek: 3, isClosed: false, openTime: '08:00', closeTime: '20:00' },
            { dayOfWeek: 4, isClosed: false, openTime: '08:00', closeTime: '20:00' },
            { dayOfWeek: 5, isClosed: false, openTime: '08:00', closeTime: '20:00' },
            { dayOfWeek: 6, isClosed: false, openTime: '08:00', closeTime: '20:00' },
            { dayOfWeek: 7, isClosed: true, openTime: null, closeTime: null },
          ],
        }),
      (err: any) => err instanceof BadRequestError && err.message.includes('harus lebih awal'),
    );
  });

  it('8B. proves database-level chk_operating_hours_validity CHECK constraint enforces schedule invariants', async () => {
    const merchant = await createApprovedMerchant('chk_db');
    await businessService.getOrCreateDraft(merchant.userId);

    const setup = await businessService.completeSetup(merchant.userId, {
      business: { name: 'Resto Check DB', categoryCode: 'KULINER' },
      outlet: {
        name: 'Gerai Check',
        contactPhone: '081299990000',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Roda No. 9',
        latitude: 1.4748,
        longitude: 124.8421,
        timezone: 'Asia/Makassar',
      },
      operatingHours: createValid7DaySchedule(),
    });

    const outletId = setup.primaryOutlet.id;

    // 1. Database rejects closed day with open_time IS NOT NULL (CHECK constraint violation 23514)
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO outlet_operating_hours
           (id, outlet_id, day_of_week, is_closed, open_time, close_time, created_at, updated_at)
           VALUES ($1, $2, 99, true, '08:00', NULL, NOW(), NOW());`,
          [generateUuidV7(), outletId],
        );
      },
      (err: any) => {
        assert.equal(err.code, '23514', 'Must reject closed day with open_time via chk_operating_hours_validity');
        return true;
      },
    );

    // 2. Database rejects open day with null open_time (CHECK constraint violation 23514)
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO outlet_operating_hours
           (id, outlet_id, day_of_week, is_closed, open_time, close_time, created_at, updated_at)
           VALUES ($1, $2, 99, false, NULL, '20:00', NOW(), NOW());`,
          [generateUuidV7(), outletId],
        );
      },
      (err: any) => {
        assert.equal(err.code, '23514', 'Must reject open day with null open_time via chk_operating_hours_validity');
        return true;
      },
    );

    // 3. Database rejects open day with open_time >= close_time (CHECK constraint violation 23514)
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO outlet_operating_hours
           (id, outlet_id, day_of_week, is_closed, open_time, close_time, created_at, updated_at)
           VALUES ($1, $2, 99, false, '21:00', '08:00', NOW(), NOW());`,
          [generateUuidV7(), outletId],
        );
      },
      (err: any) => {
        assert.equal(err.code, '23514', 'Must reject open_time >= close_time via chk_operating_hours_validity');
        return true;
      },
    );

    // 4. Database enforces UNIQUE(outlet_id, day_of_week) (23505 unique violation)
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO outlet_operating_hours
           (id, outlet_id, day_of_week, is_closed, open_time, close_time, created_at, updated_at)
           VALUES ($1, $2, 1, false, '09:00', '18:00', NOW(), NOW());`,
          [generateUuidV7(), outletId],
        );
      },
      (err: any) => {
        assert.equal(err.code, '23505', 'Must reject duplicate (outlet_id, day_of_week) with 23505 unique violation');
        return true;
      },
    );
  });

  // =========================================================================
  // 5. Atomic Completion & PostGIS Invariants
  // =========================================================================

  it('9. atomically completes business and primary outlet setup, verifies PostGIS coordinates and database invariants', async () => {
    const merchant = await createApprovedMerchant('atomic');
    await businessService.getOrCreateDraft(merchant.userId);

    const schedule = createValid7DaySchedule();

    const res = await businessService.completeSetup(merchant.userId, {
      business: {
        name: 'RM Manado Asli Mantap',
        categoryCode: 'KULINER',
        description: 'Restoran masakan Manado autentik',
      },
      outlet: {
        name: 'Outlet Pusat Sam Ratulangi',
        contactPhone: '+6281234567899',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Sam Ratulangi No. 100',
        postalCode: '95111',
        latitude: 1.474830,
        longitude: 124.842079,
        timezone: 'Asia/Makassar',
      },
      operatingHours: schedule,
    });

    assert.equal(res.state, 'COMPLETE');
    assert.equal(res.business.name, 'RM Manado Asli Mantap');
    assert.equal(res.business.categoryCode, 'KULINER');
    assert.equal(res.business.sourceOnboardingSubmissionId, merchant.submissionId);

    assert.equal(res.primaryOutlet.name, 'Outlet Pusat Sam Ratulangi');
    assert.equal(res.primaryOutlet.isPrimary, true);
    assert.equal(res.primaryOutlet.postalCode, '95111');
    assert.equal(res.primaryOutlet.timezone, 'Asia/Makassar');

    // Verify ST_MakePoint(longitude, latitude) orientation
    assert.equal(Number(res.primaryOutlet.latitude.toFixed(4)), 1.4748);
    assert.equal(Number(res.primaryOutlet.longitude.toFixed(4)), 124.8421);

    // Verify 7 rows in operating hours
    assert.equal(res.operatingHours.length, 7);

    // Verify PostGIS direct query
    const outletDbRes = await pool.query<{
      lat: number;
      lon: number;
      is_primary: boolean;
    }>(
      `SELECT
         ST_Y(location::geometry) as lat,
         ST_X(location::geometry) as lon,
         is_primary
       FROM outlets
       WHERE id = $1;`,
      [res.primaryOutlet.id],
    );
    assert.equal(outletDbRes.rows.length, 1);
    assert.equal(Number(outletDbRes.rows[0].lat.toFixed(4)), 1.4748);
    assert.equal(Number(outletDbRes.rows[0].lon.toFixed(4)), 124.8421);
    assert.equal(outletDbRes.rows[0].is_primary, true);

    // Completed draft is retained in database with completed_at set
    const draftDbRes = await pool.query<{ completed_at: Date | null }>(
      `SELECT completed_at FROM merchant_business_setup_drafts WHERE merchant_profile_id = $1;`,
      [merchant.profileId],
    );
    assert.ok(draftDbRes.rows[0].completed_at !== null);

    // Status returns COMPLETE
    const status = await businessService.getSetupStatus(merchant.userId);
    assert.equal(status.state, 'COMPLETE');
    assert.equal(status.business?.name, 'RM Manado Asli Mantap');
    assert.equal(status.primaryOutlet?.name, 'Outlet Pusat Sam Ratulangi');

    // Concurrency / Idempotent retry: Re-calling completeSetup returns the completed state without error
    const retryRes = await businessService.completeSetup(merchant.userId, {
      business: { name: 'RM Manado Asli Mantap', categoryCode: 'KULINER' },
      outlet: {
        name: 'Outlet Pusat Sam Ratulangi',
        contactPhone: '+6281234567899',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Sam Ratulangi No. 100',
        latitude: 1.47483,
        longitude: 124.842079,
        timezone: 'Asia/Makassar',
      },
      operatingHours: schedule,
    });
    assert.equal(retryRes.state, 'COMPLETE');
    assert.equal(retryRes.business.id, res.business.id);
  });

  // =========================================================================
  // 6. Post-Completion Editing & Phase 2B Immutability
  // =========================================================================

  it('10. verifies post-completion editing endpoints and Phase 2B submission immutability', async () => {
    const merchant = await createApprovedMerchant('edit');
    await businessService.getOrCreateDraft(merchant.userId);
    const schedule = createValid7DaySchedule();

    await businessService.completeSetup(merchant.userId, {
      business: {
        name: 'RM Manado Sebelum Edit',
        categoryCode: 'KULINER',
      },
      outlet: {
        name: 'Outlet Samrat',
        contactPhone: '081234567890',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Samrat No. 1',
        latitude: 1.4748,
        longitude: 124.8421,
        timezone: 'Asia/Makassar',
      },
      operatingHours: schedule,
    });

    // 1. Edit Business
    const updatedBusiness = await businessService.updateBusiness(merchant.userId, {
      name: 'RM Manado Setelah Edit',
      description: 'Deskripsi usaha yang diperbarui',
    });
    assert.equal(updatedBusiness.name, 'RM Manado Setelah Edit');
    assert.equal(updatedBusiness.description, 'Deskripsi usaha yang diperbarui');

    // 2. Edit Primary Outlet (address, coordinates, operating hours)
    const updatedSchedule = [...schedule];
    updatedSchedule[0] = { dayOfWeek: 1, isClosed: false, openTime: '07:30', closeTime: '22:00' };

    const updatedOutlet = await businessService.updatePrimaryOutlet(merchant.userId, {
      name: 'Outlet Samrat Baru',
      addressDetail: 'Jl. Samrat No. 2 Blok B',
      latitude: 1.4750,
      longitude: 124.8425,
      operatingHours: updatedSchedule,
    });

    assert.equal(updatedOutlet.outlet.name, 'Outlet Samrat Baru');
    assert.equal(updatedOutlet.outlet.addressDetail, 'Jl. Samrat No. 2 Blok B');
    assert.equal(Number(updatedOutlet.outlet.latitude.toFixed(4)), 1.4750);
    assert.equal(Number(updatedOutlet.outlet.longitude.toFixed(4)), 124.8425);
    const monday = updatedOutlet.operatingHours.find((h) => h.dayOfWeek === 1);
    assert.equal(monday?.openTime, '07:30');
    assert.equal(monday?.closeTime, '22:00');

    // 3. INVARIANT: Phase 2B onboarding submission remains completely IMMUTABLE
    const subRes = await pool.query<{ proposed_business_name: string; address_detail: string }>(
      `SELECT proposed_business_name, address_detail FROM merchant_onboarding_submissions WHERE id = $1;`,
      [merchant.submissionId],
    );
    assert.equal(subRes.rows[0].proposed_business_name, 'RM Manado Mantap edit');
    assert.equal(subRes.rows[0].address_detail, 'Jl. Sam Ratulangi No. 123 (Alamat Korespondensi)');
  });

  // =========================================================================
  // 7. Suspension Preservation
  // =========================================================================

  it('11. preserves business and outlet during suspension but blocks mutations', async () => {
    const merchant = await createApprovedMerchant('susp');
    await businessService.getOrCreateDraft(merchant.userId);
    await businessService.completeSetup(merchant.userId, {
      business: { name: 'Usaha Aktif', categoryCode: 'KULINER' },
      outlet: {
        name: 'Outlet Aktif',
        contactPhone: '081234567890',
        province: 'Sulut',
        regencyOrCity: 'Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Samrat',
        latitude: 1.47,
        longitude: 124.84,
        timezone: 'Asia/Makassar',
      },
      operatingHours: createValid7DaySchedule(),
    });

    // Admin suspends merchant
    await adminService.suspendMerchant(merchant.profileId, testAdminId, 'Pelanggaran ketentuan operasional');

    // 1. Existing business and outlet records are preserved
    const busRes = await pool.query(`SELECT * FROM businesses WHERE merchant_profile_id = $1;`, [merchant.profileId]);
    assert.equal(busRes.rows.length, 1);
    const outletRes = await pool.query(`SELECT * FROM outlets WHERE business_id = $1;`, [busRes.rows[0].id]);
    assert.equal(outletRes.rows.length, 1);

    // 2. Mutations are strictly blocked (403)
    await assert.rejects(
      async () => businessService.updateBusiness(merchant.userId, { name: 'Coba Edit' }),
      (err: any) => err instanceof ForbiddenError,
    );
    await assert.rejects(
      async () => businessService.updatePrimaryOutlet(merchant.userId, { name: 'Coba Edit Outlet' }),
      (err: any) => err instanceof ForbiddenError,
    );
  });

  // =========================================================================
  // 8. Admin Read-Only Operational Summary
  // =========================================================================

  it('12. provides read-only operational summary in admin merchant detail endpoint', async () => {
    const merchant = await createApprovedMerchant('admin_summary');
    await businessService.getOrCreateDraft(merchant.userId);

    // Prior to complete setup: state is DRAFT
    const detailBefore = await adminService.getMerchantDetail(merchant.profileId);
    assert.ok(detailBefore.operationalSummary);
    assert.equal(detailBefore.operationalSummary?.setupState, 'DRAFT');
    assert.equal(detailBefore.operationalSummary?.business, null);

    // Complete setup
    await businessService.completeSetup(merchant.userId, {
      business: { name: 'Toko Admin Summary', categoryCode: 'TOKO_KELONTONG' },
      outlet: {
        name: 'Outlet Retail 1',
        contactPhone: '081234567890',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Roda No. 5',
        latitude: 1.4748,
        longitude: 124.8421,
        timezone: 'Asia/Makassar',
      },
      operatingHours: createValid7DaySchedule(),
    });

    // After complete setup: state is COMPLETE with full business, outlet, and operating hours
    const detailAfter = await adminService.getMerchantDetail(merchant.profileId);
    assert.ok(detailAfter.operationalSummary);
    assert.equal(detailAfter.operationalSummary?.setupState, 'COMPLETE');
    assert.equal(detailAfter.operationalSummary?.business?.name, 'Toko Admin Summary');
    assert.equal(detailAfter.operationalSummary?.business?.categoryCode, 'TOKO_KELONTONG');
    assert.equal(detailAfter.operationalSummary?.primaryOutlet?.name, 'Outlet Retail 1');
    assert.equal(detailAfter.operationalSummary?.primaryOutlet?.timezone, 'Asia/Makassar');
    assert.equal(detailAfter.operationalSummary?.operatingHours?.length, 7);
  });

  // =========================================================================
  // 9. Concurrency Protection
  // =========================================================================

  it('13. handles concurrent completeSetup requests safely without duplicating business or outlets', async () => {
    const merchant = await createApprovedMerchant('concurrent');
    await businessService.getOrCreateDraft(merchant.userId);

    const payload = {
      business: { name: 'Resto Concurrency Safe', categoryCode: 'KULINER', description: 'Testing parallel submits' },
      outlet: {
        name: 'Gerai Concurrency 1',
        contactPhone: '081200001111',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Sam Ratulangi No. 77',
        latitude: 1.4748,
        longitude: 124.8421,
        timezone: 'Asia/Makassar',
      },
      operatingHours: createValid7DaySchedule(),
    };

    // Launch two completion requests concurrently against the SAME approved merchant/draft
    const results = await Promise.allSettled([
      businessService.completeSetup(merchant.userId, payload),
      businessService.completeSetup(merchant.userId, payload),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length + rejected.length, 2, 'Total settled requests must equal 2');

    // At least one request must succeed (or both succeed returning identical idempotent representation)
    assert.ok(fulfilled.length >= 1, 'At least one concurrent completion request must succeed');

    if (fulfilled.length === 2) {
      const res1 = (fulfilled[0] as PromiseFulfilledResult<any>).value;
      const res2 = (fulfilled[1] as PromiseFulfilledResult<any>).value;
      assert.equal(res1.business.id, res2.business.id, 'Idempotent completion must return identical business ID');
      assert.equal(res1.primaryOutlet.id, res2.primaryOutlet.id, 'Idempotent completion must return identical outlet ID');
    }

    // Crucial Invariant Verification against database directly:
    // 1. Exact business count for merchant = 1
    const busCountRes = await pool.query(
      `SELECT COUNT(*) as count FROM businesses WHERE merchant_profile_id = $1;`,
      [merchant.profileId],
    );
    assert.equal(busCountRes.rows[0].count, '1', 'Must have exactly 1 business for merchant');

    // 2. Exact primary outlet count = 1
    const busRes = await pool.query(`SELECT id FROM businesses WHERE merchant_profile_id = $1;`, [merchant.profileId]);
    const businessId = busRes.rows[0].id;
    const outletCountRes = await pool.query(
      `SELECT COUNT(*) as count FROM outlets WHERE business_id = $1 AND is_primary = true;`,
      [businessId],
    );
    assert.equal(outletCountRes.rows[0].count, '1', 'Must have exactly 1 primary outlet for business');

    // Total outlets for this business must also be 1
    const allOutletsCountRes = await pool.query(
      `SELECT COUNT(*) as count FROM outlets WHERE business_id = $1;`,
      [businessId],
    );
    assert.equal(allOutletsCountRes.rows[0].count, '1', 'Total outlets for business must be exactly 1');

    // 3. Exact operating hours row count = 7
    const outletRes = await pool.query(`SELECT id FROM outlets WHERE business_id = $1;`, [businessId]);
    const outletId = outletRes.rows[0].id;
    const hoursCountRes = await pool.query(
      `SELECT COUNT(*) as count FROM outlet_operating_hours WHERE outlet_id = $1;`,
      [outletId],
    );
    assert.equal(hoursCountRes.rows[0].count, '7', 'Must have exactly 7 operating hours rows');

    // 4. Draft completed_at != null
    const draftRes = await pool.query(
      `SELECT completed_at FROM merchant_business_setup_drafts WHERE merchant_profile_id = $1;`,
      [merchant.profileId],
    );
    assert.ok(draftRes.rows[0].completed_at !== null, 'Draft completed_at must not be null');

    // 5. No partial duplicate state exists
    const allDraftsCount = await pool.query(
      `SELECT COUNT(*) as count FROM merchant_business_setup_drafts WHERE merchant_profile_id = $1;`,
      [merchant.profileId],
    );
    assert.equal(allDraftsCount.rows[0].count, '1', 'Must have exactly 1 draft record');
  });

  it('14. rejects completeSetup when approved merchant has no active setup draft and creates zero entities', async () => {
    const merchant = await createApprovedMerchant('no-draft');

    // Verify merchant has NO draft initially
    const draftCheck = await pool.query(
      `SELECT COUNT(*) as count FROM merchant_business_setup_drafts WHERE merchant_profile_id = $1;`,
      [merchant.profileId],
    );
    assert.equal(draftCheck.rows[0].count, '0', 'Must start with zero drafts');

    const payload = {
      business: {
        name: 'Direct Setup Bypass',
        categoryCode: 'KULINER',
      },
      outlet: {
        name: 'Direct Outlet Bypass',
        contactPhone: '081234567890',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Sam Ratulangi No. 100',
        latitude: 1.4748,
        longitude: 124.8421,
        timezone: 'Asia/Makassar',
      },
      operatingHours: createValid7DaySchedule(),
    };

    // Attempting direct completeSetup without an active draft must be rejected
    await assert.rejects(
      async () => {
        await businessService.completeSetup(merchant.userId, payload);
      },
      (err: any) =>
        err instanceof BadRequestError &&
        err.message.includes('Draft setup usaha aktif tidak ditemukan'),
    );

    // Verify relational invariant: 0 business, 0 outlets, 0 operating hours
    const busCount = await pool.query(
      `SELECT COUNT(*) as count FROM businesses WHERE merchant_profile_id = $1;`,
      [merchant.profileId],
    );
    assert.equal(busCount.rows[0].count, '0', 'Business count must remain 0');

    const outletCount = await pool.query(
      `SELECT COUNT(*) as count FROM outlets WHERE name = 'Direct Outlet Bypass';`,
    );
    assert.equal(outletCount.rows[0].count, '0', 'Outlets count must remain 0');

    const hoursCount = await pool.query(
      `SELECT COUNT(*) as count FROM outlet_operating_hours ooh
       JOIN outlets o ON ooh.outlet_id = o.id
       JOIN businesses b ON o.business_id = b.id
       WHERE b.merchant_profile_id = $1;`,
      [merchant.profileId],
    );
    assert.equal(hoursCount.rows[0].count, '0', 'Operating hours count must remain 0');
  });

  it('15. allows explicit zero coordinate on completion while rejecting missing/omitted coordinates', async () => {
    const merchantZero = await createApprovedMerchant('zero-coords');
    await businessService.getOrCreateDraft(merchantZero.userId);

    // Direct completion with legitimate latitude = 0 and longitude = 100.22 succeeds
    const res = await businessService.completeSetup(merchantZero.userId, {
      business: { name: 'Resto Ekuator', categoryCode: 'KULINER' },
      outlet: {
        name: 'Gerai Garis Khatulistiwa',
        contactPhone: '081234567890',
        province: 'Sumatera Barat',
        regencyOrCity: 'Kabupaten Pasaman',
        district: 'Bonjol',
        villageOrSubdistrict: 'Ganggo Hilia',
        addressDetail: 'Tugu Khatulistiwa Bonjol',
        latitude: 0,
        longitude: 100.22,
        timezone: 'Asia/Jakarta',
      },
      operatingHours: createValid7DaySchedule(),
    });

    assert.equal(res.primaryOutlet.latitude, 0);
    assert.equal(res.primaryOutlet.longitude, 100.22);
  });

  // =========================================================================
  // 10. Phase 2C Pre-Checkpoint Final Correction Regressions
  // =========================================================================

  it('16. completion finalizes one authoritative draft snapshot matching operational entities and persists differing final DTO', async () => {
    const merchant = await createApprovedMerchant('snap');

    // 1. Initial draft autosaved with initial name/description
    await businessService.getOrCreateDraft(merchant.userId);
    await businessService.saveDraft(merchant.userId, {
      business: {
        name: 'Nama Draf Lama',
        categoryCode: 'KULINER',
        description: 'Deskripsi lama di draf',
      },
      outlet: {
        name: 'Outlet Draf Lama',
        contactPhone: '081234567890',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Lama No. 1',
        postalCode: '95111',
        latitude: 1.4748,
        longitude: 124.8421,
        timezone: 'Asia/Makassar',
      },
    });

    // Verify draft was saved with older values
    const draftBefore = await businessService.getOrCreateDraft(merchant.userId);
    assert.equal(draftBefore.business?.name, 'Nama Draf Lama');
    assert.equal(draftBefore.outlet?.name, 'Outlet Draf Lama');

    // 2. Complete setup with differing final reviewed DTO values
    const finalSchedule = createValid7DaySchedule();
    const finalCompleteDto = {
      business: {
        name: 'RM Manado Final Authoritative',
        categoryCode: 'KULINER',
        description: 'Deskripsi final yang direview',
      },
      outlet: {
        name: 'Outlet Final Authoritative',
        contactPhone: '+6281122334455',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Sam Ratulangi No. 99',
        postalCode: '95112',
        latitude: 1.4749,
        longitude: 124.8422,
        timezone: 'Asia/Makassar',
      },
      operatingHours: finalSchedule,
    };

    const res = await businessService.completeSetup(merchant.userId, finalCompleteDto);

    // Operational entities created
    assert.equal(res.state, 'COMPLETE');
    assert.equal(res.business.name, 'RM Manado Final Authoritative');
    assert.equal(res.business.categoryCode, 'KULINER');
    assert.equal(res.business.description, 'Deskripsi final yang direview');
    assert.equal(res.primaryOutlet.name, 'Outlet Final Authoritative');
    assert.equal(res.primaryOutlet.contactPhone, '+6281122334455');
    assert.equal(res.primaryOutlet.postalCode, '95112');
    assert.equal(res.operatingHours.length, 7);

    // 3. Inspect the retained completed draft in DB
    const draftDbRes = await pool.query<{
      completed_at: Date;
      business_setup_payload: any;
      outlet_setup_payload: any;
      operating_hours_payload: any;
    }>(
      `SELECT completed_at, business_setup_payload, outlet_setup_payload, operating_hours_payload
       FROM merchant_business_setup_drafts
       WHERE merchant_profile_id = $1;`,
      [merchant.profileId],
    );
    assert.equal(draftDbRes.rows.length, 1);
    const retainedDraft = draftDbRes.rows[0];
    assert.ok(retainedDraft.completed_at !== null, 'completed_at must be set');

    // Prove final DTO differing from earlier autosave was persisted into draft BEFORE completion
    assert.equal(retainedDraft.business_setup_payload.name, 'RM Manado Final Authoritative');
    assert.equal(retainedDraft.outlet_setup_payload.name, 'Outlet Final Authoritative');

    // Prove draft.business_setup_payload == created Business relevant fields
    assert.equal(retainedDraft.business_setup_payload.name, res.business.name);
    assert.equal(retainedDraft.business_setup_payload.categoryCode, res.business.categoryCode);
    assert.equal(retainedDraft.business_setup_payload.description, res.business.description);

    // Prove draft.outlet_setup_payload == created Primary Outlet relevant fields
    assert.equal(retainedDraft.outlet_setup_payload.name, res.primaryOutlet.name);
    assert.equal(retainedDraft.outlet_setup_payload.contactPhone, res.primaryOutlet.contactPhone);
    assert.equal(retainedDraft.outlet_setup_payload.province, res.primaryOutlet.province);
    assert.equal(retainedDraft.outlet_setup_payload.regencyOrCity, res.primaryOutlet.regencyOrCity);
    assert.equal(retainedDraft.outlet_setup_payload.district, res.primaryOutlet.district);
    assert.equal(retainedDraft.outlet_setup_payload.villageOrSubdistrict, res.primaryOutlet.villageOrSubdistrict);
    assert.equal(retainedDraft.outlet_setup_payload.addressDetail, res.primaryOutlet.addressDetail);
    assert.equal(retainedDraft.outlet_setup_payload.postalCode, res.primaryOutlet.postalCode);
    assert.equal(retainedDraft.outlet_setup_payload.latitude, res.primaryOutlet.latitude);
    assert.equal(retainedDraft.outlet_setup_payload.longitude, res.primaryOutlet.longitude);
    assert.equal(retainedDraft.outlet_setup_payload.timezone, res.primaryOutlet.timezone);

    // Prove draft.operating_hours_payload == created 7 operating-hours values
    assert.equal(retainedDraft.operating_hours_payload.length, 7);
    for (let i = 0; i < 7; i++) {
      const draftHour = retainedDraft.operating_hours_payload[i];
      const createdHour = res.operatingHours.find((h) => h.dayOfWeek === draftHour.dayOfWeek);
      assert.ok(createdHour, `Operating hour day ${draftHour.dayOfWeek} must exist in created entities`);
      assert.equal(draftHour.isClosed, createdHour.isClosed);
      assert.equal(draftHour.openTime, createdHour.openTime);
      assert.equal(draftHour.closeTime, createdHour.closeTime);
    }
  });

  it('17. enforces canonical category codes across completeSetup, updateBusiness, and saveDraft', async () => {
    const merchant = await createApprovedMerchant('cat');
    await businessService.getOrCreateDraft(merchant.userId);

    const baseOutlet = {
      name: 'Outlet Category Test',
      contactPhone: '081234567890',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Wenang',
      villageOrSubdistrict: 'Calaca',
      addressDetail: 'Jl. Roda No. 10',
      latitude: 1.4748,
      longitude: 124.8421,
      timezone: 'Asia/Makassar',
    };
    const schedule = createValid7DaySchedule();

    // categoryCode = 'PHARMACY' => rejected
    await assert.rejects(
      async () => {
        await businessService.completeSetup(merchant.userId, {
          business: { name: 'Apotek Test', categoryCode: 'PHARMACY' as any },
          outlet: baseOutlet,
          operatingHours: schedule,
        });
      },
      (err: any) => err instanceof BadRequestError && err.message.includes('Kategori usaha tidak valid'),
    );

    // categoryCode = 'SERVICE' => rejected
    await assert.rejects(
      async () => {
        await businessService.completeSetup(merchant.userId, {
          business: { name: 'Service Test', categoryCode: 'SERVICE' as any },
          outlet: baseOutlet,
          operatingHours: schedule,
        });
      },
      (err: any) => err instanceof BadRequestError && err.message.includes('Kategori usaha tidak valid'),
    );

    // categoryCode = 'FOOD_BEVERAGE' => rejected
    await assert.rejects(
      async () => {
        await businessService.completeSetup(merchant.userId, {
          business: { name: 'F&B Test', categoryCode: 'FOOD_BEVERAGE' as any },
          outlet: baseOutlet,
          operatingHours: schedule,
        });
      },
      (err: any) => err instanceof BadRequestError && err.message.includes('Kategori usaha tidak valid'),
    );

    // saveDraft with invalid categoryCode explicitly supplied => rejected
    await assert.rejects(
      async () => {
        await businessService.saveDraft(merchant.userId, {
          business: { categoryCode: 'INVALID_CAT' as any },
        });
      },
      (err: any) => err instanceof BadRequestError && err.message.includes('Kategori usaha tidak valid'),
    );

    // categoryCode = 'KULINER' => accepted
    const completeRes = await businessService.completeSetup(merchant.userId, {
      business: { name: 'Kuliner Test', categoryCode: 'KULINER' },
      outlet: baseOutlet,
      operatingHours: schedule,
    });
    assert.equal(completeRes.business.categoryCode, 'KULINER');

    // updateBusiness with invalid category => rejected
    await assert.rejects(
      async () => {
        await businessService.updateBusiness(merchant.userId, {
          categoryCode: 'NON_CANONICAL' as any,
        });
      },
      (err: any) => err instanceof BadRequestError && err.message.includes('Kategori usaha tidak valid'),
    );

    // updateBusiness with canonical category => accepted
    const updated = await businessService.updateBusiness(merchant.userId, {
      categoryCode: 'TOKO_KELONTONG',
    });
    assert.equal(updated.categoryCode, 'TOKO_KELONTONG');
  });

  it('18. validates coordinates on post-completion update, rejecting NaN while accepting 0', async () => {
    const merchant = await createApprovedMerchant('nan_coords');
    await businessService.getOrCreateDraft(merchant.userId);
    await businessService.completeSetup(merchant.userId, {
      business: { name: 'Toko Geospasial', categoryCode: 'TOKO_KELONTONG' },
      outlet: {
        name: 'Outlet Geo 1',
        contactPhone: '081234567890',
        province: 'Sulawesi Utara',
        regencyOrCity: 'Kota Manado',
        district: 'Wenang',
        villageOrSubdistrict: 'Calaca',
        addressDetail: 'Jl. Geo No. 1',
        latitude: 1.4748,
        longitude: 124.8421,
        timezone: 'Asia/Makassar',
      },
      operatingHours: createValid7DaySchedule(),
    });

    // latitude NaN => rejected
    await assert.rejects(
      async () => {
        await businessService.updatePrimaryOutlet(merchant.userId, {
          latitude: NaN,
        });
      },
      (err: any) => err instanceof BadRequestError && err.message.includes('Latitude tidak valid'),
    );

    // longitude NaN => rejected
    await assert.rejects(
      async () => {
        await businessService.updatePrimaryOutlet(merchant.userId, {
          longitude: NaN,
        });
      },
      (err: any) => err instanceof BadRequestError && err.message.includes('Longitude tidak valid'),
    );

    // latitude 0 => accepted
    const updateLatZero = await businessService.updatePrimaryOutlet(merchant.userId, {
      latitude: 0,
      longitude: 100.5,
    });
    assert.equal(updateLatZero.outlet.latitude, 0);
    assert.equal(updateLatZero.outlet.longitude, 100.5);

    // longitude 0 => accepted
    const updateLonZero = await businessService.updatePrimaryOutlet(merchant.userId, {
      latitude: -5.2,
      longitude: 0,
    });
    assert.equal(updateLonZero.outlet.latitude, -5.2);
    assert.equal(updateLonZero.outlet.longitude, 0);
  });
});

