import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  PROFILE_VERIFICATION_STATUSES,
  type ProfileVerificationStatus,
} from '@platform/shared-types';

export class VerificationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by profile verification status',
    enum: PROFILE_VERIFICATION_STATUSES,
  })
  @IsOptional()
  @IsEnum(PROFILE_VERIFICATION_STATUSES)
  status?: ProfileVerificationStatus;

  @ApiPropertyOptional({
    type: String,
    description: 'Search query for phone number or display name',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
