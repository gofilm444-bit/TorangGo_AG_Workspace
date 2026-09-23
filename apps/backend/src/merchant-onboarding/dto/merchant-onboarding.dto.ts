import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  type MerchantOnboardingGateState,
  type MerchantSubmissionStatus,
  MERCHANT_ONBOARDING_GATE_STATES,
  MERCHANT_SUBMISSION_STATUSES,
} from '@platform/shared-types';

export class SaveMerchantOnboardingDraftDto {
  @ApiPropertyOptional({ type: String, example: 'John Doe', maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(255)
  fullName?: string | null;

  @ApiPropertyOptional({ type: String, example: '7171012345678901', description: 'Up to 16-digit numeric NIK', nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @Matches(/^\d{0,16}$/, { message: 'nik must contain only up to 16 numeric digits' })
  nik?: string | null;

  @ApiPropertyOptional({ type: String, example: 'owner@example.com', nullable: true, maxLength: 255 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ type: String, example: '+6281987654321', nullable: true, maxLength: 64 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(64)
  alternateContact?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Warung Torang Mantap', maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(255)
  proposedBusinessName?: string | null;

  @ApiPropertyOptional({ type: String, example: 'KULINER', maxLength: 64, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(64)
  businessCategory?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Menyediakan masakan khas nusantara', nullable: true, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000)
  businessDescription?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Sulawesi Utara', maxLength: 128, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(128)
  province?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Kota Manado', maxLength: 128, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(128)
  regencyOrCity?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Wenang', maxLength: 128, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(128)
  district?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Tikala Baru', maxLength: 128, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(128)
  villageOrSubdistrict?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Jl. Sam Ratulangi No. 123', maxLength: 1000, nullable: true })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === null || value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000)
  addressDetail?: string | null;
}

export class SubmitMerchantOnboardingDto {
  @ApiProperty({ example: true, description: 'Confirmation that supplied data is true and accurate' })
  @IsBoolean()
  @IsNotEmpty()
  dataAccuracyAccepted!: boolean;

  @ApiProperty({ example: true, description: 'Acceptance of Merchant Terms & Conditions' })
  @IsBoolean()
  @IsNotEmpty()
  merchantTermsAccepted!: boolean;

  @ApiProperty({ example: true, description: 'Consent for personal data processing and privacy policy' })
  @IsBoolean()
  @IsNotEmpty()
  privacyConsentAccepted!: boolean;
}

export class MerchantOnboardingDocumentDto {
  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  id!: string;

  @ApiProperty({ example: 'KTP_FRONT' })
  documentType!: string;

  @ApiProperty({ example: 'ktp_depan.jpg' })
  sanitizedOriginalFilename!: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType!: string;

  @ApiProperty({ example: 1048576 })
  sizeBytes!: number;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  createdAt!: string;
}

export class MerchantOnboardingDraftDto {
  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  id!: string;

  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  userId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'John Doe' })
  fullName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '7171012345678901' })
  nik!: string | null;

  @ApiProperty({ example: '+6281234567890', description: 'Authoritative account phone number (read-only)' })
  accountPhone!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'owner@example.com' })
  email!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '+6281987654321' })
  alternateContact!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Warung Torang Mantap' })
  proposedBusinessName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'KULINER' })
  businessCategory!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Menyediakan masakan nusantara' })
  businessDescription!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Sulawesi Utara' })
  province!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Kota Manado' })
  regencyOrCity!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Wenang' })
  district!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Tikala Baru' })
  villageOrSubdistrict!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Jl. Sam Ratulangi No. 123' })
  addressDetail!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  ktpDocumentId!: string | null;

  @ApiPropertyOptional({ type: () => MerchantOnboardingDocumentDto, nullable: true })
  ktpDocument?: MerchantOnboardingDocumentDto | null;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  updatedAt!: string;
}

export class MerchantOnboardingSubmissionDto {
  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  id!: string;

  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  merchantProfileId!: string;

  @ApiProperty({ example: 1 })
  revisionNumber!: number;

  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  supersedesSubmissionId!: string | null;

  @ApiProperty({ enum: MERCHANT_SUBMISSION_STATUSES, example: 'PENDING' })
  status!: MerchantSubmissionStatus;

  @ApiProperty({ example: 'John Doe' })
  fullName!: string;

  @ApiProperty({ example: '************8901', description: 'Masked NIK by default' })
  maskedNik!: string;

  @ApiProperty({ example: '+6281234567890' })
  accountPhoneSnapshot!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'owner@example.com' })
  email!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '+6281987654321' })
  alternateContact!: string | null;

  @ApiProperty({ example: 'Warung Torang Mantap' })
  proposedBusinessName!: string;

  @ApiProperty({ example: 'KULINER' })
  businessCategory!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Menyediakan masakan nusantara' })
  businessDescription!: string | null;

  @ApiProperty({ example: 'Sulawesi Utara' })
  province!: string;

  @ApiProperty({ example: 'Kota Manado' })
  regencyOrCity!: string;

  @ApiProperty({ example: 'Wenang' })
  district!: string;

  @ApiProperty({ example: 'Tikala Baru' })
  villageOrSubdistrict!: string;

  @ApiProperty({ example: 'Jl. Sam Ratulangi No. 123' })
  addressDetail!: string;

  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  ktpDocumentId!: string;

  @ApiPropertyOptional({ type: () => MerchantOnboardingDocumentDto, nullable: true })
  ktpDocument?: MerchantOnboardingDocumentDto | null;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  dataAccuracyAcceptedAt!: string;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  merchantTermsAcceptedAt!: string;

  @ApiProperty({ example: '1.0' })
  merchantTermsVersion!: string;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  privacyConsentAcceptedAt!: string;

  @ApiProperty({ example: '1.0' })
  privacyNoticeVersion!: string;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  submittedAt!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  rejectionReason?: string | null;
}

export class MerchantOnboardingStatusResponseDto {
  @ApiProperty({ enum: MERCHANT_ONBOARDING_GATE_STATES, example: 'NOT_STARTED' })
  state!: MerchantOnboardingGateState;

  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  merchantProfileId!: string | null;

  @ApiProperty({ example: '+6281234567890' })
  accountPhone!: string;

  @ApiPropertyOptional({ type: () => MerchantOnboardingDraftDto, nullable: true })
  draft!: MerchantOnboardingDraftDto | null;

  @ApiPropertyOptional({ type: () => MerchantOnboardingSubmissionDto, nullable: true })
  currentSubmission!: MerchantOnboardingSubmissionDto | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  rejectionReason!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  rejectionDate?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  suspensionReason?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  suspensionDate?: string | null;
}
