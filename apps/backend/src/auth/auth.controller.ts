import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { OtpService } from './otp/otp.service.js';
import { TokenService } from './tokens/token.service.js';
import { SessionService } from './session/session.service.js';
import { AdminAuthService } from './admin/admin-auth.service.js';
import { AuthSessionGuard } from './guards/auth-session.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import {
  RequestMobileOtpDto,
  VerifyMobileOtpDto,
} from './dto/mobile-auth.dto.js';
import {
  AdminLoginDto,
  AdminMfaVerifyDto,
} from './dto/admin-auth.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import {
  RequestOtpResponseDto,
  MobileAuthResponseDto,
  RefreshTokenResponseDto,
  AdminLoginResponseDto,
  AdminMfaVerifyResponseDto,
  CsrfTokenResponseDto,
  LogoutResponseDto,
} from './dto/auth-response.dto.js';
import { loadAppConfig } from '../config/app-config.js';
import { AppError } from '../common/errors/app-error.js';
import crypto from 'node:crypto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  @Post('mobile/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request 6-digit OTP code for mobile applications' })
  @ApiResponse({ status: 200, type: RequestOtpResponseDto })
  async requestMobileOtp(
    @Body() dto: RequestMobileOtpDto,
    @Req() req: Request,
  ): Promise<RequestOtpResponseDto> {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip;
    const result = await this.otpService.requestOtp({
      phone: dto.phone,
      audience: dto.audience,
      installationId: dto.installation_id,
      clientIp,
    });

    return {
      challenge_id: result.challengeId,
      resend_available_in_seconds: result.resendAvailableInSeconds,
    };
  }

  @Post('mobile/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 6-digit OTP and obtain access and refresh tokens' })
  @ApiResponse({ status: 200, type: MobileAuthResponseDto })
  async verifyMobileOtp(
    @Body() dto: VerifyMobileOtpDto,
    @Req() req: Request,
  ): Promise<MobileAuthResponseDto> {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];

    // 1. Verify and consume ephemeral OTP challenge
    await this.otpService.verifyOtp({
      phone: dto.phone,
      audience: dto.audience,
      otp: dto.otp,
      installationId: dto.installation_id,
      clientIp,
    });

    // 2. Canonical user resolution (same phone = same user across Customer, Merchant, Driver)
    const identity = await this.sessionService.resolveOrCreateCanonicalUser(
      dto.phone,
      dto.audience,
    );

    const config = loadAppConfig();

    // 3. Create persistent auth session
    const { sessionId } = await this.sessionService.createSession({
      userId: identity.user.id,
      audience: dto.audience,
      ipAddress: clientIp,
      userAgent,
      ttlSeconds: config.authRefreshTokenTtl,
    });

    // 4. Issue access token and opaque refresh token
    const tokens = await this.tokenService.issueTokenPair({
      sub: identity.user.id,
      sid: sessionId,
      aud: dto.audience,
    });

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_in_seconds: tokens.expiresInSeconds,
      audience: tokens.audience,
      user: {
        id: identity.user.id,
        phone: identity.user.phone,
        status: identity.user.status,
        customer_profile: identity.customerProfile
          ? {
              id: identity.customerProfile.id,
              name: identity.customerProfile.name,
            }
          : null,
        merchant_profile: identity.merchantProfile
          ? {
              id: identity.merchantProfile.id,
              business_name: identity.merchantProfile.businessName,
              status: identity.merchantProfile.status,
            }
          : null,
        driver_profile: identity.driverProfile
          ? {
              id: identity.driverProfile.id,
              full_name: identity.driverProfile.fullName,
              status: identity.driverProfile.status,
            }
          : null,
      },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and obtain fresh access token' })
  @ApiResponse({ status: 200, type: RefreshTokenResponseDto })
  async refreshTokens(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokenResponseDto> {
    const cookieRefresh = (req.cookies as Record<string, string> | undefined)?.[
      'toranggo_admin_refresh'
    ];
    const rawRefreshToken = dto?.refresh_token || cookieRefresh;

    if (!rawRefreshToken) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Refresh token is required');
    }

    const tokens = await this.tokenService.rotateRefreshToken(rawRefreshToken);
    const config = loadAppConfig();

    if (tokens.audience === 'ADMIN_WEB' || cookieRefresh) {
      // 1. Rotate HttpOnly access cookie
      res.cookie('toranggo_admin_access', tokens.accessToken, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: tokens.expiresInSeconds * 1000,
      });

      // 2. Rotate HttpOnly refresh cookie
      res.cookie('toranggo_admin_refresh', tokens.refreshToken, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'lax',
        path: '/api/v1/auth',
        maxAge: config.authRefreshTokenTtl * 1000,
      });
    }

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.audience === 'ADMIN_WEB' ? '' : tokens.refreshToken,
      token_type: 'Bearer',
      expires_in_seconds: tokens.expiresInSeconds,
      audience: tokens.audience,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard, CsrfGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke current session and consumed tokens' })
  @ApiResponse({ status: 200, type: LogoutResponseDto })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    if (req.user?.sessionId) {
      await this.tokenService.revokeSession(req.user.sessionId);
    }

    const config = loadAppConfig();

    // Clear admin cookies if present
    res.clearCookie('toranggo_admin_access', { path: '/' });
    res.clearCookie('toranggo_admin_csrf', { path: '/' });
    res.clearCookie('toranggo_admin_access', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('toranggo_admin_refresh', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
    res.clearCookie('toranggo_admin_csrf', {
      httpOnly: false,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
    });

    return { success: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard, CsrfGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions for authenticated principal' })
  @ApiResponse({ status: 200, type: LogoutResponseDto })
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    if (req.user?.id) {
      if (req.user.audience === 'ADMIN_WEB') {
        await this.tokenService.revokeAllAdminSessions(req.user.id);
      } else {
        await this.tokenService.revokeAllUserSessions(req.user.id);
      }
    }

    res.clearCookie('toranggo_admin_access', { path: '/' });
    res.clearCookie('toranggo_admin_csrf', { path: '/' });
    const config = loadAppConfig();

    res.clearCookie('toranggo_admin_access', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('toranggo_admin_refresh', {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
    res.clearCookie('toranggo_admin_csrf', {
      httpOnly: false,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
    });

    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthSessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve safe identity details for currently authenticated principal' })
  @ApiResponse({ status: 200 })
  async me(@Req() req: Request) {
    const user = req.user!;

    if (user.audience === 'ADMIN_WEB') {
      const adminSummary = await this.sessionService.getAdminPermissions(user.id);
      return {
        principal_type: 'ADMIN',
        admin_id: adminSummary.admin.id,
        username: adminSummary.admin.username,
        email: adminSummary.admin.email,
        status: adminSummary.admin.status,
        audience: 'ADMIN_WEB',
        session_id: user.sessionId,
        roles: adminSummary.roles,
        permissions: adminSummary.permissions,
      };
    }

    const identity = await this.sessionService.getUserIdentity(user.id);
    return {
      principal_type: 'USER',
      user_id: identity.user.id,
      phone: identity.user.phone,
      status: identity.user.status,
      audience: user.audience,
      session_id: user.sessionId,
      customer_profile: identity.customerProfile
        ? {
            id: identity.customerProfile.id,
            name: identity.customerProfile.name,
          }
        : null,
      merchant_profile: identity.merchantProfile
        ? {
            id: identity.merchantProfile.id,
            business_name: identity.merchantProfile.businessName,
            status: identity.merchantProfile.status,
          }
        : null,
      driver_profile: identity.driverProfile
        ? {
            id: identity.driverProfile.id,
            full_name: identity.driverProfile.fullName,
            status: identity.driverProfile.status,
          }
        : null,
    };
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login step 1: Validate credentials and initiate MFA challenge' })
  @ApiResponse({ status: 200, type: AdminLoginResponseDto })
  async adminLogin(
    @Body() dto: AdminLoginDto,
  ): Promise<AdminLoginResponseDto> {
    const result = await this.adminAuthService.login(dto.identifier, dto.password);
    return {
      mfa_required: result.mfaRequired,
      mfa_challenge_token: result.mfaChallengeToken,
    };
  }

  @Post('admin/mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login step 2: Verify TOTP/recovery code, establish session and cookies' })
  @ApiResponse({ status: 200, type: AdminMfaVerifyResponseDto })
  async adminMfaVerify(
    @Body() dto: AdminMfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminMfaVerifyResponseDto> {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.adminAuthService.verifyMfa({
      mfaChallengeToken: dto.mfa_challenge_token,
      code: dto.code,
      ipAddress: clientIp,
      userAgent,
    });

    const config = loadAppConfig();

    // Set secure browser cookies for Admin Web
    // 1. HttpOnly access cookie (cannot be accessed via JS)
    res.cookie('toranggo_admin_access', result.accessToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresInSeconds * 1000,
    });

    // 2. CSRF cookie (accessible to client-side JS for X-CSRF-Token header)
    // 2. HttpOnly refresh cookie (cannot be accessed via JS)
    res.cookie('toranggo_admin_refresh', result.refreshToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: config.authRefreshTokenTtl * 1000,
    });

    // 3. CSRF cookie (accessible to client-side JS for X-CSRF-Token header)
    res.cookie('toranggo_admin_csrf', result.csrfToken, {
      httpOnly: false,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresInSeconds * 1000,
    });

    return {
      access_token: result.accessToken,
      csrf_token: result.csrfToken,
      token_type: 'Bearer',
      expires_in_seconds: result.expiresInSeconds,
      admin: result.admin,
    };
  }

  @Post('admin/csrf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtain CSRF token and refresh cookie for Admin Web' })
  @ApiResponse({ status: 200, type: CsrfTokenResponseDto })
  async adminCsrf(
    @Res({ passthrough: true }) res: Response,
  ): Promise<CsrfTokenResponseDto> {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const config = loadAppConfig();

    res.cookie('toranggo_admin_csrf', csrfToken, {
      httpOnly: false,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400 * 1000,
    });

    return { csrf_token: csrfToken };
  }
}
