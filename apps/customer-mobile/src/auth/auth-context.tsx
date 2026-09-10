import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { customerApiClient } from '../api.js';
import { customerSecureStorage } from './secure-storage.js';
import type { MobileAuthResponseDto, MobileUserSummaryDto } from '@platform/api-client';

export type AuthStateStatus = 'idle' | 'loading' | 'otp_sent' | 'authenticated';

export interface CustomerAuthContextValue {
  status: AuthStateStatus;
  phone: string;
  user: MobileUserSummaryDto | null;
  error: string | null;
  cooldownSeconds: number;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStateStatus>('loading');
  const [phone, setPhone] = useState<string>('');
  const [user, setUser] = useState<MobileUserSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Restore session on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await customerSecureStorage.getItem('access_token');
        if (!storedToken) {
          setStatus('idle');
          return;
        }

        // Validate session via /me
        const me = await customerApiClient.getMe<{
          user_id: string;
          phone: string;
          status: string;
          customer_profile: { id: string; name?: string } | null;
        }>({ authToken: storedToken });

        setUser({
          id: me.user_id,
          phone: me.phone,
          status: me.status,
          customer_profile: me.customer_profile,
        });
        setStatus('authenticated');
      } catch {
        // Try refresh token if access token expired
        try {
          const refreshToken = await customerSecureStorage.getItem('refresh_token');
          if (refreshToken) {
            const refreshed = await customerApiClient.refreshTokens<{
              accessToken: string;
              refreshToken: string;
            }>({ refresh_token: refreshToken });

            await customerSecureStorage.setItem('access_token', refreshed.accessToken);
            await customerSecureStorage.setItem('refresh_token', refreshed.refreshToken);

            const me = await customerApiClient.getMe<{
              user_id: string;
              phone: string;
              status: string;
              customer_profile: { id: string; name?: string } | null;
            }>({ authToken: refreshed.accessToken });

            setUser({
              id: me.user_id,
              phone: me.phone,
              status: me.status,
              customer_profile: me.customer_profile,
            });
            setStatus('authenticated');
            return;
          }
        } catch (err) {
          void err;
        }

        await customerSecureStorage.deleteItem('access_token');
        await customerSecureStorage.deleteItem('refresh_token');
        setStatus('idle');
      }
    }

    restoreSession();
  }, []);

  // Cooldown timer tick
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const requestOtp = useCallback(async (inputPhone: string) => {
    setError(null);
    setStatus('loading');
    try {
      const res = await customerApiClient.requestMobileOtp({
        phone: inputPhone,
        audience: 'CUSTOMER_APP',
      });
      setPhone(inputPhone);
      setCooldownSeconds(res.resendAvailableInSeconds || 60);
      setStatus('otp_sent');
    } catch (err) {
      setError((err as Error).message || 'Gagal mengirim kode OTP. Periksa format nomor telepon.');
      setStatus('idle');
    }
  }, []);

  const verifyOtp = useCallback(async (otp: string) => {
    setError(null);
    setStatus('loading');
    try {
      const res = await customerApiClient.verifyMobileOtp<MobileAuthResponseDto>({
        phone,
        audience: 'CUSTOMER_APP',
        otp,
      });

      await customerSecureStorage.setItem('access_token', res.access_token);
      await customerSecureStorage.setItem('refresh_token', res.refresh_token);

      setUser(res.user);
      setStatus('authenticated');
    } catch (err) {
      setError((err as Error).message || 'Kode OTP tidak valid atau telah kedaluwarsa.');
      setStatus('otp_sent');
    }
  }, [phone]);

  const logout = useCallback(async () => {
    try {
      const token = await customerSecureStorage.getItem('access_token');
      if (token) {
        await customerApiClient.logout({ authToken: token });
      }
    } catch (err) {
      void err;
    }
    await customerSecureStorage.deleteItem('access_token');
    await customerSecureStorage.deleteItem('refresh_token');
    setUser(null);
    setPhone('');
    setStatus('idle');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <CustomerAuthContext.Provider
      value={{
        status,
        phone,
        user,
        error,
        cooldownSeconds,
        requestOtp,
        verifyOtp,
        logout,
        clearError,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  }
  return context;
}
