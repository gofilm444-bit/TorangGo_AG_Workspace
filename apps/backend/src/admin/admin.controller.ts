import { Controller, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthSessionGuard } from '../auth/guards/auth-session.guard.js';
import {
  AdminPermissionGuard,
  RequirePermission,
} from '../auth/guards/admin-permission.guard.js';
import { ADMIN_PERMISSIONS } from '../auth/admin/admin-permissions.js';
import { AdminService } from './admin.service.js';
import { AdminOverviewResponseDto } from './dto/admin-overview.dto.js';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard, AdminPermissionGuard)
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Retrieve platform operational overview counts' })
  @ApiResponse({ status: 200, type: AdminOverviewResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated session' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Missing admin:access / admin:read permissions or non-ADMIN_WEB audience',
  })
  async getOverview(): Promise<AdminOverviewResponseDto> {
    return this.adminService.getOverview();
  }
}
