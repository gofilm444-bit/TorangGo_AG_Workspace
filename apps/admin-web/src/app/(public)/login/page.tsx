'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, StatusBadge } from '../../../components/ui';
import { useAdminAuth } from '../../../lib/auth-context';

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginStep1, loginStep2 } = useAdminAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaChallengeToken, setMfaChallengeToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Harap masukkan username/email dan kata sandi');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const res = await loginStep1(identifier.trim(), password);
      setMfaChallengeToken(res.mfaChallengeToken);
      setStep(2);
    } catch (err) {
      setError((err as Error).message || 'Kredensial login tidak valid.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim()) {
      setError('Harap masukkan kode verifikasi');
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      await loginStep2(mfaChallengeToken, mfaCode.trim());
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Kode MFA atau pemulihan tidak valid.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToStep1 = () => {
    setStep(1);
    setMfaCode('');
    setMfaChallengeToken('');
    setError(null);
  };

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-canvas)',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '440px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              margin: '0 0 8px 0',
              color: 'var(--color-text-primary)',
            }}
          >
            TorangGo Admin
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.875rem' }}>
            Portal Masuk Batas Operasional
          </p>
        </div>

        <Card
          title={step === 1 ? 'Masuk Portal Operator' : 'Verifikasi Dua Langkah (MFA)'}
          footer={
            <div style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {step === 1 ? (
                <span>Keamanan tingkat tinggi &bull; Autentikasi Argon2id + TOTP</span>
              ) : (
                <button
                  type="button"
                  onClick={handleBackToStep1}
                  disabled={isLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    textDecoration: 'underline',
                  }}
                >
                  &larr; Kembali ke masukkan kredensial
                </button>
              )}
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {step === 1 ? 'Langkah 1 dari 2: Kredensial' : 'Langkah 2 dari 2: MFA'}
              </span>
              <StatusBadge variant={step === 1 ? 'info' : 'success'}>
                {step === 1 ? 'Kredensial' : 'Verifikasi'}
              </StatusBadge>
            </div>

            {error ? (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  color: 'var(--color-danger, #dc2626)',
                  fontSize: '0.875rem',
                  lineHeight: 1.4,
                }}
                role="alert"
              >
                {error}
              </div>
            ) : null}

            {step === 1 ? (
              <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label
                    htmlFor="identifier"
                    style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}
                  >
                    Email atau Username Admin
                  </label>
                  <input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="admin@toranggo.com"
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label
                    htmlFor="password"
                    style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}
                  >
                    Kata Sandi
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <Button
                  variant="primary"
                  type="submit"
                  disabled={isLoading}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {isLoading ? 'Memvalidasi Kredensial...' : 'Lanjut ke Verifikasi MFA →'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {isRecoveryMode
                    ? 'Masukkan salah satu kode pemulihan cadangan Anda (format: XXXX-XXXX).'
                    : 'Buka aplikasi authenticator Anda dan masukkan 6-digit kode verifikasi TOTP.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label
                    htmlFor="mfaCode"
                    style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-primary)' }}
                  >
                    {isRecoveryMode ? 'Kode Pemulihan Cadangan' : 'Kode Authenticator (6 Digit)'}
                  </label>
                  <input
                    id="mfaCode"
                    type="text"
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder={isRecoveryMode ? 'A1B2-C3D4' : '123456'}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      fontSize: '1.25rem',
                      letterSpacing: isRecoveryMode ? '2px' : '4px',
                      textAlign: 'center',
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecoveryMode((prev) => !prev);
                      setMfaCode('');
                      setError(null);
                    }}
                    disabled={isLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {isRecoveryMode ? 'Gunakan Kode Authenticator (TOTP)' : 'Gunakan Kode Pemulihan Cadangan'}
                  </button>
                </div>

                <Button
                  variant="primary"
                  type="submit"
                  disabled={isLoading}
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  {isLoading ? 'Memverifikasi...' : 'Verifikasi & Masuk Dashboard'}
                </Button>
              </form>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
