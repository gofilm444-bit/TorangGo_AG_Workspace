import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PROFILE_VERIFICATION_STATUSES,
  type ProfileVerificationStatus,
} from '@platform/shared-types';
import { VerificationAuditLogItemDto } from './verification-audit.dto.js';
import { MerchantOnboardingSubmissionDto } from '../../merchant-onboarding/dto/merchant-onboarding.dto.js';
import {
  BusinessDto,
  OutletDto,
  OutletOperatingHoursDto,
} from '../../merchant-business/dto/merchant-business.dto.js';

export class AdminMerchantOperationalSummaryDto {
  @ApiProperty({ enum: ['NOT_STARTED', 'DRAFT', 'COMPLETE'], example: 'COMPLETE' })
  setupState!: 'NOT_STARTED' | 'DRAFT' | 'COMPLETE';

  @ApiPropertyOptional({ type: BusinessDto, nullable: true })
  business!: BusinessDto | null;

  @ApiPropertyOptional({ type: OutletDto, nullable: true })
  primaryOutlet!: OutletDto | null;

  @ApiPropertyOptional({ type: [OutletOperatingHoursDto], nullable: true })
  operatingHours!: OutletOperatingHoursDto[] | null;
}

export class MerchantVerificationItemDto {
  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  profileId!: string;

  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  userId!: string;

  @ApiProperty({ example: '+6281234567890' })
  phone!: string;

  @ApiPropertyOptional({ type: String, example: 'Warung Kopi Torang', nullable: true })
  businessName?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Warung Kopi Torang', nullable: true })
  displayName?: string | null;

  @ApiProperty({ enum: PROFILE_VERIFICATION_STATUSES, example: 'PENDING' })
  status!: ProfileVerificationStatus;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  updatedAt!: string;
}

export class MerchantVerificationListResponseDto {
  @ApiProperty({ type: [MerchantVerificationItemDto] })
  items!: MerchantVerificationItemDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;
}

export class MerchantVerificationDetailResponseDto extends MerchantVerificationItemDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  currentSubmissionId?: string | null;

  @ApiPropertyOptional({ type: () => MerchantOnboardingSubmissionDto, nullable: true })
  currentSubmission?: MerchantOnboardingSubmissionDto | null;

  @ApiProperty({ type: [VerificationAuditLogItemDto] })
  auditLogs!: VerificationAuditLogItemDto[];

  @ApiPropertyOptional({ type: AdminMerchantOperationalSummaryDto, nullable: true })
  operationalSummary?: AdminMerchantOperationalSummaryDto | null;
}

export class RevealNikResponseDto {
  @ApiProperty({ example: '7171012345678901', description: 'Full 16-digit unmasked NIK' })
  nik!: string;
}
