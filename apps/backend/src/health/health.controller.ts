import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import type { ApiHealthStatus } from '@platform/shared-types';

export class HealthResponseDto implements ApiHealthStatus {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'API Health Check',
    description: 'Returns operational health status of the TorangGo API backend',
  })
  @ApiOkResponse({
    description: 'API is healthy and operational',
    type: HealthResponseDto,
  })
  getHealth(): ApiHealthStatus {
    return {
      status: 'ok',
    };
  }
}
