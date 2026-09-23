import { Injectable, Inject } from '@nestjs/common';
import type pg from 'pg';
import { sql } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/utils';
import {
  type ProfileVerificationStatus,
  type ProfileVerificationAction,
  type ProfileType,
} from '@platform/shared-types';
import { PG_POOL_TOKEN } from '../database/database.tokens.js';
import { TransactionService } from '../database/transaction/transaction.service.js';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../common/errors/app-error.js';
import type { VerificationQueryDto } from './dto/verification-query.dto.js';
import type {
  MerchantVerificationItemDto,
  MerchantVerificationListResponseDto,
  MerchantVerificationDetailResponseDto,
} from './dto/merchant-verification.dto.js';
import type {
  DriverVerificationItemDto,
  DriverVerificationListResponseDto,
  DriverVerificationDetailResponseDto,
} from './dto/driver-verification.dto.js';
import type { VerificationAuditLogItemDto } from './dto/verification-audit.dto.js';
import {
  PRIVATE_DOCUMENT_STORAGE,
  type PrivateDocumentStorage,
} from '../storage/storage.interface.js';
import { maskNik } from '../merchant-onboarding/nik-utils.js';
import type { MerchantOnboardingSubmissionDto } from '../merchant-onboarding/dto/merchant-onboarding.dto.js';

interface RawMerchantRow {
  id: string;
  user_id: string;
  business_name: string | null;
  status: ProfileVerificationStatus;
  current_submission_id: string | null;
  created_at: Date;
  updated_at: Date;
  phone: string;
}

interface RawDriverRow {
  id: string;
  user_id: string;
  full_name: string | null;
  status: ProfileVerificationStatus;
  created_at: Date;
  updated_at: Date;
  phone: string;
}

interface RawAuditLogRow {
  id: string;
  profile_type: ProfileType;
  profile_id: string;
  actor_admin_id: string;
  actor_admin_username: string | null;
  action: ProfileVerificationAction;
  from_status: ProfileVerificationStatus;
  to_status: ProfileVerificationStatus;
  reason: string | null;
  request_id: string | null;
  created_at: Date;
}

const ALLOWED_TRANSITIONS: Record<ProfileVerificationAction, ProfileVerificationStatus> = {
  APPROVE: 'PENDING',
  REJECT: 'PENDING',
  SUSPEND: 'APPROVED',
  REACTIVATE: 'SUSPENDED',
};

const TARGET_STATUSES: Record<ProfileVerificationAction, ProfileVerificationStatus> = {
  APPROVE: 'APPROVED',
  REJECT: 'REJECTED',
  SUSPEND: 'SUSPENDED',
  REACTIVATE: 'APPROVED',
};

@Injectable()
export class AdminVerificationService {
  constructor(
    @Inject(PG_POOL_TOKEN)
    private readonly pool: pg.Pool,
    private readonly transactionService: TransactionService,
    @Inject(PRIVATE_DOCUMENT_STORAGE)
    private readonly storage: PrivateDocumentStorage,
  ) {}

  /**
   * List Merchant verification items with filtering, search, and pagination.
   */
  async listMerchants(query: VerificationQueryDto): Promise<MerchantVerificationListResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const countParams: unknown[] = [];

    if (query.status) {
      countParams.push(query.status);
      whereClauses.push(`mp.status = $${countParams.length}`);
    }

    if (query.q && query.q.trim()) {
      countParams.push(`%${query.q.trim()}%`);
      whereClauses.push(`(u.phone ILIKE $${countParams.length} OR mp.business_name ILIKE $${countParams.length})`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await this.pool.query<{ total: number }>(
      `SELECT count(*)::int AS total
       FROM merchant_profiles mp
       JOIN users u ON u.id = mp.user_id
       ${whereSql};`,
      countParams,
    );
    const total = Number(countRes.rows[0]?.total ?? 0);

    const selectParams = [...countParams, limit, offset];
    const limitIndex = selectParams.length - 1;
    const offsetIndex = selectParams.length;

    const itemsRes = await this.pool.query<RawMerchantRow>(
      `SELECT
         mp.id,
         mp.user_id,
         mp.business_name,
         mp.status,
         mp.current_submission_id,
         mp.created_at,
         mp.updated_at,
         u.phone
       FROM merchant_profiles mp
       JOIN users u ON u.id = mp.user_id
       ${whereSql}
       ORDER BY mp.created_at DESC, mp.id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex};`,
      selectParams,
    );

    const items: MerchantVerificationItemDto[] = itemsRes.rows.map((row) => ({
      profileId: row.id,
      userId: row.user_id,
      phone: row.phone,
      businessName: row.business_name,
      displayName: row.business_name,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));

    return {
      items,
      page,
      limit,
      total,
    };
  }

  /**
   * Get Merchant profile detail along with full audit log history.
   * Get Merchant profile detail along with full audit log history and current onboarding submission.
   */
  async getMerchantDetail(profileId: string): Promise<MerchantVerificationDetailResponseDto> {
    const res = await this.pool.query<RawMerchantRow>(
      `SELECT
         mp.id,
         mp.user_id,
         mp.business_name,
         mp.status,
         mp.current_submission_id,
         mp.created_at,
         mp.updated_at,
         u.phone
       FROM merchant_profiles mp
       JOIN users u ON u.id = mp.user_id
       WHERE mp.id = $1;`,
      [profileId],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundError(`Merchant profile not found: ${profileId}`);
    }

    let currentSubmission: MerchantOnboardingSubmissionDto | null = null;
    if (row.current_submission_id) {
      const subRes = await this.pool.query<{
        id: string;
        merchant_profile_id: string;
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
        sanitized_original_filename: string | null;
        mime_type: string | null;
        size_bytes: number | null;
        doc_created_at: Date | null;
      }>(
        `SELECT
           s.*,
           d.sanitized_original_filename,
           d.mime_type,
           d.size_bytes,
           d.created_at AS doc_created_at
         FROM merchant_onboarding_submissions s
         LEFT JOIN merchant_onboarding_documents d ON d.id = s.ktp_document_id
         WHERE s.id = $1;`,
        [row.current_submission_id],
      );
      const sub = subRes.rows[0];
      if (sub) {
        currentSubmission = {
          id: sub.id,
          merchantProfileId: sub.merchant_profile_id,
          revisionNumber: sub.revision_number,
          supersedesSubmissionId: sub.supersedes_submission_id,
          status: sub.status,
          fullName: sub.full_name,
          maskedNik: maskNik(sub.nik),
          accountPhoneSnapshot: sub.account_phone_snapshot,
          email: sub.email,
          alternateContact: sub.alternate_contact,
          proposedBusinessName: sub.proposed_business_name,
          businessCategory: sub.business_category,
          businessDescription: sub.business_description,
          province: sub.province,
          regencyOrCity: sub.regency_or_city,
          district: sub.district,
          villageOrSubdistrict: sub.village_or_subdistrict,
          addressDetail: sub.address_detail,
          ktpDocumentId: sub.ktp_document_id,
          ktpDocument: sub.sanitized_original_filename
            ? {
                id: sub.ktp_document_id,
                documentType: 'KTP_FRONT',
                sanitizedOriginalFilename: sub.sanitized_original_filename,
                mimeType: sub.mime_type!,
                sizeBytes: Number(sub.size_bytes!),
                createdAt: new Date(sub.doc_created_at!).toISOString(),
              }
            : null,
          dataAccuracyAcceptedAt: new Date(sub.data_accuracy_accepted_at).toISOString(),
          merchantTermsAcceptedAt: new Date(sub.merchant_terms_accepted_at).toISOString(),
          merchantTermsVersion: sub.merchant_terms_version,
          privacyConsentAcceptedAt: new Date(sub.privacy_consent_accepted_at).toISOString(),
          privacyNoticeVersion: sub.privacy_notice_version,
          submittedAt: new Date(sub.submitted_at).toISOString(),
        };
      }
    }

    const auditLogs = await this.getAuditLogs('MERCHANT', profileId);

    return {
      profileId: row.id,
      userId: row.user_id,
      phone: row.phone,
      businessName: row.business_name,
      displayName: row.business_name,
      status: row.status,
      currentSubmissionId: row.current_submission_id,
      currentSubmission,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      auditLogs,
    };
  }

  /**
   * List Driver verification items with filtering, search, and pagination.
   */
  async listDrivers(query: VerificationQueryDto): Promise<DriverVerificationListResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const countParams: unknown[] = [];

    if (query.status) {
      countParams.push(query.status);
      whereClauses.push(`dp.status = $${countParams.length}`);
    }

    if (query.q && query.q.trim()) {
      countParams.push(`%${query.q.trim()}%`);
      whereClauses.push(`(u.phone ILIKE $${countParams.length} OR dp.full_name ILIKE $${countParams.length})`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await this.pool.query<{ total: number }>(
      `SELECT count(*)::int AS total
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       ${whereSql};`,
      countParams,
    );
    const total = Number(countRes.rows[0]?.total ?? 0);

    const selectParams = [...countParams, limit, offset];
    const limitIndex = selectParams.length - 1;
    const offsetIndex = selectParams.length;

    const itemsRes = await this.pool.query<RawDriverRow>(
      `SELECT
         dp.id,
         dp.user_id,
         dp.full_name,
         dp.status,
         dp.created_at,
         dp.updated_at,
         u.phone
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       ${whereSql}
       ORDER BY dp.created_at DESC, dp.id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex};`,
      selectParams,
    );

    const items: DriverVerificationItemDto[] = itemsRes.rows.map((row) => ({
      profileId: row.id,
      userId: row.user_id,
      phone: row.phone,
      fullName: row.full_name,
      displayName: row.full_name,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));

    return {
      items,
      page,
      limit,
      total,
    };
  }

  /**
   * Get Driver profile detail along with full audit log history.
   */
  async getDriverDetail(profileId: string): Promise<DriverVerificationDetailResponseDto> {
    const res = await this.pool.query<RawDriverRow>(
      `SELECT
         dp.id,
         dp.user_id,
         dp.full_name,
         dp.status,
         dp.created_at,
         dp.updated_at,
         u.phone
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       WHERE dp.id = $1;`,
      [profileId],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundError(`Driver profile not found: ${profileId}`);
    }

    const auditLogs = await this.getAuditLogs('DRIVER', profileId);

    return {
      profileId: row.id,
      userId: row.user_id,
      phone: row.phone,
      fullName: row.full_name,
      displayName: row.full_name,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      auditLogs,
    };
  }

  /**
   * Reveal full unmasked NIK for manual verification (authorized Admin only).
   */
  async revealMerchantNik(profileId: string): Promise<{ nik: string }> {
    const res = await this.pool.query<{ nik: string }>(
      `SELECT s.nik
       FROM merchant_profiles mp
       JOIN merchant_onboarding_submissions s ON s.id = mp.current_submission_id
       WHERE mp.id = $1;`,
      [profileId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundError(`Submission or profile not found for profile: ${profileId}`);
    }
    return { nik: row.nik };
  }

  /**
   * Stream authorized KTP image content for administrative manual verification.
   */
  async streamMerchantKtp(
    profileId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; sizeBytes: number }> {
    const res = await this.pool.query<{
      storage_key: string;
      mime_type: string;
      size_bytes: number;
    }>(
      `SELECT d.storage_key, d.mime_type, d.size_bytes
       FROM merchant_profiles mp
       JOIN merchant_onboarding_submissions s ON s.id = mp.current_submission_id
       JOIN merchant_onboarding_documents d ON d.id = s.ktp_document_id
       WHERE mp.id = $1;`,
      [profileId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundError(`KTP document not found for merchant profile: ${profileId}`);
    }
    const stored = await this.storage.get(row.storage_key);
    if (!stored) {
      throw new NotFoundError('KTP file content not found in storage');
    }
    return {
      stream: stored.stream,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
    };
  }

  /**
   * Merchant Status Actions
   */
  async approveMerchant(
    profileId: string,
    actorAdminId: string,
    reason?: string,
    requestId?: string,
    expectedSubmissionId?: string,
  ): Promise<MerchantVerificationDetailResponseDto> {
    return this.transitionMerchant(
      profileId,
      'APPROVE',
      actorAdminId,
      reason,
      requestId,
      expectedSubmissionId,
    );
  }

  async rejectMerchant(
    profileId: string,
    actorAdminId: string,
    reason: string,
    requestId?: string,
    expectedSubmissionId?: string,
  ): Promise<MerchantVerificationDetailResponseDto> {
    return this.transitionMerchant(
      profileId,
      'REJECT',
      actorAdminId,
      reason,
      requestId,
      expectedSubmissionId,
    );
  }

  async suspendMerchant(
    profileId: string,
    actorAdminId: string,
    reason: string,
    requestId?: string,
  ): Promise<MerchantVerificationDetailResponseDto> {
    return this.transitionMerchant(profileId, 'SUSPEND', actorAdminId, reason, requestId);
  }

  async reactivateMerchant(
    profileId: string,
    actorAdminId: string,
    reason: string,
    requestId?: string,
  ): Promise<MerchantVerificationDetailResponseDto> {
    return this.transitionMerchant(profileId, 'REACTIVATE', actorAdminId, reason, requestId);
  }

  /**
   * Driver Status Actions
   */
  async approveDriver(
    profileId: string,
    actorAdminId: string,
    reason?: string,
    requestId?: string,
  ): Promise<DriverVerificationDetailResponseDto> {
    return this.transitionDriver(profileId, 'APPROVE', actorAdminId, reason, requestId);
  }

  async rejectDriver(
    profileId: string,
    actorAdminId: string,
    reason: string,
    requestId?: string,
  ): Promise<DriverVerificationDetailResponseDto> {
    return this.transitionDriver(profileId, 'REJECT', actorAdminId, reason, requestId);
  }

  async suspendDriver(
    profileId: string,
    actorAdminId: string,
    reason: string,
    requestId?: string,
  ): Promise<DriverVerificationDetailResponseDto> {
    return this.transitionDriver(profileId, 'SUSPEND', actorAdminId, reason, requestId);
  }

  async reactivateDriver(
    profileId: string,
    actorAdminId: string,
    reason: string,
    requestId?: string,
  ): Promise<DriverVerificationDetailResponseDto> {
    return this.transitionDriver(profileId, 'REACTIVATE', actorAdminId, reason, requestId);
  }

  /**
   * Shared atomic transition logic for Merchant profiles.
   */
  private async transitionMerchant(
    profileId: string,
    action: ProfileVerificationAction,
    actorAdminId: string,
    rawReason?: string,
    requestId?: string,
    expectedSubmissionId?: string,
  ): Promise<MerchantVerificationDetailResponseDto> {
    const validatedReason = this.validateActionReason(action, rawReason);

    await this.transactionService.runInTransaction(async (tx) => {
      // 1. Row-level lock target profile
      const selectResult = await tx.execute<{
        id: string;
        status: ProfileVerificationStatus;
        current_submission_id: string | null;
      }>(
        sql`SELECT id, status, current_submission_id FROM merchant_profiles WHERE id = ${profileId} FOR UPDATE;`,
      );

      const profile = selectResult.rows[0];
      if (!profile) {
        throw new NotFoundError(`Merchant profile not found: ${profileId}`);
      }

      // 2. Validate requested transition against canonical matrix
      const expectedStatus = ALLOWED_TRANSITIONS[action];
      if (profile.status !== expectedStatus) {
        throw new ConflictError(
          `Invalid transition: cannot ${action} merchant profile in status '${profile.status}' (expected '${expectedStatus}')`,
        );
      }

      const nextStatus = TARGET_STATUSES[action];
      const now = new Date();
      const auditId = generateUuidV7();

      // 3. Stale-review protection & atomic submission mutation on APPROVE and REJECT
      if (action === 'APPROVE' || action === 'REJECT') {
        if (expectedSubmissionId) {
          if (expectedSubmissionId !== profile.current_submission_id) {
            throw new ConflictError(
              'Pengajuan telah berubah. Muat ulang data terbaru sebelum melakukan verifikasi.',
            );
          }
        }

        if (profile.current_submission_id) {
          // Lock current submission
          const subResult = await tx.execute<{ id: string; status: string }>(
            sql`SELECT id, status FROM merchant_onboarding_submissions WHERE id = ${profile.current_submission_id} FOR UPDATE;`,
          );
          const submission = subResult.rows[0];
          if (!submission || submission.status !== 'PENDING') {
            throw new ConflictError(
              `Pengajuan merchant tidak dalam status PENDING (status saat ini: '${submission?.status}')`,
            );
          }

          // Atomically update submission status (PENDING -> APPROVED or PENDING -> REJECTED)
          await tx.execute(
            sql`UPDATE merchant_onboarding_submissions
                SET status = ${nextStatus}
                WHERE id = ${profile.current_submission_id};`,
          );
        }
      }

      // 4. Atomically update profile status
      await tx.execute(
        sql`UPDATE merchant_profiles
            SET status = ${nextStatus}, updated_at = ${now}
            WHERE id = ${profileId};`,
      );

      // 5. Atomically insert audit log
      await tx.execute(
        sql`INSERT INTO profile_verification_audit_logs
            (id, profile_type, profile_id, actor_admin_id, action, from_status, to_status, reason, request_id, submission_id, created_at)
            VALUES
            (${auditId}, 'MERCHANT', ${profileId}, ${actorAdminId}, ${action}, ${profile.status}, ${nextStatus}, ${validatedReason}, ${requestId ?? null}, ${profile.current_submission_id ?? null}, ${now});`,
      );
    });

    return this.getMerchantDetail(profileId);
  }

  /**
   * Shared atomic transition logic for Driver profiles.
   */
  private async transitionDriver(
    profileId: string,
    action: ProfileVerificationAction,
    actorAdminId: string,
    rawReason?: string,
    requestId?: string,
  ): Promise<DriverVerificationDetailResponseDto> {
    const validatedReason = this.validateActionReason(action, rawReason);

    await this.transactionService.runInTransaction(async (tx) => {
      // 1. Row-level lock target profile
      const selectResult = await tx.execute<{
        id: string;
        status: ProfileVerificationStatus;
      }>(
        sql`SELECT id, status FROM driver_profiles WHERE id = ${profileId} FOR UPDATE;`,
      );

      const profile = selectResult.rows[0];
      if (!profile) {
        throw new NotFoundError(`Driver profile not found: ${profileId}`);
      }

      // 2. Validate requested transition against canonical matrix
      const expectedStatus = ALLOWED_TRANSITIONS[action];
      if (profile.status !== expectedStatus) {
        throw new ConflictError(
          `Invalid transition: cannot ${action} driver profile in status '${profile.status}' (expected '${expectedStatus}')`,
        );
      }

      const nextStatus = TARGET_STATUSES[action];
      const now = new Date();
      const auditId = generateUuidV7();

      // 3. Atomically update status
      await tx.execute(
        sql`UPDATE driver_profiles
            SET status = ${nextStatus}, updated_at = ${now}
            WHERE id = ${profileId};`,
      );

      // 4. Atomically insert audit log
      await tx.execute(
        sql`INSERT INTO profile_verification_audit_logs
            (id, profile_type, profile_id, actor_admin_id, action, from_status, to_status, reason, request_id, created_at)
            VALUES
            (${auditId}, 'DRIVER', ${profileId}, ${actorAdminId}, ${action}, ${profile.status}, ${nextStatus}, ${validatedReason}, ${requestId ?? null}, ${now});`,
      );
    });

    return this.getDriverDetail(profileId);
  }

  /**
   * Validates reason rules strictly according to Phase 2A2 specification:
   * - APPROVE: optional, max 1000 characters
   * - REJECT, SUSPEND, REACTIVATE: required, trimmed, min 3 chars, max 1000 chars.
   */
  private validateActionReason(action: ProfileVerificationAction, rawReason?: string): string | null {
    const trimmed = typeof rawReason === 'string' ? rawReason.trim() : '';

    if (action === 'APPROVE') {
      if (!trimmed) {
        return null;
      }
      if (trimmed.length > 1000) {
        throw new BadRequestError('Approval reason must not exceed 1000 characters');
      }
      return trimmed;
    }

    if (!trimmed) {
      throw new BadRequestError(`Reason is required for ${action}`);
    }

    if (trimmed.length < 3) {
      throw new BadRequestError(`Reason for ${action} must be at least 3 characters long`);
    }

    if (trimmed.length > 1000) {
      throw new BadRequestError(`Reason for ${action} must not exceed 1000 characters`);
    }

    return trimmed;
  }

  /**
   * Retrieve append-only audit trail for a profile.
   */
  private async getAuditLogs(profileType: ProfileType, profileId: string): Promise<VerificationAuditLogItemDto[]> {
    const res = await this.pool.query<RawAuditLogRow>(
      `SELECT
         a.id,
         a.profile_type,
         a.profile_id,
         a.actor_admin_id,
         adm.username AS actor_admin_username,
         a.action,
         a.from_status,
         a.to_status,
         a.reason,
         a.request_id,
         a.created_at
       FROM profile_verification_audit_logs a
       LEFT JOIN admin_accounts adm ON adm.id = a.actor_admin_id
       WHERE a.profile_type = $1 AND a.profile_id = $2
       ORDER BY a.created_at DESC, a.id DESC;`,
      [profileType, profileId],
    );

    return res.rows.map((row) => ({
      id: row.id,
      profileType: row.profile_type,
      profileId: row.profile_id,
      actorAdminId: row.actor_admin_id,
      actorAdminUsername: row.actor_admin_username ?? undefined,
      action: row.action,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      reason: row.reason,
      requestId: row.request_id,
      createdAt: row.created_at.toISOString(),
    }));
  }
}
