'use client';

import React from 'react';
import { adminConfig } from '../../lib/config';

export interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export function Header({ onToggleSidebar, isSidebarOpen }: HeaderProps) {
  const env = adminConfig.appEnv;

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
      </div>
    </header>
  );
}
