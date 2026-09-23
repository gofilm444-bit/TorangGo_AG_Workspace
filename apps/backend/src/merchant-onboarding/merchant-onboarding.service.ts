import { Injectable, Inject } from '@nestjs/common';
import type pg from 'pg';
import { sql } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/utils';
import {
  MERCHANT_TERMS_VERSION,
  PRIVACY_NOTICE_VERSION,
  type MerchantOnboardingGateState,
} from '@platform/shared-types';
import { PG_POOL_TOKEN } from '../database/database.tokens.js';
import { TransactionService } from '../database/transaction/transaction.service.js';
import {
  PRIVATE_DOCUMENT_STORAGE,
  type PrivateDocumentStorage,
} from '../storage/storage.interface.js';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from '../common/errors/app-error.js';
import { detectAllowedKtpMime } from './mime-sniffer.js';
import { maskNik } from './nik-utils.js';
import type {
  SaveMerchantOnboardingDraftDto,
  SubmitMerchantOnboardingDto,
  MerchantOnboardingDraftDto,
  MerchantOnboardingDocumentDto,
  MerchantOnboardingSubmissionDto,
  MerchantOnboardingStatusResponseDto,
} from './dto/merchant-onboarding.dto.js';

type RawDraftRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  nik: string | null;
  email: string | null;
  alternate_contact: string | null;
  proposed_business_name: string | null;
  business_category: string | null;
  business_description: string | null;
  province: string | null;
  regency_or_city: string | null;
  district: string | null;
  village_or_subdistrict: string | null;
  address_detail: string | null;
  ktp_document_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type RawDocumentRow = {
  id: string;
  owner_user_id: string;
  document_type: string;
  storage_key: string;
  sanitized_original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: Date;
};

type RawSubmissionRow = {
  id: string;
  merchant_profile_id: string;
  submitted_by_user_id: string;
  revision_number: number;
  supersedes_submission_id: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  full_name: string;
  nik: string;
  account_phone_snapshot: string;
  email: string | null;
  alternate_contact: string | null;
  proposed_business_name: string;
  business_category: string;
  business_description: string | null;
  province: string;
  regency_or_city: string;
  district: string;
  village_or_subdistrict: string;
  address_detail: string;
  ktp_document_id: string;
  data_accuracy_accepted_at: Date;
  merchant_terms_accepted_at: Date;
  merchant_terms_version: string;
  privacy_consent_accepted_at: Date;
  privacy_notice_version: string;
  submitted_at: Date;
  created_at: Date;
};

type RawProfileRow = {
  id: string;
  user_id: string;
  business_name: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  current_submission_id: string | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class MerchantOnboardingService {
  constructor(
    @Inject(PG_POOL_TOKEN)
    private readonly pool: pg.Pool,
    private readonly transactionService: TransactionService,
    @Inject(PRIVATE_DOCUMENT_STORAGE)
    private readonly storage: PrivateDocumentStorage,
  ) {}

  /**
   * Resolve user account phone number.
   */
  private async getUserPhone(userId: string): Promise<string> {
    const res = await this.pool.query<{ phone: string }>(
      `SELECT phone FROM users WHERE id = $1;`,
      [userId],
    );
    if (!res.rows[0]) {
      throw new NotFoundError(`User account not found: ${userId}`);
    }
    return res.rows[0].phone;
  }

  /**
   * Fetch document metadata if id is present.
   */
  private async getDocumentDto(
    documentId: string | null,
  ): Promise<MerchantOnboardingDocumentDto | null> {
    if (!documentId) return null;
    const res = await this.pool.query<RawDocumentRow>(
      `SELECT id, document_type, sanitized_original_filename, mime_type, size_bytes, created_at
       FROM merchant_onboarding_documents WHERE id = $1;`,
      [documentId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      documentType: row.document_type,
      sanitizedOriginalFilename: row.sanitized_original_filename,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Map raw draft row to DTO.
   */
  private async mapDraftToDto(
    row: RawDraftRow,
    accountPhone: string,
  ): Promise<MerchantOnboardingDraftDto> {
    const ktpDoc = await this.getDocumentDto(row.ktp_document_id);
    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      nik: row.nik, // Full NIK in owner draft view for correction
      accountPhone,
      email: row.email,
      alternateContact: row.alternate_contact,
      proposedBusinessName: row.proposed_business_name,
      businessCategory: row.business_category,
      businessDescription: row.business_description,
      province: row.province,
      regencyOrCity: row.regency_or_city,
      district: row.district,
      villageOrSubdistrict: row.village_or_subdistrict,
      addressDetail: row.address_detail,
      ktpDocumentId: row.ktp_document_id,
      ktpDocument: ktpDoc,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Map raw submission row to DTO.
   */
  private async mapSubmissionToDto(
    row: RawSubmissionRow,
    rejectionReason?: string | null,
  ): Promise<MerchantOnboardingSubmissionDto> {
    const ktpDoc = await this.getDocumentDto(row.ktp_document_id);
    return {
      id: row.id,
      merchantProfileId: row.merchant_profile_id,
      revisionNumber: row.revision_number,
      supersedesSubmissionId: row.supersedes_submission_id,
      status: row.status,
      fullName: row.full_name,
      maskedNik: maskNik(row.nik),
      accountPhoneSnapshot: row.account_phone_snapshot,
      email: row.email,
      alternateContact: row.alternate_contact,
      proposedBusinessName: row.proposed_business_name,
      businessCategory: row.business_category,
      businessDescription: row.business_description,
      province: row.province,
      regencyOrCity: row.regency_or_city,
      district: row.district,
      villageOrSubdistrict: row.village_or_subdistrict,
      addressDetail: row.address_detail,
      ktpDocumentId: row.ktp_document_id,
      ktpDocument: ktpDoc,
      dataAccuracyAcceptedAt: row.data_accuracy_accepted_at.toISOString(),
      merchantTermsAcceptedAt: row.merchant_terms_accepted_at.toISOString(),
      merchantTermsVersion: row.merchant_terms_version,
      privacyConsentAcceptedAt: row.privacy_consent_accepted_at.toISOString(),
      privacyNoticeVersion: row.privacy_notice_version,
      submittedAt: row.submitted_at.toISOString(),
      rejectionReason: rejectionReason ?? undefined,
    };
  }

  /**
   * Fetch rejection reason for a given profile/submission from verification audit logs.
   */
  private async getLatestRejectionReason(
    profileId: string,
  ): Promise<string | null> {
    const res = await this.pool.query<{ reason: string | null }>(
      `SELECT reason FROM profile_verification_audit_logs
       WHERE profile_type = 'MERCHANT' AND profile_id = $1 AND action = 'REJECT'
       ORDER BY created_at DESC LIMIT 1;`,
      [profileId],
    );
    return res.rows[0]?.reason ?? null;
  }

  /**
   * Fetch latest audit log for a given profile and action.
   */
  private async getLatestAuditLog(
    profileId: string,
    action: 'REJECT' | 'SUSPEND',
  ): Promise<{ reason: string | null; createdAt: Date } | null> {
    const res = await this.pool.query<{ reason: string | null; created_at: Date }>(
      `SELECT reason, created_at FROM profile_verification_audit_logs
       WHERE profile_type = 'MERCHANT' AND profile_id = $1 AND action = $2
       ORDER BY created_at DESC LIMIT 1;`,
      [profileId, action],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      reason: row.reason,
      createdAt: row.created_at,
    };
  }

  /**
   * 1. GET /api/v1/merchant/onboarding
   * Authoritative gate status for Mitra mobile client.
   */
  async getOnboardingStatus(
    userId: string,
  ): Promise<MerchantOnboardingStatusResponseDto> {
    const accountPhone = await this.getUserPhone(userId);

    // 1. Check merchant_profiles
    const profileRes = await this.pool.query<RawProfileRow>(
      `SELECT id, user_id, business_name, status, current_submission_id, created_at, updated_at
       FROM merchant_profiles WHERE user_id = $1;`,
      [userId],
    );
    const profile = profileRes.rows[0];

    // 2. Check merchant_onboarding_drafts
    const draftRes = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_onboarding_drafts WHERE user_id = $1;`,
      [userId],
    );
    const draftRow = draftRes.rows[0];
    const draftDto = draftRow ? await this.mapDraftToDto(draftRow, accountPhone) : null;

    // Case A: Profile exists (PENDING, REJECTED, APPROVED, SUSPENDED)
    if (profile) {
      let currentSubmissionDto: MerchantOnboardingSubmissionDto | null = null;
      let rejectionReason: string | null = null;
      let rejectionDate: string | null = null;
      let suspensionReason: string | null = null;
      let suspensionDate: string | null = null;

      if (profile.status === 'REJECTED') {
        const rejectLog = await this.getLatestAuditLog(profile.id, 'REJECT');
        rejectionReason = rejectLog?.reason ?? null;
        rejectionDate = rejectLog?.createdAt ? rejectLog.createdAt.toISOString() : null;
      } else if (profile.status === 'SUSPENDED') {
        const suspendLog = await this.getLatestAuditLog(profile.id, 'SUSPEND');
        suspensionReason = suspendLog?.reason ?? null;
        suspensionDate = suspendLog?.createdAt ? suspendLog.createdAt.toISOString() : null;
      }

      if (profile.current_submission_id) {
        const subRes = await this.pool.query<RawSubmissionRow>(
          `SELECT * FROM merchant_onboarding_submissions WHERE id = $1;`,
          [profile.current_submission_id],
        );
        const subRow = subRes.rows[0];
        if (subRow) {
          if (profile.status === 'REJECTED' || subRow.status === 'REJECTED') {
            rejectionReason = await this.getLatestRejectionReason(profile.id);
          }
          currentSubmissionDto = await this.mapSubmissionToDto(subRow, rejectionReason);
        }
      }

      const gateState: MerchantOnboardingGateState =
        profile.status === 'REJECTED' && draftDto ? 'DRAFT' : (profile.status as MerchantOnboardingGateState);

      return {
        state: gateState,
        merchantProfileId: profile.id,
        accountPhone,
        draft: draftDto, // Non-null if repair draft was created for REJECTED profile
        currentSubmission: currentSubmissionDto,
        rejectionReason,
        rejectionDate,
        suspensionReason,
        suspensionDate,
      };
    }

    // Case B: No profile exists yet
    if (draftDto) {
      return {
        state: 'DRAFT',
        merchantProfileId: null,
        accountPhone,
        draft: draftDto,
        currentSubmission: null,
        rejectionReason: null,
        rejectionDate: null,
        suspensionReason: null,
        suspensionDate: null,
      };
    }

    return {
      state: 'NOT_STARTED',
      merchantProfileId: null,
      accountPhone,
      draft: null,
      currentSubmission: null,
      rejectionReason: null,
      rejectionDate: null,
      suspensionReason: null,
      suspensionDate: null,
    };
  }

  /**
   * 2. POST /api/v1/merchant/onboarding/draft
   * Create or return single active draft. Must not create merchant_profile.
   */
  async getOrCreateDraft(userId: string): Promise<MerchantOnboardingDraftDto> {
    const accountPhone = await this.getUserPhone(userId);

    // Block if already approved, pending, or suspended
    const profileRes = await this.pool.query<RawProfileRow>(
      `SELECT status FROM merchant_profiles WHERE user_id = $1;`,
      [userId],
    );
    const profile = profileRes.rows[0];
    if (profile) {
      if (profile.status === 'PENDING') {
        throw new ConflictError('Pengajuan merchant sedang ditinjau');
      }
      if (profile.status === 'APPROVED') {
        throw new ConflictError('Merchant telah disetujui');
      }
      if (profile.status === 'SUSPENDED') {
        throw new ConflictError('Akun merchant ditangguhkan');
      }
      if (profile.status === 'REJECTED') {
        // Must use repair endpoint to initialize draft from rejected submission
        // Return active draft if repair was already initiated
        const existingDraft = await this.pool.query<RawDraftRow>(
          `SELECT * FROM merchant_onboarding_drafts WHERE user_id = $1;`,
          [userId],
        );
        if (existingDraft.rows[0]) {
          return this.mapDraftToDto(existingDraft.rows[0], accountPhone);
        }
        throw new ConflictError(
          'Pengajuan pendaftaran ditolak. Gunakan perbaikan pendaftaran untuk membuat draft perbaikan.',
        );
      }
    }

    // Query existing draft
    const existing = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_onboarding_drafts WHERE user_id = $1;`,
      [userId],
    );
    if (existing.rows[0]) {
      return this.mapDraftToDto(existing.rows[0], accountPhone);
    }

    // Insert fresh draft
    const draftId = generateUuidV7();
    const now = new Date();
    await this.pool.query(
      `INSERT INTO merchant_onboarding_drafts
       (id, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO NOTHING;`,
      [draftId, userId, now, now],
    );

    const inserted = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_onboarding_drafts WHERE user_id = $1;`,
      [userId],
    );
    return this.mapDraftToDto(inserted.rows[0]!, accountPhone);
  }

  /**
   * 3. PATCH /api/v1/merchant/onboarding/draft
   * Autosave draft fields.
   */
  async saveDraft(
    userId: string,
    dto: SaveMerchantOnboardingDraftDto,
  ): Promise<MerchantOnboardingDraftDto> {
    const accountPhone = await this.getUserPhone(userId);

    // Verify profile state
    const profileRes = await this.pool.query<RawProfileRow>(
      `SELECT status FROM merchant_profiles WHERE user_id = $1;`,
      [userId],
    );
    const profile = profileRes.rows[0];
    if (profile && profile.status !== 'REJECTED') {
      throw new ConflictError(
        `Tidak dapat mengubah draft pendaftaran saat profil dalam status ${profile.status}`,
      );
    }

    const draftRes = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_onboarding_drafts WHERE user_id = $1;`,
      [userId],
    );
    const draft = draftRes.rows[0];
    if (!draft) {
      throw new NotFoundError('Draft pendaftaran tidak ditemukan. Mulai pendaftaran terlebih dahulu.');
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    const fieldMap: Array<[keyof SaveMerchantOnboardingDraftDto, string]> = [
      ['fullName', 'full_name'],
      ['nik', 'nik'],
      ['email', 'email'],
      ['alternateContact', 'alternate_contact'],
      ['proposedBusinessName', 'proposed_business_name'],
      ['businessCategory', 'business_category'],
      ['businessDescription', 'business_description'],
      ['province', 'province'],
      ['regencyOrCity', 'regency_or_city'],
      ['district', 'district'],
      ['villageOrSubdistrict', 'village_or_subdistrict'],
      ['addressDetail', 'address_detail'],
    ];

    for (const [dtoKey, colName] of fieldMap) {
      if (dto[dtoKey] !== undefined) {
        params.push(dto[dtoKey] ?? null);
        updates.push(`${colName} = $${params.length}`);
      }
    }

    if (updates.length > 0) {
      params.push(new Date());
      updates.push(`updated_at = $${params.length}`);
      params.push(userId);
      await this.pool.query(
        `UPDATE merchant_onboarding_drafts SET ${updates.join(', ')} WHERE user_id = $${params.length};`,
        params,
      );
    }

    const updated = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_onboarding_drafts WHERE user_id = $1;`,
      [userId],
    );
    return this.mapDraftToDto(updated.rows[0]!, accountPhone);
  }

  /**
   * 4. POST /api/v1/merchant/onboarding/draft/ktp
   * Private KTP upload with magic byte sniffing and opaque UUID storage key.
   * Decoupled: file upload occurs strictly OUTSIDE database transaction.
   */
  async uploadDraftKtp(
    userId: string,
    fileBuffer: Buffer,
    originalFilename: string,
  ): Promise<MerchantOnboardingDocumentDto> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestError('File KTP tidak boleh kosong');
    }

    // Size limit: 5 MB
    const maxBytes = 5 * 1024 * 1024;
    if (fileBuffer.length > maxBytes) {
      throw new BadRequestError('Ukuran file KTP tidak boleh melebihi 5 MB');
    }

    // Content signature (magic bytes) validation
    const detectedMime = detectAllowedKtpMime(fileBuffer);
    if (!detectedMime) {
      throw new BadRequestError(
        'Format file KTP tidak valid. Hanya file gambar JPEG atau PNG yang diperbolehkan.',
      );
    }

    // Ensure draft exists
    const draftRes = await this.pool.query<RawDraftRow>(
      `SELECT id, ktp_document_id FROM merchant_onboarding_drafts WHERE user_id = $1;`,
      [userId],
    );
    if (!draftRes.rows[0]) {
      throw new NotFoundError('Draft pendaftaran tidak ditemukan. Mulai pendaftaran terlebih dahulu.');
    }
    const previousKtpDocId = draftRes.rows[0].ktp_document_id;

    // Opaque random key: merchant-onboarding/{randomUUID}/{randomUUID}
    const documentId = generateUuidV7();
    const secretBucket = generateUuidV7();
    const ext = detectedMime === 'image/jpeg' ? 'jpg' : 'png';
    const storageKey = `merchant-onboarding/${secretBucket}/${documentId}.${ext}`;

    // 1. Upload to private storage (outside DB transaction)
    await this.storage.put(storageKey, fileBuffer, detectedMime);

    // 2. Persist document metadata in DB
    const sanitizedFilename = originalFilename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 255);
    const now = new Date();

    await this.pool.query(
      `INSERT INTO merchant_onboarding_documents
       (id, owner_user_id, document_type, storage_key, sanitized_original_filename, mime_type, size_bytes, created_at)
       VALUES ($1, $2, 'KTP_FRONT', $3, $4, $5, $6, $7);`,
      [documentId, userId, storageKey, sanitizedFilename, detectedMime, fileBuffer.length, now],
    );

    // 3. Link to draft
    await this.pool.query(
      `UPDATE merchant_onboarding_drafts SET ktp_document_id = $1, updated_at = $2 WHERE user_id = $3;`,
      [documentId, now, userId],
    );

    // 4. Safely clean up previous draft KTP if not referenced in any submitted snapshot
    if (previousKtpDocId && previousKtpDocId !== documentId) {
      try {
        const subCheck = await this.pool.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM merchant_onboarding_submissions WHERE ktp_document_id = $1;`,
          [previousKtpDocId],
        );
        const isReferencedInSubmission = parseInt(subCheck.rows[0]?.count ?? '0', 10) > 0;
        if (!isReferencedInSubmission) {
          const oldDocRes = await this.pool.query<RawDocumentRow>(
            `SELECT id, storage_key FROM merchant_onboarding_documents WHERE id = $1;`,
            [previousKtpDocId],
          );
          const oldDoc = oldDocRes.rows[0];
          if (oldDoc) {
            await this.pool.query(
              `DELETE FROM merchant_onboarding_documents WHERE id = $1;`,
              [oldDoc.id],
            );
            await this.storage.delete(oldDoc.storage_key);
          }
        }
      } catch {
        // Non-blocking best-effort cleanup
      }
    }

    return {
      id: documentId,
      documentType: 'KTP_FRONT',
      sanitizedOriginalFilename: sanitizedFilename,
      mimeType: detectedMime,
      sizeBytes: fileBuffer.length,
      createdAt: now.toISOString(),
    };
  }

  /**
   * 5. GET /api/v1/merchant/onboarding/documents/:documentId/content
   * Private streaming access for authenticated owner.
   */
  async getDocumentContentForOwner(
    userId: string,
    documentId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; sizeBytes: number }> {
    const res = await this.pool.query<RawDocumentRow>(
      `SELECT * FROM merchant_onboarding_documents WHERE id = $1;`,
      [documentId],
    );
    const doc = res.rows[0];
    if (!doc) {
      throw new NotFoundError('Dokumen tidak ditemukan');
    }
    if (doc.owner_user_id !== userId) {
      throw new ForbiddenError('Anda tidak memiliki akses ke dokumen ini');
    }

    const stored = await this.storage.get(doc.storage_key);
    if (!stored) {
      throw new NotFoundError('File dokumen tidak ditemukan pada penyimpanan');
    }

    return {
      stream: stored.stream,
      mimeType: doc.mime_type,
      sizeBytes: doc.size_bytes,
    };
  }

  /**
   * 6. POST /api/v1/merchant/onboarding/submit
   * Idempotent submission: atomically creates/updates profile and frozen immutable snapshot.
   */
  async submitOnboarding(
    userId: string,
    dto: SubmitMerchantOnboardingDto,
  ): Promise<MerchantOnboardingStatusResponseDto> {
    if (!dto.dataAccuracyAccepted || !dto.merchantTermsAccepted || !dto.privacyConsentAccepted) {
      throw new BadRequestError(
        'Semua persetujuan (kebenaran data, ketentuan merchant, dan privasi) wajib disetujui.',
      );
    }

    await this.transactionService.runInTransaction(async (tx) => {
      // 1. Lock draft row
      const draftRes = await tx.execute<RawDraftRow>(
        sql`SELECT * FROM merchant_onboarding_drafts WHERE user_id = ${userId} FOR UPDATE;`,
      );
      const draft = draftRes.rows[0];
      if (!draft) {
        throw new BadRequestError('Draft pendaftaran tidak ditemukan atau sudah dikirim');
      }

      // 2. Validate mandatory fields
      if (!draft.full_name || draft.full_name.trim().length < 2) {
        throw new BadRequestError('Nama lengkap pemilik wajib diisi (minimal 2 karakter)');
      }
      if (!draft.nik || !/^\d{16}$/.test(draft.nik)) {
        throw new BadRequestError('NIK wajib 16 digit angka');
      }
      if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
        throw new BadRequestError('Format email tidak valid');
      }
      if (!draft.proposed_business_name || draft.proposed_business_name.trim().length < 2) {
        throw new BadRequestError('Nama calon usaha wajib diisi (minimal 2 karakter)');
      }
      if (!draft.business_category || draft.business_category.trim().length < 2) {
        throw new BadRequestError('Kategori usaha wajib dipilih');
      }
      if (
        !draft.province ||
        !draft.regency_or_city ||
        !draft.district ||
        !draft.village_or_subdistrict ||
        !draft.address_detail ||
        draft.address_detail.trim().length < 5
      ) {
        throw new BadRequestError('Alamat korespondensi usaha wajib diisi dengan lengkap');
      }
      if (!draft.ktp_document_id) {
        throw new BadRequestError('Foto KTP wajib diunggah sebelum mengirimkan pendaftaran');
      }

      // 3. Confirm document ownership & existence
      const docRes = await tx.execute<RawDocumentRow>(
        sql`SELECT id, owner_user_id, storage_key FROM merchant_onboarding_documents WHERE id = ${draft.ktp_document_id};`,
      );
      const doc = docRes.rows[0];
      if (!doc || doc.owner_user_id !== userId) {
        throw new BadRequestError('Dokumen KTP tidak valid atau bukan milik pengguna yang bersangkutan');
      }

      const fileExists = await this.storage.exists(doc.storage_key);
      if (!fileExists) {
        throw new BadRequestError('Berkas fisik dokumen KTP tidak ditemukan pada sistem penyimpanan');
      }

      // 4. Fetch authoritative account phone snapshot
      const userRes = await tx.execute<{ phone: string }>(
        sql`SELECT phone FROM users WHERE id = ${userId};`,
      );
      const accountPhone = userRes.rows[0]!.phone;

      // 5. Lock profile if exists
      const profileRes = await tx.execute<RawProfileRow>(
        sql`SELECT id, status, current_submission_id FROM merchant_profiles WHERE user_id = ${userId} FOR UPDATE;`,
      );
      const profile = profileRes.rows[0];
      const now = new Date();

      if (!profile) {
        // -------------------------------------------------------------
        // FIRST SUBMISSION: Create Merchant Profile + Submission #1
        // -------------------------------------------------------------
        const profileId = generateUuidV7();
        const submissionId = generateUuidV7();

        // Insert profile (PENDING) with NULL current_submission_id first to satisfy FK
        await tx.execute(
          sql`INSERT INTO merchant_profiles
              (id, user_id, business_name, status, current_submission_id, created_at, updated_at)
              VALUES (${profileId}, ${userId}, ${draft.proposed_business_name}, 'PENDING', NULL, ${now}, ${now});`,
        );

        // Insert Submission #1 (PENDING)
        await tx.execute(
          sql`INSERT INTO merchant_onboarding_submissions
              (id, merchant_profile_id, submitted_by_user_id, revision_number, supersedes_submission_id, status,
               full_name, nik, account_phone_snapshot, email, alternate_contact, proposed_business_name,
               business_category, business_description, province, regency_or_city, district,
               village_or_subdistrict, address_detail, ktp_document_id, data_accuracy_accepted_at,
               merchant_terms_accepted_at, merchant_terms_version, privacy_consent_accepted_at,
               privacy_notice_version, submitted_at, created_at)
              VALUES
              (${submissionId}, ${profileId}, ${userId}, 1, NULL, 'PENDING',
               ${draft.full_name}, ${draft.nik}, ${accountPhone}, ${draft.email}, ${draft.alternate_contact},
               ${draft.proposed_business_name}, ${draft.business_category}, ${draft.business_description},
               ${draft.province}, ${draft.regency_or_city}, ${draft.district}, ${draft.village_or_subdistrict},
               ${draft.address_detail}, ${draft.ktp_document_id}, ${now}, ${now}, ${MERCHANT_TERMS_VERSION},
               ${now}, ${PRIVACY_NOTICE_VERSION}, ${now}, ${now});`,
        );

        // Link submission #1 as current_submission_id on profile
        await tx.execute(
          sql`UPDATE merchant_profiles
              SET current_submission_id = ${submissionId}
              WHERE id = ${profileId};`,
        );

        // Delete active draft
        await tx.execute(
          sql`DELETE FROM merchant_onboarding_drafts WHERE id = ${draft.id};`,
        );
      } else {
        // -------------------------------------------------------------
        // RESUBMISSION: Only allowed when current profile status is REJECTED
        // -------------------------------------------------------------
        if (profile.status !== 'REJECTED') {
          throw new ConflictError(
            `Tidak dapat mengirimkan ulang pendaftaran saat profil dalam status '${profile.status}'`,
          );
        }

        // Lock latest submission to safely derive revision number
        const latestSubRes = await tx.execute<{ id: string; revision_number: number }>(
          sql`SELECT id, revision_number FROM merchant_onboarding_submissions
              WHERE merchant_profile_id = ${profile.id}
              ORDER BY revision_number DESC LIMIT 1 FOR UPDATE;`,
        );
        const latestSub = latestSubRes.rows[0];
        const nextRevision = (latestSub?.revision_number ?? 1) + 1;
        const newSubmissionId = generateUuidV7();

        // Insert new Submission N
        await tx.execute(
          sql`INSERT INTO merchant_onboarding_submissions
              (id, merchant_profile_id, submitted_by_user_id, revision_number, supersedes_submission_id, status,
               full_name, nik, account_phone_snapshot, email, alternate_contact, proposed_business_name,
               business_category, business_description, province, regency_or_city, district,
               village_or_subdistrict, address_detail, ktp_document_id, data_accuracy_accepted_at,
               merchant_terms_accepted_at, merchant_terms_version, privacy_consent_accepted_at,
               privacy_notice_version, submitted_at, created_at)
              VALUES
              (${newSubmissionId}, ${profile.id}, ${userId}, ${nextRevision}, ${profile.current_submission_id}, 'PENDING',
               ${draft.full_name}, ${draft.nik}, ${accountPhone}, ${draft.email}, ${draft.alternate_contact},
               ${draft.proposed_business_name}, ${draft.business_category}, ${draft.business_description},
               ${draft.province}, ${draft.regency_or_city}, ${draft.district}, ${draft.village_or_subdistrict},
               ${draft.address_detail}, ${draft.ktp_document_id}, ${now}, ${now}, ${MERCHANT_TERMS_VERSION},
               ${now}, ${PRIVACY_NOTICE_VERSION}, ${now}, ${now});`,
        );

        // Update profile status REJECTED -> PENDING
        await tx.execute(
          sql`UPDATE merchant_profiles
              SET status = 'PENDING', current_submission_id = ${newSubmissionId},
                  business_name = ${draft.proposed_business_name}, updated_at = ${now}
              WHERE id = ${profile.id};`,
        );

        // Delete active draft
        await tx.execute(
          sql`DELETE FROM merchant_onboarding_drafts WHERE id = ${draft.id};`,
        );
      }
    });

    return this.getOnboardingStatus(userId);
  }

  /**
   * 7. POST /api/v1/merchant/onboarding/repair
   * Clones rejected submission into a new revision draft. Profile stays REJECTED.
   */
  async repairRejected(userId: string): Promise<MerchantOnboardingDraftDto> {
    const accountPhone = await this.getUserPhone(userId);

    // Verify profile is REJECTED
    const profileRes = await this.pool.query<RawProfileRow>(
      `SELECT id, status, current_submission_id FROM merchant_profiles WHERE user_id = $1;`,
      [userId],
    );
    const profile = profileRes.rows[0];
    if (!profile || profile.status !== 'REJECTED') {
      throw new ConflictError(
        'Perbaikan pengajuan hanya dapat dilakukan saat status pengajuan ditolak (REJECTED)',
      );
    }

    // Idempotent: return existing draft if already created
    const existingDraft = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_onboarding_drafts WHERE user_id = $1;`,
      [userId],
    );
    if (existingDraft.rows[0]) {
      return this.mapDraftToDto(existingDraft.rows[0], accountPhone);
    }

    // Fetch submission to clone
    const subRes = await this.pool.query<RawSubmissionRow>(
      `SELECT * FROM merchant_onboarding_submissions WHERE id = $1;`,
      [profile.current_submission_id],
    );
    const sub = subRes.rows[0];
    if (!sub) {
      throw new NotFoundError('Data pengajuan sebelumnya tidak ditemukan');
    }

    const draftId = generateUuidV7();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO merchant_onboarding_drafts
       (id, user_id, full_name, nik, email, alternate_contact, proposed_business_name,
        business_category, business_description, province, regency_or_city, district,
        village_or_subdistrict, address_detail, ktp_document_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (user_id) DO NOTHING;`,
      [
        draftId,
        userId,
        sub.full_name,
        sub.nik,
        sub.email,
        sub.alternate_contact,
        sub.proposed_business_name,
        sub.business_category,
        sub.business_description,
        sub.province,
        sub.regency_or_city,
        sub.district,
        sub.village_or_subdistrict,
        sub.address_detail,
        sub.ktp_document_id,
        now,
        now,
      ],
    );

    const createdDraft = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_onboarding_drafts WHERE user_id = $1;`,
      [userId],
    );
    return this.mapDraftToDto(createdDraft.rows[0]!, accountPhone);
  }
}
