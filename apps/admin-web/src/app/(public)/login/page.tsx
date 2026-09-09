import React from 'react';
import Link from 'next/link';
import { Card, Button, StatusBadge } from '../../../components/ui';

export default function AdminLoginPage() {
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
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>
            TorangGo Admin
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.875rem' }}>
            Portal Masuk Batas Publik (Pra-Autentikasi)
          </p>
        </div>

        <Card
          title="Batas Autentikasi Admin"
          footer={
            <div style={{ textAlign: 'center' }}>
              <Link href="/dashboard" style={{ color: 'var(--color-primary)', fontWeight: 500, fontSize: '0.875rem' }}>
                &larr; Buka Admin Web Shell
              </Link>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Status Layanan</span>
              <StatusBadge variant="warning">Menunggu Fase 1G</StatusBadge>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Autentikasi kredensial, session cookies, dan MFA belum diaktifkan pada Fase 1F. Seluruh alur identitas dan otentikasi akan diimplementasikan secara terisolasi pada <strong>Fase 1G</strong>.
            </p>

            <div
              style={{
                backgroundColor: 'var(--color-bg-canvas)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                fontSize: '0.8125rem',
                color: 'var(--color-text-muted)',
              }}
            >
              <strong>Titik Integrasi Fase 1G:</strong>
              <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                <li>Admin Login Handler (POST /api/v1/auth/admin/login)</li>
                <li>Session verification & CSRF token exchange</li>
                <li>Backend RBAC / permission validation</li>
              </ul>
            </div>

            <Link href="/dashboard" style={{ width: '100%' }}>
              <Button variant="primary" style={{ width: '100%' }}>
                Masuk ke Shell Operasional
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
