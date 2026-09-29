import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
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
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthSessionGuard } from '../auth/guards/auth-session.guard.js';
import { AudienceGuard, RequireAudience } from '../auth/guards/audience.guard.js';
import { Idempotent } from '../common/idempotency/idempotent.decorator.js';
import { MerchantBusinessService } from './merchant-business.service.js';
import {
  BusinessSetupStatusResponseDto,
  BusinessSetupDraftDto,
  SaveBusinessSetupDraftDto,
  CompleteBusinessSetupDto,
  BusinessSetupCompletionResponseDto,
  BusinessDto,
  UpdateBusinessDto,
  UpdatePrimaryOutletDto,
  PrimaryOutletDetailResponseDto,
} from './dto/merchant-business.dto.js';

@ApiTags('Merchant Business')
@ApiBearerAuth()
@Controller('merchant')
@UseGuards(AuthSessionGuard, AudienceGuard)
@RequireAudience('PARTNER_APP', 'MERCHANT_APP')
export class MerchantBusinessController {
  constructor(private readonly businessService: MerchantBusinessService) {}

  @Get('business-setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current business setup status, active draft, or completed operational entities' })
  @ApiResponse({ status: 200, type: BusinessSetupStatusResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden (profile not found or non-approved status)' })
  async getSetupStatus(@Req() req: Request): Promise<BusinessSetupStatusResponseDto> {
    const userId = req.user!.id;
    return this.businessService.getSetupStatus(userId);
  }

  @Post('business-setup/draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or initialize active business setup draft' })
  @ApiResponse({ status: 200, type: BusinessSetupDraftDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires APPROVED merchant profile)' })
  @ApiResponse({ status: 409, description: 'Conflict (setup already complete)' })
  async getOrCreateDraft(@Req() req: Request): Promise<BusinessSetupDraftDto> {
    const userId = req.user!.id;
    return this.businessService.getOrCreateDraft(userId);
  }

  @Patch('business-setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autosave fields in the active business setup draft' })
  @ApiResponse({ status: 200, type: BusinessSetupDraftDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires APPROVED merchant profile)' })
  @ApiResponse({ status: 409, description: 'Conflict (setup already complete)' })
  async saveDraft(
    @Req() req: Request,
    @Body() body: SaveBusinessSetupDraftDto,
  ): Promise<BusinessSetupDraftDto> {
    const userId = req.user!.id;
    return this.businessService.saveDraft(userId, body);
  }

  @Post('business-setup/complete')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ summary: 'Atomically complete business and primary outlet setup (requires Idempotency-Key)' })
  @ApiResponse({ status: 200, type: BusinessSetupCompletionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error in business, outlet address, coordinates, or schedule' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires APPROVED merchant profile)' })
  async completeSetup(
    @Req() req: Request,
    @Body() body: CompleteBusinessSetupDto,
  ): Promise<BusinessSetupCompletionResponseDto> {
    const userId = req.user!.id;
    return this.businessService.completeSetup(userId, body);
  }

  @Get('business')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get operational business details' })
  @ApiResponse({ status: 200, type: BusinessDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 404, description: 'Business not found / setup not completed' })
  async getBusiness(@Req() req: Request): Promise<BusinessDto> {
    const userId = req.user!.id;
    return this.businessService.getBusiness(userId);
  }

  @Patch('business')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update operational business details (does not mutate onboarding submissions)' })
  @ApiResponse({ status: 200, type: BusinessDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires APPROVED merchant profile)' })
  @ApiResponse({ status: 404, description: 'Business not found' })
  async updateBusiness(
    @Req() req: Request,
    @Body() body: UpdateBusinessDto,
  ): Promise<BusinessDto> {
    const userId = req.user!.id;
    return this.businessService.updateBusiness(userId, body);
  }

  @Get('outlets/primary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get primary outlet details and weekly operating hours' })
  @ApiResponse({ status: 200, type: PrimaryOutletDetailResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 404, description: 'Primary outlet not found' })
  async getPrimaryOutlet(
    @Req() req: Request,
  ): Promise<PrimaryOutletDetailResponseDto> {
    const userId = req.user!.id;
    return this.businessService.getPrimaryOutlet(userId);
  }

  @Patch('outlets/primary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update primary outlet physical address, coordinates, timezone, or weekly schedule' })
  @ApiResponse({ status: 200, type: PrimaryOutletDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden (requires APPROVED merchant profile)' })
  @ApiResponse({ status: 404, description: 'Primary outlet not found' })
  async updatePrimaryOutlet(
    @Req() req: Request,
    @Body() body: UpdatePrimaryOutletDto,
  ): Promise<PrimaryOutletDetailResponseDto> {
    const userId = req.user!.id;
    return this.businessService.updatePrimaryOutlet(userId, body);
  }
}
