import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { driverApiClient } from '../api';
import { driverSecureStorage } from './secure-storage';
import type { MobileAuthResponseDto, MobileUserSummaryDto } from '@platform/api-client';

export type AuthStateStatus = 'idle' | 'loading' | 'otp_sent' | 'authenticated';

export interface DriverAuthContextValue {
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

const DriverAuthContext = createContext<DriverAuthContextValue | null>(null);

export function DriverAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStateStatus>('loading');
  const [phone, setPhone] = useState<string>('');
  const [user, setUser] = useState<MobileUserSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await driverSecureStorage.getItem('access_token');
        if (!storedToken) {
          setStatus('idle');
          return;
        }

        const me = await driverApiClient.getMe<{
          user_id: string;
          phone: string;
          status: string;
          driver_profile: { id: string; full_name?: string; status: string } | null;
        }>({ authToken: storedToken });

        setUser({
          id: me.user_id,
          phone: me.phone,
          status: me.status,
          driver_profile: me.driver_profile,
        });
        setStatus('authenticated');
      } catch {
        try {
          const refreshToken = await driverSecureStorage.getItem('refresh_token');
          if (refreshToken) {
            const refreshed = await driverApiClient.refreshTokens<{
              accessToken: string;
              refreshToken: string;
            }>({ refresh_token: refreshToken });

            await driverSecureStorage.setItem('access_token', refreshed.accessToken);
            await driverSecureStorage.setItem('refresh_token', refreshed.refreshToken);

            const me = await driverApiClient.getMe<{
              user_id: string;
              phone: string;
              status: string;
              driver_profile: { id: string; full_name?: string; status: string } | null;
            }>({ authToken: refreshed.accessToken });

            setUser({
              id: me.user_id,
              phone: me.phone,
              status: me.status,
              driver_profile: me.driver_profile,
            });
            setStatus('authenticated');
            return;
          }
        } catch (err) {
          void err;
        }

        await driverSecureStorage.deleteItem('access_token');
        await driverSecureStorage.deleteItem('refresh_token');
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
      const res = await driverApiClient.requestMobileOtp({
        phone: inputPhone,
        audience: 'DRIVER_APP',
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
      const res = await driverApiClient.verifyMobileOtp<MobileAuthResponseDto>({
        phone,
        audience: 'DRIVER_APP',
        otp,
      });

      await driverSecureStorage.setItem('access_token', res.access_token);
      await driverSecureStorage.setItem('refresh_token', res.refresh_token);

      setUser(res.user);
      setStatus('authenticated');
    } catch (err) {
      setError((err as Error).message || 'Kode OTP tidak valid atau kedaluwarsa.');
      setStatus('otp_sent');
    }
  }, [phone]);

  const logout = useCallback(async () => {
    try {
      const token = await driverSecureStorage.getItem('access_token');
      if (token) {
        await driverApiClient.logout({ authToken: token });
      }
    } catch (err) {
      void err;
    }
    await driverSecureStorage.deleteItem('access_token');
    await driverSecureStorage.deleteItem('refresh_token');
    setUser(null);
    setPhone('');
    setStatus('idle');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <DriverAuthContext.Provider
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
    </DriverAuthContext.Provider>
  );
}

export function useDriverAuth(): DriverAuthContextValue {
  const context = useContext(DriverAuthContext);
  if (!context) {
    throw new Error('useDriverAuth must be used within DriverAuthProvider');
  }
  return context;
}
