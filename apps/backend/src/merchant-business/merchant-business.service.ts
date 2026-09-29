import { Injectable, Inject } from '@nestjs/common';
import type pg from 'pg';
import { sql } from 'drizzle-orm';
import { generateUuidV7 } from '@platform/utils';
import {
  type BusinessSetupState,
  type OperatingHourItem,
  isValidMerchantBusinessCategory,
} from '@platform/shared-types';
import { PG_POOL_TOKEN } from '../database/database.tokens.js';
import { TransactionService } from '../database/transaction/transaction.service.js';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from '../common/errors/app-error.js';
import type {
  BusinessSetupStatusResponseDto,
  BusinessSetupDraftDto,
  SaveBusinessSetupDraftDto,
  CompleteBusinessSetupDto,
  BusinessSetupCompletionResponseDto,
  BusinessDto,
  OutletDto,
  OutletOperatingHoursDto,
  UpdateBusinessDto,
  UpdatePrimaryOutletDto,
  OperatingHourItemDto,
} from './dto/merchant-business.dto.js';

function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string' || tz.trim() === '') {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

interface RawProfileRow {
  [key: string]: unknown;
  id: string;
  user_id: string;
  business_name: string | null;
  status: string;
  current_submission_id: string | null;
}

interface RawDraftRow {
  [key: string]: unknown;
  id: string;
  merchant_profile_id: string;
  source_onboarding_submission_id: string | null;
  business_setup_payload: Record<string, any> | null;
  outlet_setup_payload: Record<string, any> | null;
  operating_hours_payload: OperatingHourItemDto[] | null;
  current_step: number;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

interface RawBusinessRow {
  [key: string]: unknown;
  id: string;
  merchant_profile_id: string;
  name: string;
  category_code: string;
  description: string | null;
  source_onboarding_submission_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface RawOutletRow {
  [key: string]: unknown;
  id: string;
  business_id: string;
  name: string;
  contact_phone: string;
  province: string;
  regency_or_city: string;
  district: string;
  village_or_subdistrict: string;
  address_detail: string;
  postal_code: string | null;
  latitude: number | string;
  longitude: number | string;
  timezone: string;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
}

interface RawOperatingHourRow {
  [key: string]: unknown;
  id: string;
  outlet_id: string;
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  created_at: Date;
  updated_at: Date;
}

const DEFAULT_OPERATING_HOURS: OperatingHourItem[] = [
  { dayOfWeek: 1, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 2, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 3, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 4, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 5, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 6, isClosed: false, openTime: '08:00', closeTime: '21:00' },
  { dayOfWeek: 7, isClosed: false, openTime: '08:00', closeTime: '21:00' },
];

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return new Date(val as string).toISOString();
}

@Injectable()
export class MerchantBusinessService {
  constructor(
    @Inject(PG_POOL_TOKEN)
    private readonly pool: pg.Pool,
    private readonly transactionService: TransactionService,
  ) {}

  /**
   * Helper to resolve Merchant Profile by userId.
   */
  private async getMerchantProfile(userId: string): Promise<RawProfileRow> {
    const res = await this.pool.query<RawProfileRow>(
      `SELECT id, user_id, business_name, status, current_submission_id
       FROM merchant_profiles
       WHERE user_id = $1;`,
      [userId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new ForbiddenError(
        'Profil merchant tidak ditemukan. Aksi operasional memerlukan profil merchant.',
        { profile_status: 'NOT_FOUND' },
      );
    }
    return row;
  }

  /**
   * Helper to verify APPROVED status for mutation.
   */
  private assertApproved(profile: RawProfileRow): void {
    if (profile.status !== 'APPROVED') {
      throw new ForbiddenError(
        `Aksi operasional memerlukan status APPROVED, status saat ini adalah ${profile.status}`,
        { profile_status: profile.status },
      );
    }
  }

  /**
   * Map raw draft row to DTO.
   */
  private mapDraftToDto(row: RawDraftRow): BusinessSetupDraftDto {
    return {
      id: row.id,
      merchantProfileId: row.merchant_profile_id,
      sourceOnboardingSubmissionId: row.source_onboarding_submission_id,
      business: row.business_setup_payload ?? {},
      outlet: row.outlet_setup_payload ?? {},
      operatingHours: row.operating_hours_payload ?? DEFAULT_OPERATING_HOURS,
      currentStep: row.current_step,
      completedAt: row.completed_at ? toIso(row.completed_at) : null,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  /**
   * Map raw business row to DTO.
   */
  private mapBusinessToDto(row: RawBusinessRow): BusinessDto {
    return {
      id: row.id,
      merchantProfileId: row.merchant_profile_id,
      name: row.name,
      categoryCode: row.category_code,
      description: row.description,
      sourceOnboardingSubmissionId: row.source_onboarding_submission_id,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  /**
   * Map raw outlet row to DTO.
   */
  private mapOutletToDto(row: RawOutletRow): OutletDto {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      contactPhone: row.contact_phone,
      province: row.province,
      regencyOrCity: row.regency_or_city,
      district: row.district,
      villageOrSubdistrict: row.village_or_subdistrict,
      addressDetail: row.address_detail,
      postalCode: row.postal_code,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      timezone: row.timezone,
      isPrimary: row.is_primary,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  /**
   * Map raw operating hour row to DTO.
   */
  private mapOperatingHourToDto(row: RawOperatingHourRow): OutletOperatingHoursDto {
    return {
      id: row.id,
      outletId: row.outlet_id,
      dayOfWeek: row.day_of_week,
      isClosed: row.is_closed,
      openTime: row.open_time ? row.open_time.slice(0, 5) : null,
      closeTime: row.close_time ? row.close_time.slice(0, 5) : null,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  /**
   * Validate weekly 7-day operating hours.
   */
  private validateOperatingHours(
    hours?: Array<{ dayOfWeek: number; isClosed: boolean; openTime?: string | null; closeTime?: string | null }> | null,
  ): OperatingHourItem[] {
    if (!hours || !Array.isArray(hours) || hours.length !== 7) {
      throw new BadRequestError('Jadwal operasional harus berisi tepat 7 hari (Senin s/d Minggu)');
    }

    const seenDays = new Set<number>();
    const normalized: OperatingHourItem[] = [];

    for (const item of hours) {
      if (!item || typeof item.dayOfWeek !== 'number' || item.dayOfWeek < 1 || item.dayOfWeek > 7) {
        throw new BadRequestError('Hari dalam seminggu harus bernilai 1 (Senin) hingga 7 (Minggu)');
      }
      if (seenDays.has(item.dayOfWeek)) {
        throw new BadRequestError(`Hari ke-${item.dayOfWeek} terduplikasi dalam jadwal operasional`);
      }
      seenDays.add(item.dayOfWeek);

      if (item.isClosed) {
        if (item.openTime !== null && item.openTime !== undefined && item.openTime !== '') {
          throw new BadRequestError(`Hari tutup (hari ${item.dayOfWeek}) tidak boleh memiliki jam buka`);
        }
        if (item.closeTime !== null && item.closeTime !== undefined && item.closeTime !== '') {
          throw new BadRequestError(`Hari tutup (hari ${item.dayOfWeek}) tidak boleh memiliki jam tutup`);
        }
        normalized.push({
          dayOfWeek: item.dayOfWeek,
          isClosed: true,
          openTime: null,
          closeTime: null,
        });
      } else {
        if (!item.openTime || !item.closeTime) {
          throw new BadRequestError(`Hari buka (hari ${item.dayOfWeek}) wajib memiliki jam buka dan jam tutup`);
        }
        const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
        if (!timeRegex.test(item.openTime) || !timeRegex.test(item.closeTime)) {
          throw new BadRequestError(`Format jam pada hari ${item.dayOfWeek} harus HH:mm (contoh: 08:00)`);
        }
        const openStr = item.openTime.slice(0, 5);
        const closeStr = item.closeTime.slice(0, 5);
        if (openStr >= closeStr) {
          throw new BadRequestError(
            `Jam buka (${openStr}) harus lebih awal daripada jam tutup (${closeStr}) pada hari ${item.dayOfWeek}`,
          );
        }
        normalized.push({
          dayOfWeek: item.dayOfWeek,
          isClosed: false,
          openTime: openStr,
          closeTime: closeStr,
        });
      }
    }

    if (seenDays.size !== 7 || ![1, 2, 3, 4, 5, 6, 7].every((d) => seenDays.has(d))) {
      throw new BadRequestError('Jadwal operasional harus mencakup setiap hari dari 1 (Senin) hingga 7 (Minggu)');
    }

    return normalized.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }

  /**
   * 1. GET /api/v1/merchant/business-setup
   * Returns current setup status, active draft, or completed operational entities.
   */
  async getSetupStatus(userId: string): Promise<BusinessSetupStatusResponseDto> {
    const profile = await this.getMerchantProfile(userId);

    this.assertApproved(profile);

    // Check completed Business
    const businessRes = await this.pool.query<RawBusinessRow>(
      `SELECT * FROM businesses WHERE merchant_profile_id = $1;`,
      [profile.id],
    );
    const business = businessRes.rows[0];

    if (business) {
      // Query Primary Outlet
      const outletRes = await this.pool.query<RawOutletRow>(
        `SELECT
           id, business_id, name, contact_phone, province, regency_or_city,
           district, village_or_subdistrict, address_detail, postal_code,
           ST_Y(location::geometry) as latitude,
           ST_X(location::geometry) as longitude,
           timezone, is_primary, created_at, updated_at
         FROM outlets
         WHERE business_id = $1 AND is_primary = true;`,
        [business.id],
      );
      const outlet = outletRes.rows[0];

      let hours: OutletOperatingHoursDto[] = [];
      if (outlet) {
        const hoursRes = await this.pool.query<RawOperatingHourRow>(
          `SELECT * FROM outlet_operating_hours
           WHERE outlet_id = $1
           ORDER BY day_of_week ASC;`,
          [outlet.id],
        );
        hours = hoursRes.rows.map((r) => this.mapOperatingHourToDto(r));
      }

      return {
        state: 'COMPLETE',
        merchantProfileId: profile.id,
        profileStatus: profile.status,
        businessName: profile.business_name,
        draft: null,
        business: this.mapBusinessToDto(business),
        primaryOutlet: outlet ? this.mapOutletToDto(outlet) : null,
        operatingHours: hours,
      };
    }

    // Check active draft
    const draftRes = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_business_setup_drafts
       WHERE merchant_profile_id = $1 AND completed_at IS NULL;`,
      [profile.id],
    );
    const draft = draftRes.rows[0];

    if (draft) {
      return {
        state: 'DRAFT',
        merchantProfileId: profile.id,
        profileStatus: profile.status,
        businessName: profile.business_name,
        draft: this.mapDraftToDto(draft),
        business: null,
        primaryOutlet: null,
        operatingHours: null,
      };
    }

    return {
      state: 'NOT_STARTED',
      merchantProfileId: profile.id,
      profileStatus: profile.status,
      businessName: profile.business_name,
      draft: null,
      business: null,
      primaryOutlet: null,
      operatingHours: null,
    };
  }

  /**
   * 2. POST /api/v1/merchant/business-setup/draft (or implicit in get/patch)
   * Create or return the single active setup draft.
   */
  async getOrCreateDraft(userId: string): Promise<BusinessSetupDraftDto> {
    const profile = await this.getMerchantProfile(userId);
    this.assertApproved(profile);

    // Block if business is already complete
    const busCheck = await this.pool.query<{ id: string }>(
      `SELECT id FROM businesses WHERE merchant_profile_id = $1;`,
      [profile.id],
    );
    if (busCheck.rows[0]) {
      throw new ConflictError('Setup usaha dan outlet telah selesai dilakukan.');
    }

    // Query active draft
    const draftRes = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_business_setup_drafts
       WHERE merchant_profile_id = $1 AND completed_at IS NULL;`,
      [profile.id],
    );
    if (draftRes.rows[0]) {
      return this.mapDraftToDto(draftRes.rows[0]);
    }

    // Prefill from approved Phase 2B submission if available
    let prefillBusinessName = profile.business_name || '';
    let prefillCategory = '';
    let prefillDesc = '';
    let prefillPhone = '';
    const sourceSubmissionId = profile.current_submission_id;

    if (sourceSubmissionId) {
      const subRes = await this.pool.query<{
        id: string;
        proposed_business_name: string;
        business_category: string;
        business_description: string | null;
        account_phone_snapshot: string;
      }>(
        `SELECT id, proposed_business_name, business_category, business_description, account_phone_snapshot
         FROM merchant_onboarding_submissions
         WHERE id = $1;`,
        [sourceSubmissionId],
      );
      const sub = subRes.rows[0];
      if (sub) {
        prefillBusinessName = sub.proposed_business_name || prefillBusinessName;
        prefillCategory = sub.business_category || '';
        prefillDesc = sub.business_description || '';
        prefillPhone = sub.account_phone_snapshot || '';
      }
    }

    const draftId = generateUuidV7();
    const now = new Date();
    const initialBusiness = {
      name: prefillBusinessName,
      categoryCode: prefillCategory,
      description: prefillDesc || null,
    };
    const initialOutlet = {
      name: prefillBusinessName ? `${prefillBusinessName} - Outlet Utama` : undefined,
      contactPhone: prefillPhone || undefined,
      province: undefined,
      regencyOrCity: undefined,
      district: undefined,
      villageOrSubdistrict: undefined,
      addressDetail: undefined,
      postalCode: undefined,
      latitude: undefined,
      longitude: undefined,
      timezone: undefined,
    };

    await this.pool.query(
      `INSERT INTO merchant_business_setup_drafts
       (id, merchant_profile_id, source_onboarding_submission_id, business_setup_payload,
        outlet_setup_payload, operating_hours_payload, current_step, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $7)
       ON CONFLICT (merchant_profile_id) WHERE completed_at IS NULL DO NOTHING;`,
      [
        draftId,
        profile.id,
        sourceSubmissionId,
        JSON.stringify(initialBusiness),
        JSON.stringify(initialOutlet),
        JSON.stringify(DEFAULT_OPERATING_HOURS),
        now,
      ],
    );

    const inserted = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_business_setup_drafts
       WHERE merchant_profile_id = $1 AND completed_at IS NULL;`,
      [profile.id],
    );
    return this.mapDraftToDto(inserted.rows[0]!);
  }

  /**
   * 3. PATCH /api/v1/merchant/business-setup
   * Partial autosave of active draft fields.
   */
  async saveDraft(
    userId: string,
    dto: SaveBusinessSetupDraftDto,
  ): Promise<BusinessSetupDraftDto> {
    const profile = await this.getMerchantProfile(userId);
    this.assertApproved(profile);

    // Block if business is already complete
    const busCheck = await this.pool.query<{ id: string }>(
      `SELECT id FROM businesses WHERE merchant_profile_id = $1;`,
      [profile.id],
    );
    if (busCheck.rows[0]) {
      throw new ConflictError('Setup usaha dan outlet telah selesai dilakukan.');
    }

    // Ensure draft exists
    let draftRes = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_business_setup_drafts
       WHERE merchant_profile_id = $1 AND completed_at IS NULL;`,
      [profile.id],
    );
    let draft = draftRes.rows[0];
    if (!draft) {
      await this.getOrCreateDraft(userId);
      draftRes = await this.pool.query<RawDraftRow>(
        `SELECT * FROM merchant_business_setup_drafts
         WHERE merchant_profile_id = $1 AND completed_at IS NULL;`,
        [profile.id],
      );
      draft = draftRes.rows[0]!;
    }

    // Merge business payload
    const existingBusiness = draft.business_setup_payload || {};
    if (
      dto.business?.categoryCode !== undefined &&
      dto.business?.categoryCode !== null &&
      dto.business?.categoryCode !== ''
    ) {
      if (!isValidMerchantBusinessCategory(dto.business.categoryCode)) {
        throw new BadRequestError('Kategori usaha tidak valid atau tidak didukung');
      }
    }
    const updatedBusiness = dto.business
      ? { ...existingBusiness, ...dto.business }
      : existingBusiness;

    // Merge outlet payload - preserve omitted/undefined values
    const existingOutlet = draft.outlet_setup_payload || {};
    const updatedOutlet = { ...existingOutlet };
    if (dto.outlet) {
      for (const [key, value] of Object.entries(dto.outlet)) {
        if (value !== undefined) {
          (updatedOutlet as any)[key] = value;
        }
      }
    }

    // Merge operating hours if supplied
    let updatedHours = draft.operating_hours_payload || DEFAULT_OPERATING_HOURS;
    if (dto.operatingHours) {
      // For draft autosave, validate length and day range
      if (Array.isArray(dto.operatingHours) && dto.operatingHours.length > 0) {
        updatedHours = dto.operatingHours;
      }
    }

    const currentStep = dto.currentStep ?? draft.current_step;
    const now = new Date();

    await this.pool.query(
      `UPDATE merchant_business_setup_drafts
       SET business_setup_payload = $1,
           outlet_setup_payload = $2,
           operating_hours_payload = $3,
           current_step = $4,
           updated_at = $5
       WHERE id = $6;`,
      [
        JSON.stringify(updatedBusiness),
        JSON.stringify(updatedOutlet),
        JSON.stringify(updatedHours),
        currentStep,
        now,
        draft.id,
      ],
    );

    const updated = await this.pool.query<RawDraftRow>(
      `SELECT * FROM merchant_business_setup_drafts WHERE id = $1;`,
      [draft.id],
    );
    return this.mapDraftToDto(updated.rows[0]!);
  }

  /**
   * 4. POST /api/v1/merchant/business-setup/complete
   * Critical mutation: atomically creates Business + Primary Outlet + 7 Schedule rows
   * inside a single PostgreSQL transaction with FOR UPDATE row-level locking and idempotency.
   */
  async completeSetup(
    userId: string,
    dto: CompleteBusinessSetupDto,
  ): Promise<BusinessSetupCompletionResponseDto> {
    return this.transactionService.runInTransaction(async (tx) => {
      // 1. Row-level lock target profile
      const profileRes = await tx.execute<RawProfileRow>(
        sql`SELECT id, user_id, business_name, status, current_submission_id
            FROM merchant_profiles
            WHERE user_id = ${userId}
            FOR UPDATE;`,
      );
      const profile = profileRes.rows[0];
      if (!profile) {
        throw new ForbiddenError(
          'Profil merchant tidak ditemukan. Aksi operasional memerlukan profil merchant.',
          { profile_status: 'NOT_FOUND' },
        );
      }

      // 2. Verify APPROVED status
      if (profile.status !== 'APPROVED') {
        throw new ForbiddenError(
          `Aksi operasional memerlukan status APPROVED, status saat ini adalah ${profile.status}`,
          { profile_status: profile.status },
        );
      }

      // 3. Check existing completed Business FOR UPDATE (Idempotent retry guard)
      const existingBusRes = await tx.execute<RawBusinessRow>(
        sql`SELECT * FROM businesses WHERE merchant_profile_id = ${profile.id} FOR UPDATE;`,
      );
      const existingBusiness = existingBusRes.rows[0];
      if (existingBusiness) {
        // Return existing completed representation idempotently
        const existingOutletRes = await tx.execute<RawOutletRow>(
          sql`SELECT
                id, business_id, name, contact_phone, province, regency_or_city,
                district, village_or_subdistrict, address_detail, postal_code,
                ST_Y(location::geometry) as latitude,
                ST_X(location::geometry) as longitude,
                timezone, is_primary, created_at, updated_at
              FROM outlets
              WHERE business_id = ${existingBusiness.id} AND is_primary = true;`,
        );
        const existingOutlet = existingOutletRes.rows[0]!;

        const existingHoursRes = await tx.execute<RawOperatingHourRow>(
          sql`SELECT * FROM outlet_operating_hours
              WHERE outlet_id = ${existingOutlet.id}
              ORDER BY day_of_week ASC;`,
        );

        return {
          state: 'COMPLETE',
          business: this.mapBusinessToDto(existingBusiness),
          primaryOutlet: this.mapOutletToDto(existingOutlet),
          operatingHours: existingHoursRes.rows.map((r) => this.mapOperatingHourToDto(r)),
        };
      }

      // 4. Lock active draft FOR UPDATE
      const draftRes = await tx.execute<RawDraftRow>(
        sql`SELECT * FROM merchant_business_setup_drafts
            WHERE merchant_profile_id = ${profile.id} AND completed_at IS NULL
            FOR UPDATE;`,
      );
      const draft = draftRes.rows[0];
      // 5. Require active draft
      if (!draft) {
        throw new BadRequestError(
          'Draft setup usaha aktif tidak ditemukan. Selesaikan inisialisasi draft terlebih dahulu.',
        );
      }

      // 6. Merge/normalize final DTO into the locked draft snapshot
      const rawExistingBusiness = draft.business_setup_payload || {};
      const rawExistingOutlet = draft.outlet_setup_payload || {};

      const finalBusinessSnapshot = {
        name: (dto.business?.name !== undefined && dto.business?.name !== null ? dto.business.name : (rawExistingBusiness.name ?? '')).trim(),
        categoryCode: (dto.business?.categoryCode !== undefined && dto.business?.categoryCode !== null ? dto.business.categoryCode : (rawExistingBusiness.categoryCode ?? '')).trim(),
        description: dto.business?.description !== undefined
          ? (dto.business.description ? dto.business.description.trim() : null)
          : (rawExistingBusiness.description ? String(rawExistingBusiness.description).trim() : null),
      };

      const rawLat = dto.outlet?.latitude !== undefined ? dto.outlet.latitude : rawExistingOutlet.latitude;
      const rawLon = dto.outlet?.longitude !== undefined ? dto.outlet.longitude : rawExistingOutlet.longitude;
      const parsedLat = rawLat !== undefined && rawLat !== null && !Number.isNaN(Number(rawLat)) ? Number(rawLat) : NaN;
      const parsedLon = rawLon !== undefined && rawLon !== null && !Number.isNaN(Number(rawLon)) ? Number(rawLon) : NaN;

      const finalOutletSnapshot = {
        name: (dto.outlet?.name !== undefined && dto.outlet?.name !== null ? dto.outlet.name : (rawExistingOutlet.name ?? '')).trim(),
        contactPhone: (dto.outlet?.contactPhone !== undefined && dto.outlet?.contactPhone !== null ? dto.outlet.contactPhone : (rawExistingOutlet.contactPhone ?? '')).trim(),
        province: (dto.outlet?.province !== undefined && dto.outlet?.province !== null ? dto.outlet.province : (rawExistingOutlet.province ?? '')).trim(),
        regencyOrCity: (dto.outlet?.regencyOrCity !== undefined && dto.outlet?.regencyOrCity !== null ? dto.outlet.regencyOrCity : (rawExistingOutlet.regencyOrCity ?? '')).trim(),
        district: (dto.outlet?.district !== undefined && dto.outlet?.district !== null ? dto.outlet.district : (rawExistingOutlet.district ?? '')).trim(),
        villageOrSubdistrict: (dto.outlet?.villageOrSubdistrict !== undefined && dto.outlet?.villageOrSubdistrict !== null ? dto.outlet.villageOrSubdistrict : (rawExistingOutlet.villageOrSubdistrict ?? '')).trim(),
        addressDetail: (dto.outlet?.addressDetail !== undefined && dto.outlet?.addressDetail !== null ? dto.outlet.addressDetail : (rawExistingOutlet.addressDetail ?? '')).trim(),
        postalCode: dto.outlet?.postalCode !== undefined
          ? (dto.outlet.postalCode ? dto.outlet.postalCode.trim() : null)
          : (rawExistingOutlet.postalCode ? String(rawExistingOutlet.postalCode).trim() : null),
        latitude: parsedLat,
        longitude: parsedLon,
        timezone: (dto.outlet?.timezone !== undefined && dto.outlet?.timezone !== null ? dto.outlet.timezone : (rawExistingOutlet.timezone ?? '')).trim(),
      };

      const finalHoursInput = dto.operatingHours ?? draft.operating_hours_payload;

      // 7. Validate the FINAL merged snapshot
      if (!finalBusinessSnapshot.name || finalBusinessSnapshot.name.length < 2) {
        throw new BadRequestError('Nama usaha wajib diisi (minimal 2 karakter)');
      }
      if (!finalBusinessSnapshot.categoryCode) {
        throw new BadRequestError('Kategori usaha wajib dipilih');
      }
      if (!isValidMerchantBusinessCategory(finalBusinessSnapshot.categoryCode)) {
        throw new BadRequestError('Kategori usaha tidak valid atau tidak didukung');
      }

      if (!finalOutletSnapshot.name || finalOutletSnapshot.name.length < 2) {
        throw new BadRequestError('Nama outlet utama wajib diisi (minimal 2 karakter)');
      }
      if (!finalOutletSnapshot.contactPhone || finalOutletSnapshot.contactPhone.length < 8) {
        throw new BadRequestError('Nomor telepon outlet minimal 8 digit');
      }
      if (
        !finalOutletSnapshot.province ||
        !finalOutletSnapshot.regencyOrCity ||
        !finalOutletSnapshot.district ||
        !finalOutletSnapshot.villageOrSubdistrict ||
        !finalOutletSnapshot.addressDetail ||
        finalOutletSnapshot.addressDetail.length < 5
      ) {
        throw new BadRequestError('Alamat fisik operasional outlet wajib diisi lengkap');
      }

      if (
        typeof finalOutletSnapshot.latitude !== 'number' ||
        Number.isNaN(finalOutletSnapshot.latitude) ||
        finalOutletSnapshot.latitude < -90 ||
        finalOutletSnapshot.latitude > 90
      ) {
        throw new BadRequestError('Koordinat Latitude tidak valid (harus antara -90 dan 90)');
      }
      if (
        typeof finalOutletSnapshot.longitude !== 'number' ||
        Number.isNaN(finalOutletSnapshot.longitude) ||
        finalOutletSnapshot.longitude < -180 ||
        finalOutletSnapshot.longitude > 180
      ) {
        throw new BadRequestError('Koordinat Longitude tidak valid (harus antara -180 dan 180)');
      }

      if (!finalOutletSnapshot.timezone) {
        throw new BadRequestError('Zona waktu outlet wajib diisi');
      }
      if (!isValidIanaTimezone(finalOutletSnapshot.timezone)) {
        throw new BadRequestError(
          'Zona waktu outlet wajib valid (contoh: Asia/Jakarta, Asia/Makassar, Asia/Jayapura)',
        );
      }

      const validatedHours = this.validateOperatingHours(finalHoursInput);

      const now = new Date();
      const businessId = generateUuidV7();
      const outletId = generateUuidV7();
      const sourceSubId = draft.source_onboarding_submission_id ?? profile.current_submission_id;

      // 8. Persist that exact final snapshot into draft payloads
      await tx.execute(
        sql`UPDATE merchant_business_setup_drafts
            SET business_setup_payload = ${JSON.stringify(finalBusinessSnapshot)}::jsonb,
                outlet_setup_payload = ${JSON.stringify(finalOutletSnapshot)}::jsonb,
                operating_hours_payload = ${JSON.stringify(validatedHours)}::jsonb,
                current_step = 4,
                updated_at = ${now}
            WHERE id = ${draft.id};`,
      );

      // 9. Create Business / Primary Outlet / Hours FROM THAT SAME normalized snapshot
      await tx.execute(
        sql`INSERT INTO businesses
            (id, merchant_profile_id, name, category_code, description, source_onboarding_submission_id, created_at, updated_at)
            VALUES
            (${businessId}, ${profile.id}, ${finalBusinessSnapshot.name}, ${finalBusinessSnapshot.categoryCode},
             ${finalBusinessSnapshot.description}, ${sourceSubId}, ${now}, ${now});`,
      );

      await tx.execute(
        sql`INSERT INTO outlets
            (id, business_id, name, contact_phone, province, regency_or_city, district,
             village_or_subdistrict, address_detail, postal_code, location, timezone, is_primary, created_at, updated_at)
            VALUES
            (${outletId}, ${businessId}, ${finalOutletSnapshot.name}, ${finalOutletSnapshot.contactPhone},
             ${finalOutletSnapshot.province}, ${finalOutletSnapshot.regencyOrCity}, ${finalOutletSnapshot.district},
             ${finalOutletSnapshot.villageOrSubdistrict}, ${finalOutletSnapshot.addressDetail}, ${finalOutletSnapshot.postalCode},
             ST_SetSRID(ST_MakePoint(${finalOutletSnapshot.longitude}, ${finalOutletSnapshot.latitude}), 4326)::geography,
             ${finalOutletSnapshot.timezone},
             true, ${now}, ${now});`,
      );

      for (const h of validatedHours) {
        const hourRowId = generateUuidV7();
        await tx.execute(
          sql`INSERT INTO outlet_operating_hours
              (id, outlet_id, day_of_week, is_closed, open_time, close_time, created_at, updated_at)
              VALUES
              (${hourRowId}, ${outletId}, ${h.dayOfWeek}, ${h.isClosed}, ${h.openTime}, ${h.closeTime}, ${now}, ${now});`,
        );
      }

      // 10. Set completed_at (DO NOT DELETE draft)
      await tx.execute(
        sql`UPDATE merchant_business_setup_drafts
            SET completed_at = ${now}, updated_at = ${now}
            WHERE id = ${draft.id};`,
      );

      // 14. Return the completed representation
      const createdBusinessRes = await tx.execute<RawBusinessRow>(
        sql`SELECT * FROM businesses WHERE id = ${businessId};`,
      );
      const createdOutletRes = await tx.execute<RawOutletRow>(
        sql`SELECT
              id, business_id, name, contact_phone, province, regency_or_city,
              district, village_or_subdistrict, address_detail, postal_code,
              ST_Y(location::geometry) as latitude,
              ST_X(location::geometry) as longitude,
              timezone, is_primary, created_at, updated_at
            FROM outlets
            WHERE id = ${outletId};`,
      );
      const createdHoursRes = await tx.execute<RawOperatingHourRow>(
        sql`SELECT * FROM outlet_operating_hours WHERE outlet_id = ${outletId} ORDER BY day_of_week ASC;`,
      );

      return {
        state: 'COMPLETE',
        business: this.mapBusinessToDto(createdBusinessRes.rows[0]!),
        primaryOutlet: this.mapOutletToDto(createdOutletRes.rows[0]!),
        operatingHours: createdHoursRes.rows.map((r) => this.mapOperatingHourToDto(r)),
      };
    });
  }

  /**
   * 5. GET /api/v1/merchant/business
   * Read completed Business information.
   */
  async getBusiness(userId: string): Promise<BusinessDto> {
    const profile = await this.getMerchantProfile(userId);
    const res = await this.pool.query<RawBusinessRow>(
      `SELECT * FROM businesses WHERE merchant_profile_id = $1;`,
      [profile.id],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundError('Data profil usaha belum dibuat. Selesaikan setup usaha terlebih dahulu.');
    }
    return this.mapBusinessToDto(row);
  }

  /**
   * 6. PATCH /api/v1/merchant/business
   * Update Business fields post-completion. Enforces APPROVED. Blocks SUSPENDED.
   * Phase 2B onboarding submissions remain completely unchanged.
   */
  async updateBusiness(userId: string, dto: UpdateBusinessDto): Promise<BusinessDto> {
    const profile = await this.getMerchantProfile(userId);
    this.assertApproved(profile);

    const res = await this.pool.query<RawBusinessRow>(
      `SELECT * FROM businesses WHERE merchant_profile_id = $1;`,
      [profile.id],
    );
    const business = res.rows[0];
    if (!business) {
      throw new NotFoundError('Data profil usaha belum dibuat. Selesaikan setup usaha terlebih dahulu.');
    }

    const name = dto.name !== undefined ? dto.name.trim() : business.name;
    const categoryCode = dto.categoryCode !== undefined ? dto.categoryCode.trim() : business.category_code;
    const description = dto.description !== undefined ? dto.description : business.description;

    if (name.length < 2) {
      throw new BadRequestError('Nama usaha minimal 2 karakter');
    }
    if (categoryCode.length < 2) {
      throw new BadRequestError('Kategori usaha wajib dipilih');
    }
    if (!isValidMerchantBusinessCategory(categoryCode)) {
      throw new BadRequestError('Kategori usaha tidak valid atau tidak didukung');
    }

    const now = new Date();
    await this.pool.query(
      `UPDATE businesses
       SET name = $1, category_code = $2, description = $3, updated_at = $4
       WHERE id = $5;`,
      [name, categoryCode, description, now, business.id],
    );

    const updated = await this.pool.query<RawBusinessRow>(
      `SELECT * FROM businesses WHERE id = $1;`,
      [business.id],
    );
    return this.mapBusinessToDto(updated.rows[0]!);
  }

  /**
   * 7. GET /api/v1/merchant/outlets/primary
   * Read Primary Outlet and weekly schedule.
   */
  async getPrimaryOutlet(
    userId: string,
  ): Promise<{ outlet: OutletDto; operatingHours: OutletOperatingHoursDto[] }> {
    const profile = await this.getMerchantProfile(userId);

    const busRes = await this.pool.query<{ id: string }>(
      `SELECT id FROM businesses WHERE merchant_profile_id = $1;`,
      [profile.id],
    );
    const business = busRes.rows[0];
    if (!business) {
      throw new NotFoundError('Data profil usaha belum dibuat. Selesaikan setup usaha terlebih dahulu.');
    }

    const outletRes = await this.pool.query<RawOutletRow>(
      `SELECT
         id, business_id, name, contact_phone, province, regency_or_city,
         district, village_or_subdistrict, address_detail, postal_code,
         ST_Y(location::geometry) as latitude,
         ST_X(location::geometry) as longitude,
         timezone, is_primary, created_at, updated_at
       FROM outlets
       WHERE business_id = $1 AND is_primary = true;`,
      [business.id],
    );
    const outlet = outletRes.rows[0];
    if (!outlet) {
      throw new NotFoundError('Outlet utama belum terdaftar.');
    }

    const hoursRes = await this.pool.query<RawOperatingHourRow>(
      `SELECT * FROM outlet_operating_hours
       WHERE outlet_id = $1
       ORDER BY day_of_week ASC;`,
      [outlet.id],
    );

    return {
      outlet: this.mapOutletToDto(outlet),
      operatingHours: hoursRes.rows.map((r) => this.mapOperatingHourToDto(r)),
    };
  }

  /**
   * 8. PATCH /api/v1/merchant/outlets/primary
   * Update Primary Outlet fields & operating hours post-completion.
   * Enforces APPROVED. Blocks SUSPENDED.
   * Phase 2B onboarding submissions remain completely unchanged.
   */
  async updatePrimaryOutlet(
    userId: string,
    dto: UpdatePrimaryOutletDto,
  ): Promise<{ outlet: OutletDto; operatingHours: OutletOperatingHoursDto[] }> {
    const profile = await this.getMerchantProfile(userId);
    this.assertApproved(profile);

    const busRes = await this.pool.query<{ id: string }>(
      `SELECT id FROM businesses WHERE merchant_profile_id = $1;`,
      [profile.id],
    );
    const business = busRes.rows[0];
    if (!business) {
      throw new NotFoundError('Data profil usaha belum dibuat. Selesaikan setup usaha terlebih dahulu.');
    }

    const outletRes = await this.pool.query<RawOutletRow>(
      `SELECT
         id, business_id, name, contact_phone, province, regency_or_city,
         district, village_or_subdistrict, address_detail, postal_code,
         ST_Y(location::geometry) as latitude,
         ST_X(location::geometry) as longitude,
         timezone, is_primary, created_at, updated_at
       FROM outlets
       WHERE business_id = $1 AND is_primary = true;`,
      [business.id],
    );
    const outlet = outletRes.rows[0];
    if (!outlet) {
      throw new NotFoundError('Outlet utama belum terdaftar.');
    }

    const name = dto.name !== undefined ? dto.name.trim() : outlet.name;
    const contactPhone = dto.contactPhone !== undefined ? dto.contactPhone.trim() : outlet.contact_phone;
    const province = dto.province !== undefined ? dto.province.trim() : outlet.province;
    const regencyOrCity = dto.regencyOrCity !== undefined ? dto.regencyOrCity.trim() : outlet.regency_or_city;
    const district = dto.district !== undefined ? dto.district.trim() : outlet.district;
    const villageOrSubdistrict = dto.villageOrSubdistrict !== undefined ? dto.villageOrSubdistrict.trim() : outlet.village_or_subdistrict;
    const addressDetail = dto.addressDetail !== undefined ? dto.addressDetail.trim() : outlet.address_detail;
    const postalCode = dto.postalCode !== undefined ? (dto.postalCode ? dto.postalCode.trim() : null) : outlet.postal_code;

    let latitude = Number(outlet.latitude);
    let longitude = Number(outlet.longitude);
    if (dto.latitude !== undefined) {
      if (typeof dto.latitude !== 'number' || Number.isNaN(dto.latitude) || dto.latitude < -90 || dto.latitude > 90) {
        throw new BadRequestError('Koordinat Latitude tidak valid (harus antara -90 dan 90)');
      }
      latitude = dto.latitude;
    }
    if (dto.longitude !== undefined) {
      if (typeof dto.longitude !== 'number' || Number.isNaN(dto.longitude) || dto.longitude < -180 || dto.longitude > 180) {
        throw new BadRequestError('Koordinat Longitude tidak valid (harus antara -180 dan 180)');
      }
      longitude = dto.longitude;
    }

    let timezone = outlet.timezone;
    if (dto.timezone !== undefined) {
      if (!isValidIanaTimezone(dto.timezone)) {
        throw new BadRequestError('Zona waktu IANA tidak valid (contoh: Asia/Jakarta, Asia/Makassar, Asia/Jayapura)');
      }
      timezone = dto.timezone.trim();
    }

    const now = new Date();

    await this.transactionService.runInTransaction(async (tx) => {
      // Update outlet
      await tx.execute(
        sql`UPDATE outlets
            SET name = ${name},
                contact_phone = ${contactPhone},
                province = ${province},
                regency_or_city = ${regencyOrCity},
                district = ${district},
                village_or_subdistrict = ${villageOrSubdistrict},
                address_detail = ${addressDetail},
                postal_code = ${postalCode},
                location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                timezone = ${timezone},
                updated_at = ${now}
            WHERE id = ${outlet.id};`,
      );

      // Update operating hours if provided
      if (dto.operatingHours) {
        const validatedHours = this.validateOperatingHours(dto.operatingHours);
        for (const h of validatedHours) {
          await tx.execute(
            sql`UPDATE outlet_operating_hours
                SET is_closed = ${h.isClosed},
                    open_time = ${h.openTime},
                    close_time = ${h.closeTime},
                    updated_at = ${now}
                WHERE outlet_id = ${outlet.id} AND day_of_week = ${h.dayOfWeek};`,
          );
        }
      }
    });

    return this.getPrimaryOutlet(userId);
  }

  /**
   * Helper for Admin detail view: Fetch operational summary for merchant profile.
   */
  async getOperationalSummaryForProfile(
    profileId: string,
  ): Promise<{
    setupState: BusinessSetupState;
    business: BusinessDto | null;
    primaryOutlet: OutletDto | null;
    operatingHours: OutletOperatingHoursDto[] | null;
  }> {
    const busRes = await this.pool.query<RawBusinessRow>(
      `SELECT * FROM businesses WHERE merchant_profile_id = $1;`,
      [profileId],
    );
    const business = busRes.rows[0];

    if (business) {
      const outletRes = await this.pool.query<RawOutletRow>(
        `SELECT
           id, business_id, name, contact_phone, province, regency_or_city,
           district, village_or_subdistrict, address_detail, postal_code,
           ST_Y(location::geometry) as latitude,
           ST_X(location::geometry) as longitude,
           timezone, is_primary, created_at, updated_at
         FROM outlets
         WHERE business_id = $1 AND is_primary = true;`,
        [business.id],
      );
      const outlet = outletRes.rows[0];

      let hours: OutletOperatingHoursDto[] = [];
      if (outlet) {
        const hoursRes = await this.pool.query<RawOperatingHourRow>(
          `SELECT * FROM outlet_operating_hours
           WHERE outlet_id = $1
           ORDER BY day_of_week ASC;`,
          [outlet.id],
        );
        hours = hoursRes.rows.map((r) => this.mapOperatingHourToDto(r));
      }

      return {
        setupState: 'COMPLETE',
        business: this.mapBusinessToDto(business),
        primaryOutlet: outlet ? this.mapOutletToDto(outlet) : null,
        operatingHours: hours,
      };
    }

    const draftRes = await this.pool.query<{ id: string }>(
      `SELECT id FROM merchant_business_setup_drafts
       WHERE merchant_profile_id = $1 AND completed_at IS NULL;`,
      [profileId],
    );
    if (draftRes.rows[0]) {
      return {
        setupState: 'DRAFT',
        business: null,
        primaryOutlet: null,
        operatingHours: null,
      };
    }

    return {
      setupState: 'NOT_STARTED',
      business: null,
      primaryOutlet: null,
      operatingHours: null,
    };
  }
}
