import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  type BusinessSetupState,
  BUSINESS_SETUP_STATES,
} from '@platform/shared-types';

export class OperatingHourItemDto {
  @ApiProperty({ description: 'Day of week: 1 (Monday) to 7 (Sunday)', example: 1, minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ description: 'Whether the outlet is closed on this day', example: false })
  @IsBoolean()
  isClosed!: boolean;

  @ApiPropertyOptional({ type: String, description: 'Opening time (HH:mm)', example: '08:00', nullable: true })
  @IsOptional()
  @IsString()
  openTime?: string | null;

  @ApiPropertyOptional({ type: String, description: 'Closing time (HH:mm)', example: '21:00', nullable: true })
  @IsOptional()
  @IsString()
  closeTime?: string | null;
}

export class BusinessSetupDraftPayloadDto {
  @ApiPropertyOptional({ type: String, description: 'Business name', example: 'RM Manado Mantap', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ type: String, description: 'Business category code', example: 'KULINER', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  categoryCode?: string;

  @ApiPropertyOptional({ type: String, description: 'Business description', example: 'Masakan khas Manado autentik', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string | null;
}

export class OutletSetupDraftPayloadDto {
  @ApiPropertyOptional({ type: String, description: 'Primary outlet name', example: 'RM Manado Mantap - Cabang Sam Ratulangi', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ type: String, description: 'Outlet contact phone', example: '+6281234567890', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  contactPhone?: string;

  @ApiPropertyOptional({ type: String, description: 'Province', example: 'Sulawesi Utara', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  province?: string;

  @ApiPropertyOptional({ type: String, description: 'Regency or City', example: 'Kota Manado', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  regencyOrCity?: string;

  @ApiPropertyOptional({ type: String, description: 'District', example: 'Wenang', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  district?: string;

  @ApiPropertyOptional({ type: String, description: 'Village or Subdistrict', example: 'Bumi Beringin', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  villageOrSubdistrict?: string;

  @ApiPropertyOptional({ type: String, description: 'Full physical address detail', example: 'Jl. Sam Ratulangi No. 45' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  addressDetail?: string;

  @ApiPropertyOptional({ type: String, description: 'Postal code (optional)', example: '95111', nullable: true, maxLength: 16 })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  postalCode?: string | null;

  @ApiPropertyOptional({ type: Number, description: 'WGS84 latitude (-90 to 90)', example: 1.4748 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ type: Number, description: 'WGS84 longitude (-180 to 180)', example: 124.8421 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ type: String, description: 'IANA Timezone', example: 'Asia/Makassar', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  timezone?: string;
}

export class BusinessSetupDraftDto {
  @ApiProperty({ description: 'Draft UUID', example: '01912f7a-8b1e-7f3c-91d4-8d9e2a1b3c4d' })
  id!: string;

  @ApiProperty({ description: 'Merchant Profile UUID', example: '01912f7a-8b1e-7f3c-91d4-8d9e2a1b3c4e' })
  merchantProfileId!: string;

  @ApiPropertyOptional({ type: String, description: 'Source Onboarding Submission UUID', nullable: true })
  sourceOnboardingSubmissionId!: string | null;

  @ApiProperty({ type: BusinessSetupDraftPayloadDto })
  business!: BusinessSetupDraftPayloadDto;

  @ApiProperty({ type: OutletSetupDraftPayloadDto })
  outlet!: OutletSetupDraftPayloadDto;

  @ApiProperty({ type: [OperatingHourItemDto] })
  operatingHours!: OperatingHourItemDto[];

  @ApiProperty({ description: 'Current setup wizard step (1 to 4)', example: 1 })
  currentStep!: number;

  @ApiPropertyOptional({ type: String, description: 'Completion timestamp', nullable: true })
  completedAt!: string | null;

  @ApiProperty({ description: 'Creation ISO timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'Last update ISO timestamp' })
  updatedAt!: string;
}

export class SaveBusinessSetupDraftDto {
  @ApiPropertyOptional({ type: BusinessSetupDraftPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessSetupDraftPayloadDto)
  business?: Partial<BusinessSetupDraftPayloadDto>;

  @ApiPropertyOptional({ type: OutletSetupDraftPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OutletSetupDraftPayloadDto)
  outlet?: Partial<OutletSetupDraftPayloadDto>;

  @ApiPropertyOptional({ type: [OperatingHourItemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OperatingHourItemDto)
  operatingHours?: OperatingHourItemDto[];

  @ApiPropertyOptional({ type: Number, description: 'Current wizard step (1-4)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  currentStep?: number;
}

export class BusinessDto {
  @ApiProperty({ description: 'Business UUID' })
  id!: string;

  @ApiProperty({ description: 'Merchant Profile UUID' })
  merchantProfileId!: string;

  @ApiProperty({ description: 'Business Name', example: 'RM Manado Mantap' })
  name!: string;

  @ApiProperty({ description: 'Category Code', example: 'KULINER' })
  categoryCode!: string;

  @ApiPropertyOptional({ type: String, description: 'Business Description', nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ type: String, description: 'Source Onboarding Submission UUID', nullable: true })
  sourceOnboardingSubmissionId!: string | null;

  @ApiProperty({ description: 'Creation ISO timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'Last update ISO timestamp' })
  updatedAt!: string;
}

export class OutletDto {
  @ApiProperty({ description: 'Outlet UUID' })
  id!: string;

  @ApiProperty({ description: 'Business UUID' })
  businessId!: string;

  @ApiProperty({ description: 'Outlet Name' })
  name!: string;

  @ApiProperty({ description: 'Contact Phone (E.164)' })
  contactPhone!: string;

  @ApiProperty({ description: 'Province' })
  province!: string;

  @ApiProperty({ description: 'Regency or City' })
  regencyOrCity!: string;

  @ApiProperty({ description: 'District' })
  district!: string;

  @ApiProperty({ description: 'Village or Subdistrict' })
  villageOrSubdistrict!: string;

  @ApiProperty({ description: 'Physical address detail' })
  addressDetail!: string;

  @ApiPropertyOptional({ type: String, description: 'Postal code (nullable)', nullable: true })
  postalCode!: string | null;

  @ApiProperty({ description: 'WGS84 latitude' })
  latitude!: number;

  @ApiProperty({ description: 'WGS84 longitude' })
  longitude!: number;

  @ApiProperty({ description: 'IANA Timezone' })
  timezone!: string;

  @ApiProperty({ description: 'Is primary outlet flag', example: true })
  isPrimary!: boolean;

  @ApiProperty({ description: 'Creation ISO timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'Last update ISO timestamp' })
  updatedAt!: string;
}

export class OutletOperatingHoursDto {
  @ApiProperty({ description: 'Operating hour row UUID' })
  id!: string;

  @ApiProperty({ description: 'Outlet UUID' })
  outletId!: string;

  @ApiProperty({ description: 'Day of week (1=Monday, 7=Sunday)', example: 1 })
  dayOfWeek!: number;

  @ApiProperty({ description: 'Whether outlet is closed on this day', example: false })
  isClosed!: boolean;

  @ApiPropertyOptional({ type: String, description: 'Opening time (HH:mm)', nullable: true, example: '08:00' })
  openTime!: string | null;

  @ApiPropertyOptional({ type: String, description: 'Closing time (HH:mm)', nullable: true, example: '21:00' })
  closeTime!: string | null;

  @ApiProperty({ description: 'Creation ISO timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'Last update ISO timestamp' })
  updatedAt!: string;
}

export class BusinessSetupStatusResponseDto {
  @ApiProperty({ enum: BUSINESS_SETUP_STATES, description: 'Derived setup state' })
  state!: BusinessSetupState;

  @ApiProperty({ description: 'Merchant Profile UUID' })
  merchantProfileId!: string;

  @ApiProperty({ description: 'Merchant Profile Verification Status' })
  profileStatus!: string;

  @ApiPropertyOptional({ type: String, description: 'Business name snapshot from profile', nullable: true })
  businessName!: string | null;

  @ApiPropertyOptional({ type: BusinessSetupDraftDto, nullable: true })
  draft!: BusinessSetupDraftDto | null;

  @ApiPropertyOptional({ type: BusinessDto, nullable: true })
  business!: BusinessDto | null;

  @ApiPropertyOptional({ type: OutletDto, nullable: true })
  primaryOutlet!: OutletDto | null;

  @ApiPropertyOptional({ type: [OutletOperatingHoursDto], nullable: true })
  operatingHours!: OutletOperatingHoursDto[] | null;
}

export class CompleteBusinessSetupDto {
  @ApiProperty({ type: BusinessSetupDraftPayloadDto })
  @ValidateNested()
  @Type(() => BusinessSetupDraftPayloadDto)
  business!: {
    name: string;
    categoryCode: string;
    description?: string | null;
  };

  @ApiProperty({ type: OutletSetupDraftPayloadDto })
  @ValidateNested()
  @Type(() => OutletSetupDraftPayloadDto)
  outlet!: {
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

  @ApiProperty({ type: [OperatingHourItemDto] })
  @ValidateNested({ each: true })
  @Type(() => OperatingHourItemDto)
  operatingHours!: OperatingHourItemDto[];
}

export class BusinessSetupCompletionResponseDto {
  @ApiProperty({ example: 'COMPLETE' })
  state!: 'COMPLETE';

  @ApiProperty({ type: BusinessDto })
  business!: BusinessDto;

  @ApiProperty({ type: OutletDto })
  primaryOutlet!: OutletDto;

  @ApiProperty({ type: [OutletOperatingHoursDto] })
  operatingHours!: OutletOperatingHoursDto[];
}

export class UpdateBusinessDto {
  @ApiPropertyOptional({ type: String, description: 'Business Name', example: 'RM Manado Mantap', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ type: String, description: 'Category Code', example: 'KULINER', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  categoryCode?: string;

  @ApiPropertyOptional({ type: String, description: 'Description', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string | null;
}

export class UpdatePrimaryOutletDto {
  @ApiPropertyOptional({ type: String, description: 'Outlet Name', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ type: String, description: 'Contact Phone', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  contactPhone?: string;

  @ApiPropertyOptional({ type: String, description: 'Province', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  province?: string;

  @ApiPropertyOptional({ type: String, description: 'Regency or City', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  regencyOrCity?: string;

  @ApiPropertyOptional({ type: String, description: 'District', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  district?: string;

  @ApiPropertyOptional({ type: String, description: 'Village or Subdistrict', maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  villageOrSubdistrict?: string;

  @ApiPropertyOptional({ type: String, description: 'Address detail' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  addressDetail?: string;

  @ApiPropertyOptional({ type: String, description: 'Postal Code (optional)', nullable: true, maxLength: 16 })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  postalCode?: string | null;

  @ApiPropertyOptional({ type: Number, description: 'WGS84 Latitude' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ type: Number, description: 'WGS84 Longitude' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ type: String, description: 'IANA Timezone' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  timezone?: string;

  @ApiPropertyOptional({ type: [OperatingHourItemDto], description: 'Optional updated 7-day schedule' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OperatingHourItemDto)
  operatingHours?: OperatingHourItemDto[];
}

export class PrimaryOutletDetailResponseDto {
  @ApiProperty({ type: OutletDto })
  outlet!: OutletDto;

  @ApiProperty({ type: [OutletOperatingHoursDto] })
  operatingHours!: OutletOperatingHoursDto[];
}
