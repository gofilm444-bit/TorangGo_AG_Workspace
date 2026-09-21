import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ProfileType, ProfileVerificationAction, ProfileVerificationStatus } from '@platform/shared-types';

export class VerificationAuditLogItemDto {
  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  id!: string;

  @ApiProperty({ enum: ['MERCHANT', 'DRIVER'], example: 'MERCHANT' })
  profileType!: ProfileType;

  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  profileId!: string;

  @ApiProperty({ example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d' })
  actorAdminId!: string;

  @ApiPropertyOptional({ type: String, example: 'admin_ops', description: 'Admin username when available', nullable: true })
  actorAdminUsername?: string;

  @ApiProperty({ enum: ['APPROVE', 'REJECT', 'SUSPEND', 'REACTIVATE'], example: 'APPROVE' })
  action!: ProfileVerificationAction;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], example: 'PENDING' })
  fromStatus!: ProfileVerificationStatus;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], example: 'APPROVED' })
  toStatus!: ProfileVerificationStatus;

  @ApiPropertyOptional({ type: String, example: 'Identitas valid', nullable: true })
  reason?: string | null;

  @ApiPropertyOptional({ type: String, example: 'req-12345', nullable: true })
  requestId?: string | null;

  @ApiProperty({ example: '2026-09-21T03:00:00.000Z' })
  createdAt!: string;
}
