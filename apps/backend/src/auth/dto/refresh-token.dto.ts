import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Opaque cryptographically high-entropy refresh token (required for mobile; optional for admin web using HttpOnly cookie)',
    example: 'd3b07384d113edec49eaa6238ad5ff00b1d063...64chars',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
