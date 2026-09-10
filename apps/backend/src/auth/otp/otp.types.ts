import type { AppAudience } from '@platform/shared-types';

export interface OtpChallenge {
  challengeId: string;
  phone: string;
  audience: AppAudience;
  hmacVerifier: string;
  expiresAt: string;
  attemptsRemaining: number;
  installationId?: string;
  resendAvailableAt: string;
  createdAt: string;
}

export interface RequestOtpParams {
  phone: string;
  audience: AppAudience;
  installationId?: string;
  clientIp?: string;
}

export interface VerifyOtpParams {
  phone: string;
  audience: AppAudience;
  otp: string;
  installationId?: string;
  clientIp?: string;
}

export interface OtpVerificationResult {
  verified: boolean;
  phone: string;
  audience: AppAudience;
  installationId?: string;
}
