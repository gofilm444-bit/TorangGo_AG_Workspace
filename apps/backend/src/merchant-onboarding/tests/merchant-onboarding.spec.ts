import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { generateUuidV7 } from '@platform/utils';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema/index.js';
import { TransactionService, type DrizzleDb } from '../../database/transaction/transaction.service.js';
import { LocalDocumentStorage } from '../../storage/local-document-storage.js';
import { MerchantOnboardingService } from '../merchant-onboarding.service.js';
import { AdminVerificationService } from '../../admin/admin-verification.service.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  AppError,
} from '../../common/errors/app-error.js';
import { MERCHANT_TERMS_VERSION, PRIVACY_NOTICE_VERSION } from '@platform/shared-types';
import { Reflector } from '@nestjs/core';
import { AudienceGuard } from '../../auth/guards/audience.guard.js';
import { MerchantOnboardingController } from '../merchant-onboarding.controller.js';

const { Pool } = pg;

describe('Phase 2B: Merchant Onboarding Comprehensive Integration Suite', () => {
  let pool: pg.Pool;
  let db: DrizzleDb;
  let transactionService: TransactionService;
  let storage: LocalDocumentStorage;
  let onboardingService: MerchantOnboardingService;
  let adminService: AdminVerificationService;
  let testAdminId: string;

  before(async () => {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL is required for Phase 2B merchant onboarding tests');
    }
    pool = new Pool({ connectionString: connStr });
    db = drizzle(pool, { schema });
    transactionService = new TransactionService(db);
    storage = new LocalDocumentStorage();
    onboardingService = new MerchantOnboardingService(pool, transactionService, storage);
    adminService = new AdminVerificationService(pool, transactionService, storage);

    // Create seed admin account for audit log foreign keys
    testAdminId = generateUuidV7();
    await pool.query(
      `INSERT INTO admin_accounts (id, username, email, password_hash, status, mfa_enabled, created_at, updated_at)
       VALUES ($1, 'onboarding_admin', 'onboarding_admin@toranggo.id', 'dummy_hash', 'ACTIVE', false, now(), now())
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
    const phone = `+62812${Math.floor(10000000 + Math.random() * 90000000)}${phoneSuffix}`;
    await pool.query(
      `INSERT INTO users (id, phone, status, created_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', now(), now());`,
      [userId, phone],
    );
    return { userId, phone };
  }

  // Valid mock JPEG buffer with magic bytes FF D8 FF
  function createValidJpegBuffer(): Buffer {
    const buf = Buffer.alloc(1024);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    buf[3] = 0xe0;
    buf.write('JFIF', 6, 'ascii');
    return buf;
  }

  // Valid mock PNG buffer with magic bytes 89 50 4E 47
  function createValidPngBuffer(): Buffer {
    const buf = Buffer.alloc(1024);
    buf[0] = 0x89;
    buf[1] = 0x50;
    buf[2] = 0x4e;
    buf[3] = 0x47;
    buf[4] = 0x0d;
    buf[5] = 0x0a;
    buf[6] = 0x1a;
    buf[7] = 0x0a;
    return buf;
  }

  it('1. returns NOT_STARTED gate state when user has no draft and no profile', async () => {
    const { userId, phone } = await createTestUser('001');

    const status = await onboardingService.getOnboardingStatus(userId);
    assert.equal(status.state, 'NOT_STARTED');
    assert.equal(status.accountPhone, phone);
    assert.equal(status.draft, null);
    assert.equal(status.currentSubmission, null);
    assert.equal(status.merchantProfileId, null);
  });

  it('2. enforces 1 active draft per user invariant', async () => {
    const { userId, phone } = await createTestUser('002');

    // Create draft 1
    const draft1 = await onboardingService.getOrCreateDraft(userId);
    assert.ok(draft1.id);
    assert.equal(draft1.userId, userId);
    assert.equal(draft1.accountPhone, phone);

    // Calling getOrCreateDraft again returns the existing active draft
    const draft2 = await onboardingService.getOrCreateDraft(userId);
    assert.equal(draft2.id, draft1.id, 'Must return existing active draft');

    // Gate state is now DRAFT
    const status = await onboardingService.getOnboardingStatus(userId);
    assert.equal(status.state, 'DRAFT');
    assert.equal(status.draft?.id, draft1.id);
  });

  it('3. allows autosaving partial fields in draft', async () => {
    const { userId } = await createTestUser('003');
    await onboardingService.getOrCreateDraft(userId);

    // Save step 1 fields
    const updated1 = await onboardingService.saveDraft(userId, {
      fullName: 'Budi Santoso',
      nik: '7171012345678901',
      email: 'budi@example.com',
    });
    assert.equal(updated1.fullName, 'Budi Santoso');
    assert.equal(updated1.nik, '7171012345678901');
    assert.equal(updated1.email, 'budi@example.com');

    // Save step 2 fields
    const updated2 = await onboardingService.saveDraft(userId, {
      proposedBusinessName: 'Warung Torang Mantap',
      businessCategory: 'KULINER',
      businessDescription: 'Menyediakan kopi dan tinutuan',
    });
    assert.equal(updated2.fullName, 'Budi Santoso', 'Preserves previous fields');
    assert.equal(updated2.proposedBusinessName, 'Warung Torang Mantap');
    assert.equal(updated2.businessCategory, 'KULINER');

    // Save step 3 address fields
    const updated3 = await onboardingService.saveDraft(userId, {
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Wenang',
      villageOrSubdistrict: 'Tikala Baru',
      addressDetail: 'Jl. Sam Ratulangi No. 45',
    });
    assert.equal(updated3.province, 'Sulawesi Utara');
    assert.equal(updated3.addressDetail, 'Jl. Sam Ratulangi No. 45');
  });

  it('4. accepts valid JPEG and PNG KTP uploads with magic bytes sniffing', async () => {
    const { userId } = await createTestUser('004');
    await onboardingService.getOrCreateDraft(userId);

    // Upload JPEG
    const jpegBuf = createValidJpegBuffer();
    const docJpeg = await onboardingService.uploadDraftKtp(userId, jpegBuf, 'ktp_budi.jpg');
    assert.ok(docJpeg.id);
    assert.equal(docJpeg.documentType, 'KTP_FRONT');
    assert.equal(docJpeg.mimeType, 'image/jpeg');
    assert.equal(docJpeg.sizeBytes, 1024);

    // Verify storage key is opaque and contains no PII
    const docRow = await pool.query<{ storage_key: string }>(
      `SELECT storage_key FROM merchant_onboarding_documents WHERE id = $1;`,
      [docJpeg.id],
    );
    assert.ok(!docRow.rows[0].storage_key.includes('budi'), 'Storage key must not contain owner PII');
    assert.ok(docRow.rows[0].storage_key.startsWith('merchant-onboarding/'), 'Opaque prefix');

    // Upload PNG (replacing previous)
    const pngBuf = createValidPngBuffer();
    const docPng = await onboardingService.uploadDraftKtp(userId, pngBuf, 'ktp_baru.png');
    assert.ok(docPng.id);
    assert.equal(docPng.mimeType, 'image/png');

    // Draft now references docPng
    const status = await onboardingService.getOnboardingStatus(userId);
    assert.equal(status.draft?.ktpDocumentId, docPng.id);
  });

  it('5. rejects invalid MIME or fake file extensions that fail magic byte sniffing', async () => {
    const { userId } = await createTestUser('005');
    await onboardingService.getOrCreateDraft(userId);

    // Fake text file disguised as .jpg
    const fakeBuf = Buffer.from('NOT_AN_IMAGE_JUST_PLAINTEXT_FILE_PAYLOAD');
    await assert.rejects(
      async () => {
        await onboardingService.uploadDraftKtp(userId, fakeBuf, 'fake.jpg');
      },
      (err: unknown) => {
        assert.ok(err instanceof BadRequestError);
        assert.ok((err as BadRequestError).message.includes('Format file KTP tidak valid'));
        return true;
      },
    );

    // File exceeding 5MB limit
    const largeBuf = Buffer.alloc(5 * 1024 * 1024 + 1024);
    largeBuf[0] = 0xff;
    largeBuf[1] = 0xd8;
    largeBuf[2] = 0xff;
    await assert.rejects(
      async () => {
        await onboardingService.uploadDraftKtp(userId, largeBuf, 'big.jpg');
      },
      (err: unknown) => {
        assert.ok(err instanceof BadRequestError);
        assert.ok((err as BadRequestError).message.includes('5 MB'));
        return true;
      },
    );
  });

  it('6. protects document streaming: owner authorized, stranger forbidden (403)', async () => {
    const { userId: ownerId } = await createTestUser('006a');
    const { userId: strangerId } = await createTestUser('006b');
    await onboardingService.getOrCreateDraft(ownerId);

    const doc = await onboardingService.uploadDraftKtp(
      ownerId,
      createValidJpegBuffer(),
      'ktp.jpg',
    );

    // Owner streaming succeeds
    const streamOwner = await onboardingService.getDocumentContentForOwner(ownerId, doc.id);
    assert.equal(streamOwner.mimeType, 'image/jpeg');
    assert.ok(streamOwner.stream);

    // Stranger streaming fails with ForbiddenError (403)
    await assert.rejects(
      async () => {
        await onboardingService.getDocumentContentForOwner(strangerId, doc.id);
      },
      (err: unknown) => {
        assert.ok(err instanceof ForbiddenError);
        return true;
      },
    );
  });

  it('7. enforces mandatory field validation and consent checkboxes on submit', async () => {
    const { userId } = await createTestUser('007');
    await onboardingService.getOrCreateDraft(userId);

    // Incomplete draft submission fails
    await assert.rejects(
      async () => {
        await onboardingService.submitOnboarding(userId, {
          dataAccuracyAccepted: true,
          merchantTermsAccepted: true,
          privacyConsentAccepted: true,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof BadRequestError);
        return true;
      },
    );

    // Populate all fields except consent checkboxes
    await onboardingService.saveDraft(userId, {
      fullName: 'Budi Hartono',
      nik: '7171012345678902',
      proposedBusinessName: 'RM Minahasa Raya',
      businessCategory: 'KULINER',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Sario',
      villageOrSubdistrict: 'Sario Tumpaan',
      addressDetail: 'Jl. Ahmad Yani No. 10',
    });
    await onboardingService.uploadDraftKtp(userId, createValidJpegBuffer(), 'ktp.jpg');

    // Missing consent fails
    await assert.rejects(
      async () => {
        await onboardingService.submitOnboarding(userId, {
          dataAccuracyAccepted: false,
          merchantTermsAccepted: true,
          privacyConsentAccepted: true,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof BadRequestError);
        assert.ok((err as BadRequestError).message.includes('persetujuan'));
        return true;
      },
    );
  });

  it('8. executes atomic first submission: creates merchant_profiles + submission #1 (PENDING) and clears draft', async () => {
    const { userId, phone } = await createTestUser('008');
    await onboardingService.getOrCreateDraft(userId);
    await onboardingService.saveDraft(userId, {
      fullName: 'Budi Hartono',
      nik: '7171012345678902',
      email: 'budi.h@example.com',
      proposedBusinessName: 'RM Minahasa Raya',
      businessCategory: 'KULINER',
      businessDescription: 'Restoran masakan khas Manado',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Sario',
      villageOrSubdistrict: 'Sario Tumpaan',
      addressDetail: 'Jl. Ahmad Yani No. 10',
    });
    await onboardingService.uploadDraftKtp(userId, createValidJpegBuffer(), 'ktp.jpg');

    const result = await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });

    // Verify submission status response
    assert.equal(result.state, 'PENDING');
    assert.equal(result.draft, null, 'Draft must be cleared upon submission');
    assert.ok(result.merchantProfileId);
    assert.ok(result.currentSubmission);
    assert.equal(result.currentSubmission.revisionNumber, 1);
    assert.equal(result.currentSubmission.status, 'PENDING');
    assert.equal(result.currentSubmission.maskedNik, '************8902', 'Masked NIK by default');
    assert.equal(result.currentSubmission.accountPhoneSnapshot, phone);
    assert.equal(result.currentSubmission.merchantTermsVersion, MERCHANT_TERMS_VERSION);
    assert.equal(result.currentSubmission.privacyNoticeVersion, PRIVACY_NOTICE_VERSION);

    // Verify DB records
    const profileRow = await pool.query<{ status: string; current_submission_id: string }>(
      `SELECT status, current_submission_id FROM merchant_profiles WHERE id = $1;`,
      [result.merchantProfileId],
    );
    assert.equal(profileRow.rows[0].status, 'PENDING');
    assert.equal(profileRow.rows[0].current_submission_id, result.currentSubmission.id);

    // Verify draft row deleted
    const draftRow = await pool.query(`SELECT id FROM merchant_onboarding_drafts WHERE user_id = $1;`, [userId]);
    assert.equal(draftRow.rows.length, 0);
  });

  it('9. enforces Stale Admin Review Guard: 409 Conflict when expectedSubmissionId does not match current', async () => {
    const { userId } = await createTestUser('009');
    await onboardingService.getOrCreateDraft(userId);
    await onboardingService.saveDraft(userId, {
      fullName: 'Santoso S',
      nik: '7171012345678903',
      proposedBusinessName: 'Toko Sumber Rejeki',
      businessCategory: 'TOKO_KELONTONG',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Malalayang',
      villageOrSubdistrict: 'Bahu',
      addressDetail: 'Jl. Wolter Monginsidi No. 1',
    });
    await onboardingService.uploadDraftKtp(userId, createValidJpegBuffer(), 'ktp.jpg');

    const submitted = await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });
    const profileId = submitted.merchantProfileId!;
    const staleSubmissionId = generateUuidV7(); // synthetic old submission ID

    // Admin attempts to approve with stale expectedSubmissionId -> 409 Conflict
    await assert.rejects(
      async () => {
        await adminService.approveMerchant(
          profileId,
          testAdminId,
          'Approved by admin',
          undefined,
          staleSubmissionId,
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok((err as ConflictError).message.includes('Pengajuan telah berubah'));
        return true;
      },
    );

    // Admin attempts to reject with stale expectedSubmissionId -> 409 Conflict
    await assert.rejects(
      async () => {
        await adminService.rejectMerchant(
          profileId,
          testAdminId,
          'Rejected reason',
          undefined,
          staleSubmissionId,
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok((err as ConflictError).message.includes('Pengajuan telah berubah'));
        return true;
      },
    );
  });

  it('10. full rejection, repair draft cloning, and resubmission lifecycle with revision #2', async () => {
    const { userId } = await createTestUser('010');
    await onboardingService.getOrCreateDraft(userId);
    await onboardingService.saveDraft(userId, {
      fullName: 'Joko Widodo',
      nik: '7171012345678904',
      proposedBusinessName: 'Warung Berkah 1',
      businessCategory: 'KULINER',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Tuminting',
      villageOrSubdistrict: 'Bitung Karangria',
      addressDetail: 'Jl. Hasanuddin No. 9',
    });
    await onboardingService.uploadDraftKtp(userId, createValidJpegBuffer(), 'ktp.jpg');

    const sub1 = await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });
    const profileId = sub1.merchantProfileId!;
    const sub1Id = sub1.currentSubmission!.id;

    // 1. Admin rejects submission #1 with reason
    const rejectedDetail = await adminService.rejectMerchant(
      profileId,
      testAdminId,
      'Foto KTP buram dan tidak terbaca jelas',
      undefined,
      sub1Id,
    );
    assert.equal(rejectedDetail.status, 'REJECTED');
    assert.equal(rejectedDetail.currentSubmission?.status, 'REJECTED');

    // Merchant status shows REJECTED with rejection reason
    const merchantStatus = await onboardingService.getOnboardingStatus(userId);
    assert.equal(merchantStatus.state, 'REJECTED');
    assert.equal(merchantStatus.rejectionReason, 'Foto KTP buram dan tidak terbaca jelas');

    // 2. Merchant repairs: clones submission #1 into editable draft
    const repairDraft = await onboardingService.repairRejected(userId);
    assert.equal(repairDraft.fullName, 'Joko Widodo');
    assert.equal(repairDraft.proposedBusinessName, 'Warung Berkah 1');
    assert.equal(repairDraft.ktpDocumentId, sub1.currentSubmission!.ktpDocumentId);

    // Gate state is now DRAFT
    const statusInRepair = await onboardingService.getOnboardingStatus(userId);
    assert.equal(statusInRepair.state, 'DRAFT');

    // 3. Merchant fixes data: updates business name and uploads new clear KTP
    await onboardingService.saveDraft(userId, {
      proposedBusinessName: 'Warung Berkah 2 (Revisi)',
    });
    const newKtp = await onboardingService.uploadDraftKtp(
      userId,
      createValidPngBuffer(),
      'ktp_jelas.png',
    );

    // 4. Merchant resubmits: profile status transitions REJECTED -> PENDING
    const resubmitted = await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });

    assert.equal(resubmitted.state, 'PENDING');
    assert.equal(resubmitted.currentSubmission!.revisionNumber, 2);
    assert.equal(resubmitted.currentSubmission!.supersedesSubmissionId, sub1Id);
    assert.equal(resubmitted.currentSubmission!.proposedBusinessName, 'Warung Berkah 2 (Revisi)');
    assert.equal(resubmitted.currentSubmission!.ktpDocumentId, newKtp.id);

    // Verify merchant profile status transitioned REJECTED -> PENDING
    const pRow = await pool.query<{ status: string; current_submission_id: string }>(
      `SELECT status, current_submission_id FROM merchant_profiles WHERE id = $1;`,
      [profileId],
    );
    assert.equal(pRow.rows[0].status, 'PENDING');
    assert.equal(pRow.rows[0].current_submission_id, resubmitted.currentSubmission!.id);

    // 5. Admin approves submission #2
    const approvedDetail = await adminService.approveMerchant(
      profileId,
      testAdminId,
      'Dokumen revisi valid dan jelas',
      undefined,
      resubmitted.currentSubmission!.id,
    );
    assert.equal(approvedDetail.status, 'APPROVED');
    assert.equal(approvedDetail.currentSubmission?.status, 'APPROVED');

    // Merchant status is now APPROVED
    const finalStatus = await onboardingService.getOnboardingStatus(userId);
    assert.equal(finalStatus.state, 'APPROVED');
  });

  it('11. verifies admin reveal NIK and stream KTP functionality', async () => {
    const { userId } = await createTestUser('011');
    await onboardingService.getOrCreateDraft(userId);
    await onboardingService.saveDraft(userId, {
      fullName: 'Ratna Sari',
      nik: '7171012345678905',
      proposedBusinessName: 'Salon Cantik',
      businessCategory: 'JASA',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Wanea',
      villageOrSubdistrict: 'Teling Atas',
      addressDetail: 'Jl. 17 Agustus No. 20',
    });
    await onboardingService.uploadDraftKtp(userId, createValidJpegBuffer(), 'ktp_ratna.jpg');

    const sub = await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });
    const profileId = sub.merchantProfileId!;

    // Reveal unmasked NIK
    const revealed = await adminService.revealMerchantNik(profileId);
    assert.equal(revealed.nik, '7171012345678905');

    // Stream KTP
    const streamed = await adminService.streamMerchantKtp(profileId);
    assert.equal(streamed.mimeType, 'image/jpeg');
    assert.equal(streamed.sizeBytes, 1024);
    assert.ok(streamed.stream);
  });

  it('12. allows partial NIK and clearing email in draft, but enforces strict validation on submit', async () => {
    const { userId } = await createTestUser('012');
    await onboardingService.getOrCreateDraft(userId);

    // Save partial NIK (4 digits while typing) and email
    const draftPartial = await onboardingService.saveDraft(userId, {
      fullName: 'Ahmad Yani',
      nik: '7171',
      email: 'ahmad@example.com',
      proposedBusinessName: 'Warung Ahmad',
      businessCategory: 'KULINER',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Sario',
      villageOrSubdistrict: 'Sario',
      addressDetail: 'Jl. Sam Ratulangi No. 1',
    });
    assert.equal(draftPartial.nik, '7171');
    assert.equal(draftPartial.email, 'ahmad@example.com');

    // Clear optional email field by setting to null or empty string
    const draftCleared = await onboardingService.saveDraft(userId, {
      email: null,
    });
    assert.equal(draftCleared.email, null);

    await onboardingService.uploadDraftKtp(userId, createValidJpegBuffer(), 'ktp.jpg');

    // Submit must fail because NIK is not 16 digits
    await assert.rejects(
      async () => {
        await onboardingService.submitOnboarding(userId, {
          dataAccuracyAccepted: true,
          merchantTermsAccepted: true,
          privacyConsentAccepted: true,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof BadRequestError);
        assert.ok((err as BadRequestError).message.includes('NIK'));
        return true;
      },
    );

    // Now fix NIK to exactly 16 digits, but set invalid email format
    await onboardingService.saveDraft(userId, {
      nik: '7171012345678912',
      email: 'invalid-email-format',
    });

    await assert.rejects(
      async () => {
        await onboardingService.submitOnboarding(userId, {
          dataAccuracyAccepted: true,
          merchantTermsAccepted: true,
          privacyConsentAccepted: true,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof BadRequestError);
        assert.ok((err as BadRequestError).message.includes('email'));
        return true;
      },
    );

    // Fix email to valid format and submit successfully
    await onboardingService.saveDraft(userId, {
      email: 'ahmad.valid@example.com',
    });
    const sub = await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });
    assert.equal(sub.state, 'PENDING');
    assert.equal(sub.currentSubmission?.email, 'ahmad.valid@example.com');
  });

  it('13. cleans up replaced draft KTP document/storage while protecting historical submitted KTP', async () => {
    const { userId } = await createTestUser('013');
    await onboardingService.getOrCreateDraft(userId);

    // 1. Upload KTP 1
    const ktp1 = await onboardingService.uploadDraftKtp(
      userId,
      createValidJpegBuffer(),
      'ktp1.jpg',
    );
    const doc1Row = await pool.query<{ id: string; storage_key: string }>(
      `SELECT id, storage_key FROM merchant_onboarding_documents WHERE id = $1;`,
      [ktp1.id],
    );
    assert.equal(doc1Row.rows.length, 1);
    assert.equal(await storage.exists(doc1Row.rows[0].storage_key), true);

    // 2. Replace with KTP 2 before submitting
    const ktp2 = await onboardingService.uploadDraftKtp(
      userId,
      createValidPngBuffer(),
      'ktp2.png',
    );
    const doc2Row = await pool.query<{ id: string; storage_key: string }>(
      `SELECT id, storage_key FROM merchant_onboarding_documents WHERE id = $1;`,
      [ktp2.id],
    );
    assert.equal(doc2Row.rows.length, 1);
    assert.equal(await storage.exists(doc2Row.rows[0].storage_key), true);

    // Verify KTP 1 was cleaned up from DB and storage
    const doc1Check = await pool.query(
      `SELECT id FROM merchant_onboarding_documents WHERE id = $1;`,
      [ktp1.id],
    );
    assert.equal(doc1Check.rows.length, 0, 'KTP 1 document record must be deleted');
    assert.equal(
      await storage.exists(doc1Row.rows[0].storage_key),
      false,
      'KTP 1 storage file must be deleted',
    );

    // 3. Submit onboarding with KTP 2
    await onboardingService.saveDraft(userId, {
      fullName: 'Dewi Sartika',
      nik: '7171012345678913',
      proposedBusinessName: 'Apotek Sehat',
      businessCategory: 'TOKO_KELONTONG',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Malalayang',
      villageOrSubdistrict: 'Bahu',
      addressDetail: 'Jl. Wolter Monginsidi No. 5',
    });
    const sub = await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });
    const profileId = sub.merchantProfileId!;

    // 4. Admin rejects submission #1
    await adminService.rejectMerchant(
      profileId,
      testAdminId,
      'Foto KTP terpotong bagian bawah',
      undefined,
      sub.currentSubmission!.id,
    );

    // 5. User repairs and uploads KTP 3
    await onboardingService.repairRejected(userId);
    const ktp3 = await onboardingService.uploadDraftKtp(
      userId,
      createValidJpegBuffer(),
      'ktp3.jpg',
    );

    // Verify KTP 2 is STILL preserved in DB and storage because it belongs to Submission #1
    const doc2HistoricalCheck = await pool.query(
      `SELECT id FROM merchant_onboarding_documents WHERE id = $1;`,
      [ktp2.id],
    );
    assert.equal(doc2HistoricalCheck.rows.length, 1, 'Historical submitted KTP 2 must NOT be deleted');
    assert.equal(
      await storage.exists(doc2Row.rows[0].storage_key),
      true,
      'Historical submitted KTP 2 file must NOT be deleted',
    );

    // Verify KTP 3 is the active draft KTP
    const draftNow = await onboardingService.getOrCreateDraft(userId);
    assert.equal(draftNow.ktpDocumentId, ktp3.id);
  });

  it('14. enforces explicit repair endpoint call on REJECTED profiles', async () => {
    const { userId } = await createTestUser('014');
    await onboardingService.getOrCreateDraft(userId);
    await onboardingService.saveDraft(userId, {
      fullName: 'Bambang Soediro',
      nik: '7171012345678914',
      proposedBusinessName: 'Bengkel Maju',
      businessCategory: 'JASA',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Mapanget',
      villageOrSubdistrict: 'Paniki Bawah',
      addressDetail: 'Jl. Bandara No. 10',
    });
    await onboardingService.uploadDraftKtp(userId, createValidJpegBuffer(), 'ktp.jpg');
    const sub = await onboardingService.submitOnboarding(userId, {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    });
    const profileId = sub.merchantProfileId!;

    // Reject submission
    await adminService.rejectMerchant(
      profileId,
      testAdminId,
      'NIK pada KTP tidak cocok',
      undefined,
      sub.currentSubmission!.id,
    );

    // Calling getOrCreateDraft directly must fail with ConflictError
    await assert.rejects(
      async () => {
        await onboardingService.getOrCreateDraft(userId);
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok((err as ConflictError).message.includes('perbaikan pendaftaran'));
        return true;
      },
    );

    // Calling repairRejected explicitly succeeds and instantiates draft
    const repairDraft = await onboardingService.repairRejected(userId);
    assert.ok(repairDraft.id);
    assert.equal(repairDraft.fullName, 'Bambang Soediro');

    // Calling getOrCreateDraft now returns the active repair draft
    const activeDraft = await onboardingService.getOrCreateDraft(userId);
    assert.equal(activeDraft.id, repairDraft.id);
  });

  it('15. concurrency and idempotency suite', async () => {
    // 15A. Concurrent first submit
    const { userId: userA } = await createTestUser('015A');
    await onboardingService.getOrCreateDraft(userA);
    await onboardingService.saveDraft(userA, {
      fullName: 'Citra Kirana',
      nik: '7171012345678915',
      proposedBusinessName: 'Toko Citra',
      businessCategory: 'FASHION',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Wenang',
      villageOrSubdistrict: 'Calaca',
      addressDetail: 'Pasar 45 Blok A',
    });
    await onboardingService.uploadDraftKtp(userA, createValidJpegBuffer(), 'ktp.jpg');

    const submitDto = {
      dataAccuracyAccepted: true,
      merchantTermsAccepted: true,
      privacyConsentAccepted: true,
    };

    // Run 2 parallel submits
    const results = await Promise.allSettled([
      onboardingService.submitOnboarding(userA, submitDto),
      onboardingService.submitOnboarding(userA, submitDto),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Exactly one concurrent first submit must succeed');
    assert.equal(rejected.length, 1, 'The other concurrent submit must be rejected');

    // Verify DB has exactly 1 submission and 1 profile row
    const pCount = await pool.query(`SELECT COUNT(*) as count FROM merchant_profiles WHERE user_id = $1;`, [userA]);
    assert.equal(pCount.rows[0].count, '1');
    const sCount = await pool.query(
      `SELECT COUNT(*) as count FROM merchant_onboarding_submissions WHERE submitted_by_user_id = $1;`,
      [userA],
    );
    assert.equal(sCount.rows[0].count, '1');

    // 15B. Concurrent admin decisions: two admins decisioning simultaneously
    const profileIdA = (fulfilled[0] as PromiseFulfilledResult<any>).value.merchantProfileId;
    const subIdA = (fulfilled[0] as PromiseFulfilledResult<any>).value.currentSubmission.id;

    const adminDecisions = await Promise.allSettled([
      adminService.approveMerchant(profileIdA, testAdminId, 'Admin 1 approved', undefined, subIdA),
      adminService.rejectMerchant(profileIdA, testAdminId, 'Admin 2 rejected', undefined, subIdA),
    ]);

    const adminFulfilled = adminDecisions.filter((r) => r.status === 'fulfilled');
    const adminRejected = adminDecisions.filter((r) => r.status === 'rejected');

    assert.equal(adminFulfilled.length, 1, 'Exactly one concurrent admin decision must win');
    assert.equal(adminRejected.length, 1, 'Conflicting concurrent decision must be rejected');
    assert.ok(
      (adminRejected[0] as PromiseRejectedResult).reason instanceof ConflictError,
      'Second decision must reject with ConflictError',
    );

    // 15C. Real stale review #1 vs #2
    const { userId: userB } = await createTestUser('015B');
    await onboardingService.getOrCreateDraft(userB);
    await onboardingService.saveDraft(userB, {
      fullName: 'Eko Prasetyo',
      nik: '7171012345678916',
      proposedBusinessName: 'Bengkel Eko',
      businessCategory: 'JASA',
      province: 'Sulawesi Utara',
      regencyOrCity: 'Kota Manado',
      district: 'Sario',
      villageOrSubdistrict: 'Sario Tumpaan',
      addressDetail: 'Jl. Ahmad Yani No. 12',
    });
    await onboardingService.uploadDraftKtp(userB, createValidJpegBuffer(), 'ktp.jpg');
    const sub1 = await onboardingService.submitOnboarding(userB, submitDto);
    const profileIdB = sub1.merchantProfileId!;
    const sub1Id = sub1.currentSubmission!.id;

    // Admin rejects #1
    await adminService.rejectMerchant(profileIdB, testAdminId, 'KTP buram', undefined, sub1Id);

    // User repairs and submits #2
    await onboardingService.repairRejected(userB);
    await onboardingService.uploadDraftKtp(userB, createValidPngBuffer(), 'ktp_clear.png');
    const sub2 = await onboardingService.submitOnboarding(userB, submitDto);
    const sub2Id = sub2.currentSubmission!.id;

    // Admin attempts to review with stale expectedSubmissionId (#1)
    await assert.rejects(
      async () => {
        await adminService.approveMerchant(profileIdB, testAdminId, 'Approved', undefined, sub1Id);
      },
      (err: unknown) => {
        assert.ok(err instanceof ConflictError);
        assert.ok((err as ConflictError).message.includes('Pengajuan telah berubah'));
        return true;
      },
    );

    // Approving with current expectedSubmissionId (#2) succeeds
    const approved = await adminService.approveMerchant(
      profileIdB,
      testAdminId,
      'Approved',
      undefined,
      sub2Id,
    );
    assert.equal(approved.status, 'APPROVED');
  });

  it('16. enforces AudienceGuard on MerchantOnboardingController to allow PARTNER_APP and reject others', () => {
    const reflector = new Reflector();
    const guard = new AudienceGuard(reflector);

    function createMockContext(audience?: string): any {
      return {
        getHandler: () => MerchantOnboardingController.prototype.getStatus,
        getClass: () => MerchantOnboardingController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: audience ? { id: generateUuidV7(), audience } : undefined,
          }),
        }),
      };
    }

    // 1. Valid partner audiences
    assert.equal(guard.canActivate(createMockContext('PARTNER_APP')), true);
    assert.equal(guard.canActivate(createMockContext('MERCHANT_APP')), true);

    // 2. Prohibited audiences
    assert.throws(
      () => guard.canActivate(createMockContext('CUSTOMER_APP')),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).code, 'AUTH_AUDIENCE_MISMATCH');
        return true;
      },
    );

    assert.throws(
      () => guard.canActivate(createMockContext('DRIVER_APP')),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).code, 'AUTH_AUDIENCE_MISMATCH');
        return true;
      },
    );

    assert.throws(
      () => guard.canActivate(createMockContext('ADMIN_WEB')),
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal((err as AppError).code, 'AUTH_AUDIENCE_MISMATCH');
        return true;
      },
    );
  });
});
