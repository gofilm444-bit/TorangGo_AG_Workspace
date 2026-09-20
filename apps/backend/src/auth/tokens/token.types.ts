import type { AppAudience } from '@platform/shared-types';

export interface AccessTokenClaims {
  iss: string;
  sub: string;
  sid: string;
  aud: AppAudience;
  jti: string;
  iat: number;
  exp: number;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  audience: AppAudience;
  sessionId: string;
}
