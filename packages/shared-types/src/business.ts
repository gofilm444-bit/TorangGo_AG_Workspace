/**
 * Phase 2C Merchant Business + Single Outlet Foundation Types.
 */

export const BUSINESS_SETUP_STATES = [
  'NOT_STARTED',
  'DRAFT',
  'COMPLETE',
] as const;

export type BusinessSetupState = (typeof BUSINESS_SETUP_STATES)[number];

export const MERCHANT_BUSINESS_CATEGORIES = [
  { code: 'KULINER', label: 'Kuliner (Makanan & Minuman)' },
  { code: 'TOKO_KELONTONG', label: 'Toko Kelontong / Sembako' },
  { code: 'FASHION', label: 'Fashion & Pakaian' },
  { code: 'ELEKTRONIK', label: 'Elektronik & Gadget' },
  { code: 'LAINNYA', label: 'Lainnya' },
] as const;

export type MerchantBusinessCategoryCode =
  (typeof MERCHANT_BUSINESS_CATEGORIES)[number]['code'];

export const CANONICAL_MERCHANT_BUSINESS_CATEGORY_CODES = [
  'KULINER',
  'TOKO_KELONTONG',
  'FASHION',
  'ELEKTRONIK',
  'LAINNYA',
] as const;

export const CANONICAL_MERCHANT_BUSINESS_CATEGORY_SET = new Set<string>(
  MERCHANT_BUSINESS_CATEGORIES.map((c) => c.code),
);

export function isValidMerchantBusinessCategory(
  categoryCode: unknown,
): categoryCode is MerchantBusinessCategoryCode {
  return (
    typeof categoryCode === 'string' &&
    CANONICAL_MERCHANT_BUSINESS_CATEGORY_SET.has(categoryCode.trim())
  );
}

export interface OperatingHourItem {
  dayOfWeek: number; // 1 = Monday, 7 = Sunday
  isClosed: boolean;
  openTime: string | null; // Format HH:mm
  closeTime: string | null; // Format HH:mm
}

export interface BusinessSetupDraftPayload {
  name?: string;
  categoryCode?: string;
  description?: string | null;
}

export interface OutletSetupDraftPayload {
  name?: string;
  contactPhone?: string;
  province?: string;
  regencyOrCity?: string;
  district?: string;
  villageOrSubdistrict?: string;
  addressDetail?: string;
  postalCode?: string | null;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export interface BusinessSetupDraftDto {
  id: string;
  merchantProfileId: string;
  sourceOnboardingSubmissionId: string | null;
  business: BusinessSetupDraftPayload;
  outlet: OutletSetupDraftPayload;
  operatingHours: OperatingHourItem[];
  currentStep: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveBusinessSetupDraftDto {
  business?: Partial<BusinessSetupDraftPayload>;
  outlet?: Partial<OutletSetupDraftPayload>;
  operatingHours?: OperatingHourItem[];
  currentStep?: number;
}

export interface BusinessDto {
  id: string;
  merchantProfileId: string;
  name: string;
  categoryCode: string;
  description: string | null;
  sourceOnboardingSubmissionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutletDto {
  id: string;
  businessId: string;
  name: string;
  contactPhone: string;
  province: string;
  regencyOrCity: string;
  district: string;
  villageOrSubdistrict: string;
  addressDetail: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutletOperatingHoursDto {
  id: string;
  outletId: string;
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSetupStatusResponseDto {
  state: BusinessSetupState;
  merchantProfileId: string;
  profileStatus: string;
  businessName: string | null;
  draft: BusinessSetupDraftDto | null;
  business: BusinessDto | null;
  primaryOutlet: OutletDto | null;
  operatingHours: OutletOperatingHoursDto[] | null;
}

export interface CompleteBusinessSetupDto {
  business: {
    name: string;
    categoryCode: string;
    description?: string | null;
  };
  outlet: {
    name: string;
    contactPhone: string;
    province: string;
    regencyOrCity: string;
    district: string;
    villageOrSubdistrict: string;
    addressDetail: string;
    postalCode?: string | null;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  operatingHours: OperatingHourItem[];
}

export interface BusinessSetupCompletionResponseDto {
  state: 'COMPLETE';
  business: BusinessDto;
  primaryOutlet: OutletDto;
  operatingHours: OutletOperatingHoursDto[];
}

export interface UpdateBusinessDto {
  name?: string;
  categoryCode?: string;
  description?: string | null;
}

export interface UpdatePrimaryOutletDto {
  name?: string;
  contactPhone?: string;
  province?: string;
  regencyOrCity?: string;
  district?: string;
  villageOrSubdistrict?: string;
  addressDetail?: string;
  postalCode?: string | null;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  operatingHours?: OperatingHourItem[];
}

export interface AdminMerchantOperationalSummaryDto {
  setupState: BusinessSetupState;
  business: BusinessDto | null;
  primaryOutlet: OutletDto | null;
  operatingHours: OutletOperatingHoursDto[] | null;
}
