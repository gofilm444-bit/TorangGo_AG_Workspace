import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, IsIn, IsOptional } from 'class-validator';
import type { AppAudience } from '@platform/shared-types';

export class RequestMobileOtpDto {
  @ApiProperty({
    description: 'User phone number in international E.164 format',
    example: '+6281234567890',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be a valid E.164 phone number starting with + followed by 7-15 digits',
  })
  phone!: string;

  @ApiProperty({
    description: 'Target mobile application audience',
    enum: ['CUSTOMER_APP', 'PARTNER_APP', 'MERCHANT_APP', 'DRIVER_APP'],
    example: 'CUSTOMER_APP',
  })
  @IsString()
  @IsIn(['CUSTOMER_APP', 'PARTNER_APP', 'MERCHANT_APP', 'DRIVER_APP'], {
    message: 'audience must be CUSTOMER_APP, PARTNER_APP, MERCHANT_APP, or DRIVER_APP',
  })
  audience!: AppAudience;

  @ApiPropertyOptional({
    description: 'Client installation / device correlation identifier',
    example: 'inst_abc12345678',
  })
  @IsOptional()
  @IsString()
  installation_id?: string;
}

export class VerifyMobileOtpDto {
  @ApiProperty({
    description: 'User phone number in international E.164 format',
    example: '+6281234567890',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be a valid E.164 phone number',
  })
  phone!: string;

  @ApiProperty({
    description: 'Target mobile application audience',
    enum: ['CUSTOMER_APP', 'PARTNER_APP', 'MERCHANT_APP', 'DRIVER_APP'],
    example: 'CUSTOMER_APP',
  })
  @IsString()
  @IsIn(['CUSTOMER_APP', 'PARTNER_APP', 'MERCHANT_APP', 'DRIVER_APP'])
  audience!: AppAudience;

  @ApiProperty({
    description: 'Six-digit numeric OTP verification code',
    example: '123456',
  })
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'otp must be exactly 6 numeric digits',
  })
  otp!: string;

  @ApiPropertyOptional({
    description: 'Client installation / device correlation identifier',
    example: 'inst_abc12345678',
  })
  @IsOptional()
  @IsString()
  installation_id?: string;
}
