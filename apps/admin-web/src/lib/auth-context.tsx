'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AdminUserSummaryDto, AdminMfaVerifyResponseDto } from '@platform/api-client';
import { adminApiClient, setAdminCsrfToken } from './api';

export type AdminAuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AdminAuthContextValue {
  status: AdminAuthStatus;
  admin: AdminUserSummaryDto | null;
  loginStep1: (identifier: string, password: string) => Promise<{ mfaRequired: boolean; mfaChallengeToken: string }>;
  loginStep2: (mfaChallengeToken: string, code: string) => Promise<AdminUserSummaryDto>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUserSummaryDto | null>(null);
  const [status, setStatus] = useState<AdminAuthStatus>('loading');

  const checkSession = useCallback(async () => {
    try {
      const me = await adminApiClient.getMe<AdminUserSummaryDto>();
      setAdmin(me);
      setStatus('authenticated');
    } catch {
      setAdmin(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const loginStep1 = useCallback(async (identifier: string, password: string) => {
    const res = await adminApiClient.adminLogin({ identifier, password });
    return res;
  }, []);

  const loginStep2 = useCallback(async (mfaChallengeToken: string, code: string) => {
    const res = await adminApiClient.adminMfaVerify<AdminMfaVerifyResponseDto>({
      mfa_challenge_token: mfaChallengeToken,
      code,
    });
    if (res.csrfToken) {
      setAdminCsrfToken(res.csrfToken);
    }
    setAdmin(res.admin);
    setStatus('authenticated');
    return res.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApiClient.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setAdminCsrfToken(null);
      setAdmin(null);
      setStatus('unauthenticated');
    }
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        status,
        admin,
        loginStep1,
        loginStep2,
        logout,
        checkSession,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return ctx;
}
