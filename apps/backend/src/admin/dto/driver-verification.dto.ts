import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PROFILE_VERIFICATION_STATUSES,
  type ProfileVerificationStatus,
} from '@platform/shared-types';
import { VerificationAuditLogItemDto } from './verification-audit.dto.js';

export class DriverVerificationItemDto {
  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  profileId!: string;

  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  userId!: string;

  @ApiProperty({ example: '+6281234567890' })
  phone!: string;

  @ApiPropertyOptional({ type: String, example: 'Budi Santoso', nullable: true })
  fullName?: string | null;

  @ApiPropertyOptional({ type: String, example: 'Budi Santoso', nullable: true })
  displayName?: string | null;

  @ApiProperty({ enum: PROFILE_VERIFICATION_STATUSES, example: 'PENDING' })
  status!: ProfileVerificationStatus;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  updatedAt!: string;
}

export class DriverVerificationListResponseDto {
  @ApiProperty({ type: [DriverVerificationItemDto] })
  items!: DriverVerificationItemDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;
}

export class DriverVerificationDetailResponseDto extends DriverVerificationItemDto {
  @ApiProperty({ type: [VerificationAuditLogItemDto] })
  auditLogs!: VerificationAuditLogItemDto[];
}
