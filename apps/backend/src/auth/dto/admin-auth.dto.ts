import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({
    description: 'Admin username or email address',
    example: 'admin@toranggo.com',
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({
    description: 'Admin password',
    example: 'SecureAdminPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class AdminMfaVerifyDto {
  @ApiProperty({
    description: 'Ephemeral MFA challenge token obtained from /login',
    example: '018f3a22-1234-7000-8000-abcdef012345',
  })
  @IsString()
  @IsNotEmpty()
  mfa_challenge_token!: string;

  @ApiProperty({
    description: 'Six-digit TOTP code or formatted recovery code',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
