'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminConfig } from '../../lib/config';
import { useAdminAuth } from '../../lib/auth-context';

export interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export function Header({ onToggleSidebar, isSidebarOpen }: HeaderProps) {
  const env = adminConfig.appEnv;
  const router = useRouter();
  const { admin, status, logout } = useAdminAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const getInitials = (name?: string, fallback = 'AO') => {
    if (!name) return fallback;
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="admin-header" role="banner">
      <div className="header-left">
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          aria-expanded={isSidebarOpen}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <span
          className={`header-env-badge ${env}`}
          title={`Lingkungan eksekusi: ${env}`}
        >
          {env}
        </span>
      </div>

      <div className="header-right">
        {/* Auth-ready placeholder slot: no fake authenticated session */}
        <div
          className="header-user-slot"
          title="Autentikasi operator admin belum diaktifkan — Dijadwalkan untuk Fase 1G"
        >
          <span className="header-user-avatar" aria-hidden="true">
            AO
          </span>
          <span>Admin Operator (Pra-Autentikasi / Fase 1G)</span>
        </div>
        {status === 'authenticated' && admin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="header-user-slot"
              title={`Akun: ${admin.email} | Peran: ${admin.roles.join(', ') || 'Operator'}`}
            >
              <span className="header-user-avatar" aria-hidden="true">
                {getInitials(admin.full_name || admin.username)}
              </span>
              <span>{admin.full_name || admin.username}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontSize: '0.8125rem',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Keluar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              className="header-user-slot"
              title="Sesi belum diautentikasi"
            >
              <span className="header-user-avatar" aria-hidden="true">
                AO
              </span>
              <span>Operator</span>
            </div>
            <Link
              href="/login"
              style={{
                fontSize: '0.8125rem',
                color: 'var(--color-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Masuk &rarr;
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
