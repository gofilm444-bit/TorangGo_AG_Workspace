import { ApiProperty } from '@nestjs/swagger';

export class AdminOverviewUsersDto {
  @ApiProperty({ example: 0, description: 'Total registered user accounts' })
  total!: number;
}

export class AdminOverviewMerchantsDto {
  @ApiProperty({ example: 0, description: 'Total registered merchant profiles' })
  total!: number;

  @ApiProperty({ example: 0, description: 'Merchants pending verification' })
  pending!: number;

  @ApiProperty({ example: 0, description: 'Approved active merchants' })
  approved!: number;

  @ApiProperty({ example: 0, description: 'Rejected merchant applications' })
  rejected!: number;

  @ApiProperty({ example: 0, description: 'Suspended merchant accounts' })
  suspended!: number;
}

export class AdminOverviewDriversDto {
  @ApiProperty({ example: 0, description: 'Total registered driver profiles' })
  total!: number;

  @ApiProperty({ example: 0, description: 'Drivers pending verification' })
  pending!: number;

  @ApiProperty({ example: 0, description: 'Approved active drivers' })
  approved!: number;

  @ApiProperty({ example: 0, description: 'Rejected driver applications' })
  rejected!: number;

  @ApiProperty({ example: 0, description: 'Suspended driver accounts' })
  suspended!: number;
}

export class AdminOverviewResponseDto {
  @ApiProperty({ type: AdminOverviewUsersDto })
  users!: AdminOverviewUsersDto;

  @ApiProperty({ type: AdminOverviewMerchantsDto })
  merchants!: AdminOverviewMerchantsDto;

  @ApiProperty({ type: AdminOverviewDriversDto })
  drivers!: AdminOverviewDriversDto;
}
