import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestOtpResponseDto {
  @ApiProperty({ example: '018f3a22-1234-7000-8000-abcdef012345' })
  challenge_id!: string;

  @ApiProperty({ example: 60 })
  resend_available_in_seconds!: number;
}

export class CustomerProfileSummaryDto {
  @ApiProperty({ example: '018f3a22-1234-7000-8000-abcdef012345' })
  id!: string;

  @ApiPropertyOptional({ example: 'Budi Santoso' })
  name?: string | null;
}

export class MerchantProfileSummaryDto {
  @ApiProperty({ example: '018f3a22-1234-7000-8000-abcdef012345' })
  id!: string;

  @ApiPropertyOptional({ example: 'RM Manado Asli' })
  business_name?: string | null;

  @ApiProperty({ example: 'PENDING' })
  status!: string;
}

export class DriverProfileSummaryDto {
  @ApiProperty({ example: '018f3a22-1234-7000-8000-abcdef012345' })
  id!: string;

  @ApiPropertyOptional({ example: 'Johan Wowor' })
  full_name?: string | null;

  @ApiProperty({ example: 'PENDING' })
  status!: string;
}

export class MobileUserSummaryDto {
  @ApiProperty({ example: '018f3a22-1234-7000-8000-abcdef012345' })
  id!: string;

  @ApiProperty({ example: '+6281234567890' })
  phone!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiPropertyOptional({ type: CustomerProfileSummaryDto })
  customer_profile?: CustomerProfileSummaryDto | null;

  @ApiPropertyOptional({ type: MerchantProfileSummaryDto })
  merchant_profile?: MerchantProfileSummaryDto | null;

  @ApiPropertyOptional({ type: DriverProfileSummaryDto })
  driver_profile?: DriverProfileSummaryDto | null;
}

export class MobileAuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token!: string;

  @ApiProperty({ example: 'd3b07384d113edec49eaa6238ad5ff00b1d063...' })
  refresh_token!: string;

  @ApiProperty({ example: 'Bearer' })
  token_type!: string;

  @ApiProperty({ example: 900 })
  expires_in_seconds!: number;

  @ApiProperty({ example: 'CUSTOMER_APP' })
  audience!: string;

  @ApiProperty({ type: MobileUserSummaryDto })
  user!: MobileUserSummaryDto;
}

export class RefreshTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token!: string;

  @ApiProperty({ example: 'd3b07384d113edec49eaa6238ad5ff00b1d063...' })
  refresh_token!: string;

  @ApiProperty({ example: 'Bearer' })
  token_type!: string;

  @ApiProperty({ example: 900 })
  expires_in_seconds!: number;

  @ApiProperty({ example: 'CUSTOMER_APP' })
  audience!: string;
}

export class AdminLoginResponseDto {
  @ApiProperty({ example: true })
  mfa_required!: boolean;

  @ApiProperty({ example: '018f3a22-1234-7000-8000-abcdef012345' })
  mfa_challenge_token!: string;
}

export class AdminAccountSummaryDto {
  @ApiProperty({ example: '018f3a22-1234-7000-8000-abcdef012345' })
  id!: string;

  @ApiProperty({ example: 'admin' })
  username!: string;

  @ApiProperty({ example: 'admin@toranggo.com' })
  email!: string;

  @ApiProperty({ example: ['SUPER_ADMIN'] })
  roles!: string[];

  @ApiProperty({ example: ['admin:access', 'admin:manage'] })
  permissions!: string[];
}

export class AdminMfaVerifyResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token!: string;

  @ApiProperty({ example: 'c8f1e091...' })
  csrf_token!: string;

  @ApiProperty({ example: 'Bearer' })
  token_type!: string;

  @ApiProperty({ example: 900 })
  expires_in_seconds!: number;

  @ApiProperty({ type: AdminAccountSummaryDto })
  admin!: AdminAccountSummaryDto;
}

export class CsrfTokenResponseDto {
  @ApiProperty({ example: 'c8f1e091...' })
  csrf_token!: string;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
