import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, MaxLength, IsNotEmpty, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class ApproveVerificationActionDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Optional administrative note or approval reason (max 1000 characters)',
    maxLength: 1000,
    example: 'Identitas dan profil valid',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000, { message: 'reason must not exceed 1000 characters' })
  reason?: string;
}

export class ReasonRequiredVerificationActionDto {
  @ApiProperty({
    description: 'Mandatory administrative justification reason (min 3, max 1000 characters)',
    minLength: 3,
    maxLength: 1000,
    example: 'Data profil belum sesuai ketentuan operasional',
  })
  @IsNotEmpty({ message: 'reason is required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(3, { message: 'reason must be at least 3 characters long' })
  @MaxLength(1000, { message: 'reason must not exceed 1000 characters' })
  reason!: string;
}

export class ApproveMerchantVerificationActionDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Target submission UUID expected by admin to prevent stale approvals',
    example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d',
  })
  @IsOptional()
  @IsUUID('all', { message: 'expectedSubmissionId must be a valid UUID' })
  expectedSubmissionId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Optional administrative note or approval reason (max 1000 characters)',
    maxLength: 1000,
    example: 'Identitas dan profil valid',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(1000, { message: 'reason must not exceed 1000 characters' })
  reason?: string;
}

export class RejectMerchantVerificationActionDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Target submission UUID expected by admin to prevent stale rejections',
    example: '018f6c5e-8b1b-7a6c-9c3f-4e5f6a7b8c9d',
  })
  @IsOptional()
  @IsUUID('all', { message: 'expectedSubmissionId must be a valid UUID' })
  expectedSubmissionId?: string;

  @ApiProperty({
    description: 'Mandatory administrative justification reason (min 3, max 1000 characters)',
    minLength: 3,
    maxLength: 1000,
    example: 'Foto KTP buram dan tidak terbaca',
  })
  @IsNotEmpty({ message: 'reason is required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(3, { message: 'reason must be at least 3 characters long' })
  @MaxLength(1000, { message: 'reason must not exceed 1000 characters' })
  reason!: string;
}
