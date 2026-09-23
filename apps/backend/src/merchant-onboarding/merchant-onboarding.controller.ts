import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AuthSessionGuard } from '../auth/guards/auth-session.guard.js';
import { AudienceGuard, RequireAudience } from '../auth/guards/audience.guard.js';
import { Idempotent } from '../common/idempotency/idempotent.decorator.js';
import { BadRequestError } from '../common/errors/app-error.js';
import { MerchantOnboardingService } from './merchant-onboarding.service.js';
import {
  MerchantOnboardingStatusResponseDto,
  MerchantOnboardingDraftDto,
  SaveMerchantOnboardingDraftDto,
  MerchantOnboardingDocumentDto,
  SubmitMerchantOnboardingDto,
} from './dto/merchant-onboarding.dto.js';

interface ExpressUploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('Merchant Onboarding')
@ApiBearerAuth()
@Controller('merchant/onboarding')
@UseGuards(AuthSessionGuard)
@UseGuards(AuthSessionGuard, AudienceGuard)
@RequireAudience('PARTNER_APP', 'MERCHANT_APP')
export class MerchantOnboardingController {
  constructor(private readonly onboardingService: MerchantOnboardingService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current merchant onboarding gate state and data' })
  @ApiResponse({ status: 200, type: MerchantOnboardingStatusResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  async getStatus(@Req() req: Request): Promise<MerchantOnboardingStatusResponseDto> {
    const userId = req.user!.id;
    return this.onboardingService.getOnboardingStatus(userId);
  }

  @Post('draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or create single active onboarding draft' })
  @ApiResponse({ status: 200, type: MerchantOnboardingDraftDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 409, description: 'Profile already pending, approved, or suspended' })
  async getOrCreateDraft(@Req() req: Request): Promise<MerchantOnboardingDraftDto> {
    const userId = req.user!.id;
    return this.onboardingService.getOrCreateDraft(userId);
  }

  @Patch('draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autosave fields in the active onboarding draft' })
  @ApiResponse({ status: 200, type: MerchantOnboardingDraftDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  @ApiResponse({ status: 409, description: 'Cannot edit in current profile state' })
  async saveDraft(
    @Req() req: Request,
    @Body() body: SaveMerchantOnboardingDraftDto,
  ): Promise<MerchantOnboardingDraftDto> {
    const userId = req.user!.id;
    return this.onboardingService.saveDraft(userId, body);
  }

  @Post('draft/ktp')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  @ApiOperation({ summary: 'Upload or replace front-side KTP for the active draft (JPEG/PNG, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Front-side KTP image file (JPEG or PNG, max 5 MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, type: MerchantOnboardingDocumentDto })
  @ApiResponse({ status: 400, description: 'Invalid file, invalid magic bytes, or size exceeds 5MB' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async uploadKtp(
    @Req() req: Request,
    @UploadedFile() file?: ExpressUploadedFile,
  ): Promise<MerchantOnboardingDocumentDto> {
    const userId = req.user!.id;
    if (!file || !file.buffer) {
      throw new BadRequestError('File KTP wajib diunggah');
    }
    return this.onboardingService.uploadDraftKtp(userId, file.buffer, file.originalname);
  }

  @Get('documents/:documentId/content')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stream private KTP image content for document owner' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Document image binary stream' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Forbidden (not document owner)' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocumentContent(
    @Req() req: Request,
    @Res() res: Response,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    const userId = req.user!.id;
    const doc = await this.onboardingService.getDocumentContentForOwner(userId, documentId);

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Length', doc.sizeBytes);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Content-Disposition', 'inline');

    doc.stream.pipe(res);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ summary: 'Submit onboarding draft for administrative verification' })
  @ApiResponse({ status: 200, type: MerchantOnboardingStatusResponseDto })
  @ApiResponse({ status: 400, description: 'Incomplete draft or missing mandatory consents' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 409, description: 'Conflict: profile already in review or active' })
  async submit(
    @Req() req: Request,
    @Body() body: SubmitMerchantOnboardingDto,
  ): Promise<MerchantOnboardingStatusResponseDto> {
    const userId = req.user!.id;
    return this.onboardingService.submitOnboarding(userId, body);
  }

  @Post('repair')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ summary: 'Create revision draft from rejected submission for repair' })
  @ApiResponse({ status: 200, type: MerchantOnboardingDraftDto })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 409, description: 'Conflict: profile is not in REJECTED status' })
  async repair(@Req() req: Request): Promise<MerchantOnboardingDraftDto> {
    const userId = req.user!.id;
    return this.onboardingService.repairRejected(userId);
  }
}
