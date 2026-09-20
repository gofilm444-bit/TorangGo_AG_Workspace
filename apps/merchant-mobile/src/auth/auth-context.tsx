import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { merchantApiClient } from '../api';
import { merchantSecureStorage } from './secure-storage';
import type { MobileAuthResponseDto, MobileUserSummaryDto } from '@platform/api-client';

export type AuthStateStatus = 'idle' | 'loading' | 'otp_sent' | 'authenticated';

export interface MerchantAuthContextValue {
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

const MerchantAuthContext = createContext<MerchantAuthContextValue | null>(null);

export function MerchantAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStateStatus>('loading');
  const [phone, setPhone] = useState<string>('');
  const [user, setUser] = useState<MobileUserSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await merchantSecureStorage.getItem('access_token');
        if (!storedToken) {
          setStatus('idle');
          return;
        }

        const me = await merchantApiClient.getMe<{
          user_id: string;
          phone: string;
          status: string;
          merchant_profile: { id: string; business_name?: string; status: string } | null;
        }>({ authToken: storedToken });

        setUser({
          id: me.user_id,
          phone: me.phone,
          status: me.status,
          merchant_profile: me.merchant_profile,
        });
        setStatus('authenticated');
      } catch {
        try {
          const refreshToken = await merchantSecureStorage.getItem('refresh_token');
          if (refreshToken) {
            const refreshed = await merchantApiClient.refreshTokens<{
              accessToken: string;
              refreshToken: string;
            }>({ refresh_token: refreshToken });

            await merchantSecureStorage.setItem('access_token', refreshed.accessToken);
            await merchantSecureStorage.setItem('refresh_token', refreshed.refreshToken);

            const me = await merchantApiClient.getMe<{
              user_id: string;
              phone: string;
              status: string;
              merchant_profile: { id: string; business_name?: string; status: string } | null;
            }>({ authToken: refreshed.accessToken });

            setUser({
              id: me.user_id,
              phone: me.phone,
              status: me.status,
              merchant_profile: me.merchant_profile,
            });
            setStatus('authenticated');
            return;
          }
        } catch (err) {
          void err;
        }

        await merchantSecureStorage.deleteItem('access_token');
        await merchantSecureStorage.deleteItem('refresh_token');
        setStatus('idle');
      }
    }

    restoreSession();
  }, []);

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
      const res = await merchantApiClient.requestMobileOtp({
        phone: inputPhone,
        audience: 'PARTNER_APP',
      });
      setPhone(inputPhone);
      setCooldownSeconds(res.resendAvailableInSeconds || 60);
      setStatus('otp_sent');
    } catch (err) {
      setError((err as Error).message || 'Gagal mengirim kode OTP.');
      setStatus('idle');
    }
  }, []);

  const verifyOtp = useCallback(async (otp: string) => {
    setError(null);
    setStatus('loading');
    try {
      const res = await merchantApiClient.verifyMobileOtp<MobileAuthResponseDto>({
        phone,
        audience: 'PARTNER_APP',
        otp,
      });

      await merchantSecureStorage.setItem('access_token', res.access_token);
      await merchantSecureStorage.setItem('refresh_token', res.refresh_token);

      setUser(res.user);
      setStatus('authenticated');
    } catch (err) {
      setError((err as Error).message || 'Kode OTP tidak valid atau kedaluwarsa.');
      setStatus('otp_sent');
    }
  }, [phone]);

  const logout = useCallback(async () => {
    try {
      const token = await merchantSecureStorage.getItem('access_token');
      if (token) {
        await merchantApiClient.logout({ authToken: token });
      }
    } catch (err) {
      void err;
    }
    await merchantSecureStorage.deleteItem('access_token');
    await merchantSecureStorage.deleteItem('refresh_token');
    setUser(null);
    setPhone('');
    setStatus('idle');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <MerchantAuthContext.Provider
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
    </MerchantAuthContext.Provider>
  );
}

export function useMerchantAuth(): MerchantAuthContextValue {
  const context = useContext(MerchantAuthContext);
  if (!context) {
    throw new Error('useMerchantAuth must be used within MerchantAuthProvider');
  }
  return context;
}
