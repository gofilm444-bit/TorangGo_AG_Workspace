import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthSessionGuard } from '../auth/guards/auth-session.guard.js';
import {
  AdminPermissionGuard,
  RequirePermission,
} from '../auth/guards/admin-permission.guard.js';
import { ADMIN_PERMISSIONS } from '../auth/admin/admin-permissions.js';
import { Idempotent } from '../common/idempotency/idempotent.decorator.js';
import { AdminVerificationService } from './admin-verification.service.js';
import { VerificationQueryDto } from './dto/verification-query.dto.js';
import {
  ApproveVerificationActionDto,
  ReasonRequiredVerificationActionDto,
} from './dto/verification-action.dto.js';
import {
  MerchantVerificationListResponseDto,
  MerchantVerificationDetailResponseDto,
} from './dto/merchant-verification.dto.js';
import {
  DriverVerificationListResponseDto,
  DriverVerificationDetailResponseDto,
} from './dto/driver-verification.dto.js';

@ApiTags('Admin Verification')
@ApiBearerAuth()
@Controller('admin/verifications')
@UseGuards(AuthSessionGuard, AdminPermissionGuard)
export class AdminVerificationController {
  constructor(private readonly verificationService: AdminVerificationService) {}

  private extractRequestId(req: Request): string | undefined {
    return (req as unknown as { id?: string }).id ?? (req.headers['x-request-id'] as string) ?? undefined;
  }

  // ===========================================================================
  // Merchant Verification Endpoints
  // ===========================================================================

  @Get('merchants')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List merchant verification profiles with filtering and search' })
  @ApiResponse({ status: 200, type: MerchantVerificationListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listMerchants(
    @Query() query: VerificationQueryDto,
  ): Promise<MerchantVerificationListResponseDto> {
    return this.verificationService.listMerchants(query);
  }

  @Get('merchants/:profileId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get merchant verification profile detail with audit history' })
  @ApiParam({ name: 'profileId', description: 'Merchant profile UUID' })
  @ApiResponse({ status: 200, type: MerchantVerificationDetailResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  async getMerchantDetail(
    @Param('profileId') profileId: string,
  ): Promise<MerchantVerificationDetailResponseDto> {
    return this.verificationService.getMerchantDetail(profileId);
  }

  @Post('merchants/:profileId/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE)
  @ApiOperation({ summary: 'Approve a pending merchant profile' })
  @ApiParam({ name: 'profileId', description: 'Merchant profile UUID' })
  @ApiResponse({ status: 200, type: MerchantVerificationDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or idempotency conflict' })
  async approveMerchant(
    @Param('profileId') profileId: string,
    @Body() body: ApproveVerificationActionDto,
    @Req() req: Request,
  ): Promise<MerchantVerificationDetailResponseDto> {
    const actorAdminId = req.user!.id!;
    const requestId = this.extractRequestId(req);
    return this.verificationService.approveMerchant(profileId, actorAdminId, body.reason, requestId);
  }

  @Post('merchants/:profileId/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE)
  @ApiOperation({ summary: 'Reject a pending merchant profile with reason' })
  @ApiParam({ name: 'profileId', description: 'Merchant profile UUID' })
  @ApiResponse({ status: 200, type: MerchantVerificationDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request or reason missing' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or idempotency conflict' })
  async rejectMerchant(
    @Param('profileId') profileId: string,
    @Body() body: ReasonRequiredVerificationActionDto,
    @Req() req: Request,
  ): Promise<MerchantVerificationDetailResponseDto> {
    const actorAdminId = req.user!.id!;
    const requestId = this.extractRequestId(req);
    return this.verificationService.rejectMerchant(profileId, actorAdminId, body.reason, requestId);
  }

  @Post('merchants/:profileId/suspend')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE, ADMIN_PERMISSIONS.OPS)
  @ApiOperation({ summary: 'Suspend an approved merchant profile with reason' })
  @ApiParam({ name: 'profileId', description: 'Merchant profile UUID' })
  @ApiResponse({ status: 200, type: MerchantVerificationDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request or reason missing' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or idempotency conflict' })
  async suspendMerchant(
    @Param('profileId') profileId: string,
    @Body() body: ReasonRequiredVerificationActionDto,
    @Req() req: Request,
  ): Promise<MerchantVerificationDetailResponseDto> {
    const actorAdminId = req.user!.id!;
    const requestId = this.extractRequestId(req);
    return this.verificationService.suspendMerchant(profileId, actorAdminId, body.reason, requestId);
  }

  @Post('merchants/:profileId/reactivate')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE, ADMIN_PERMISSIONS.OPS)
  @ApiOperation({ summary: 'Reactivate a suspended merchant profile with reason' })
  @ApiParam({ name: 'profileId', description: 'Merchant profile UUID' })
  @ApiResponse({ status: 200, type: MerchantVerificationDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request or reason missing' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Merchant profile not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or idempotency conflict' })
  async reactivateMerchant(
    @Param('profileId') profileId: string,
    @Body() body: ReasonRequiredVerificationActionDto,
    @Req() req: Request,
  ): Promise<MerchantVerificationDetailResponseDto> {
    const actorAdminId = req.user!.id!;
    const requestId = this.extractRequestId(req);
    return this.verificationService.reactivateMerchant(profileId, actorAdminId, body.reason, requestId);
  }

  // ===========================================================================
  // Driver Verification Endpoints
  // ===========================================================================

  @Get('drivers')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List driver verification profiles with filtering and search' })
  @ApiResponse({ status: 200, type: DriverVerificationListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listDrivers(
    @Query() query: VerificationQueryDto,
  ): Promise<DriverVerificationListResponseDto> {
    return this.verificationService.listDrivers(query);
  }

  @Get('drivers/:profileId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get driver verification profile detail with audit history' })
  @ApiParam({ name: 'profileId', description: 'Driver profile UUID' })
  @ApiResponse({ status: 200, type: DriverVerificationDetailResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  async getDriverDetail(
    @Param('profileId') profileId: string,
  ): Promise<DriverVerificationDetailResponseDto> {
    return this.verificationService.getDriverDetail(profileId);
  }

  @Post('drivers/:profileId/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE)
  @ApiOperation({ summary: 'Approve a pending driver profile' })
  @ApiParam({ name: 'profileId', description: 'Driver profile UUID' })
  @ApiResponse({ status: 200, type: DriverVerificationDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or idempotency conflict' })
  async approveDriver(
    @Param('profileId') profileId: string,
    @Body() body: ApproveVerificationActionDto,
    @Req() req: Request,
  ): Promise<DriverVerificationDetailResponseDto> {
    const actorAdminId = req.user!.id!;
    const requestId = this.extractRequestId(req);
    return this.verificationService.approveDriver(profileId, actorAdminId, body.reason, requestId);
  }

  @Post('drivers/:profileId/reject')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE)
  @ApiOperation({ summary: 'Reject a pending driver profile with reason' })
  @ApiParam({ name: 'profileId', description: 'Driver profile UUID' })
  @ApiResponse({ status: 200, type: DriverVerificationDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request or reason missing' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or idempotency conflict' })
  async rejectDriver(
    @Param('profileId') profileId: string,
    @Body() body: ReasonRequiredVerificationActionDto,
    @Req() req: Request,
  ): Promise<DriverVerificationDetailResponseDto> {
    const actorAdminId = req.user!.id!;
    const requestId = this.extractRequestId(req);
    return this.verificationService.rejectDriver(profileId, actorAdminId, body.reason, requestId);
  }

  @Post('drivers/:profileId/suspend')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE, ADMIN_PERMISSIONS.OPS)
  @ApiOperation({ summary: 'Suspend an approved driver profile with reason' })
  @ApiParam({ name: 'profileId', description: 'Driver profile UUID' })
  @ApiResponse({ status: 200, type: DriverVerificationDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request or reason missing' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or idempotency conflict' })
  async suspendDriver(
    @Param('profileId') profileId: string,
    @Body() body: ReasonRequiredVerificationActionDto,
    @Req() req: Request,
  ): Promise<DriverVerificationDetailResponseDto> {
    const actorAdminId = req.user!.id!;
    const requestId = this.extractRequestId(req);
    return this.verificationService.suspendDriver(profileId, actorAdminId, body.reason, requestId);
  }

  @Post('drivers/:profileId/reactivate')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @RequirePermission(ADMIN_PERMISSIONS.ACCESS, ADMIN_PERMISSIONS.WRITE, ADMIN_PERMISSIONS.OPS)
  @ApiOperation({ summary: 'Reactivate a suspended driver profile with reason' })
  @ApiParam({ name: 'profileId', description: 'Driver profile UUID' })
  @ApiResponse({ status: 200, type: DriverVerificationDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request or reason missing' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Driver profile not found' })
  @ApiResponse({ status: 409, description: 'Invalid transition or idempotency conflict' })
  async reactivateDriver(
    @Param('profileId') profileId: string,
    @Body() body: ReasonRequiredVerificationActionDto,
    @Req() req: Request,
  ): Promise<DriverVerificationDetailResponseDto> {
    const actorAdminId = req.user!.id!;
    const requestId = this.extractRequestId(req);
    return this.verificationService.reactivateDriver(profileId, actorAdminId, body.reason, requestId);
  }
}
