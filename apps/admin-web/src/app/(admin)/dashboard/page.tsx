'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  SectionHeader,
  Card,
  StatusBadge,
  EmptyState,
  Button,
  LoadingState,
  ErrorState,
} from '../../../components/ui';
import { adminConfig } from '../../../lib/config';
import { adminApiClient } from '../../../lib/api';
import type { AdminOverviewResponseDto } from '@platform/api-client';

export default function DashboardPage() {
  const [overview, setOverview] = useState<AdminOverviewResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApiClient.getAdminOverview();
      setOverview(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat ringkasan operasional';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div>
      <PageHeader
        title="Dashboard Operasional"
        description="Pusat kendali dan ringkasan operasional platform TorangGo"
        action={
          <StatusBadge variant="info">
            Audience: {adminConfig.audience ?? 'ADMIN_WEB'}
          </StatusBadge>
        }
      />

      {loading && (
        <div style={{ padding: '32px 0' }}>
          <LoadingState message="Memuat ringkasan operasional platform..." />
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '24px 0' }}>
          <ErrorState
            title="Gagal Memuat Ringkasan"
            message={error}
            onRetry={fetchOverview}
            retryLabel="Coba Lagi"
          />
        </div>
      )}

      {!loading && !error && overview && (
        <div className="grid-cards">
          {/* 1. Ringkasan Pengguna Platform */}
          <Card
            title="Pengguna Platform"
            footer={
              <span>Lingkungan: <strong>{adminConfig.appEnv}</strong></span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Total Akun Pengguna</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {overview.users.total}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Identitas pengguna kanonikal terdaftar di database PostgreSQL.
              </p>
            </div>
          </Card>

          {/* 2. Status Operasional Gateway */}
          <Card
            title="Status Operasional"
            footer={
              <span>Konektivitas API: <strong>{adminConfig.apiBaseUrl}</strong></span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Backend Gateway</span>
                <StatusBadge variant="success">Tersambung</StatusBadge>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Sesi administratif tervalidasi secara backend-authoritative.
              </p>
            </div>
          </Card>

          {/* 3. Verifikasi Mitra Merchant */}
          <Card
            title="Mitra Merchant"
            action={
              <Link href="/verifikasi">
                <Button variant="ghost" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                  Buka
                </Button>
              </Link>
            }
            footer={
              <span>Total Merchant: <strong>{overview.merchants.total}</strong></span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Menunggu Verifikasi</span>
                <StatusBadge variant={overview.merchants.pending > 0 ? 'warning' : 'neutral'}>
                  {overview.merchants.pending} Menunggu
                </StatusBadge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Disetujui (Aktif)</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {overview.merchants.approved}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Status profil merchant: {overview.merchants.rejected} ditolak, {overview.merchants.suspended} ditangguhkan.
              </p>
            </div>
          </Card>

          {/* 4. Verifikasi Mitra Driver */}
          <Card
            title="Mitra Driver"
            action={
              <Link href="/verifikasi">
                <Button variant="ghost" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                  Buka
                </Button>
              </Link>
            }
            footer={
              <span>Total Driver: <strong>{overview.drivers.total}</strong></span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Menunggu Verifikasi</span>
                <StatusBadge variant={overview.drivers.pending > 0 ? 'warning' : 'neutral'}>
                  {overview.drivers.pending} Menunggu
                </StatusBadge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Disetujui (Aktif)</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {overview.drivers.approved}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Status profil driver: {overview.drivers.rejected} ditolak, {overview.drivers.suspended} ditangguhkan.
              </p>
            </div>
          </Card>

          {/* 5. Keuangan */}
          <Card
            title="Keuangan"
            action={
              <Link href="/keuangan">
                <Button variant="ghost" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                  Buka
                </Button>
              </Link>
            }
            footer={
              <span>Model Uang: IDR Integer Presisi</span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Settlement & Mutasi</span>
                <StatusBadge variant="neutral">Non-aktif</StatusBadge>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Data belum tersedia. Tidak ada angka transaksi atau GMV fiktif.
              </p>
            </div>
          </Card>

          {/* 6. Dukungan */}
          <Card
            title="Dukungan"
            action={
              <Link href="/dukungan">
                <Button variant="ghost" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                  Buka
                </Button>
              </Link>
            }
            footer={
              <span>Layanan Pengaduan & Resolusi</span>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Tiket Eskalasi</span>
                <StatusBadge variant="neutral">0 Aktif</StatusBadge>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Data belum tersedia. Kanal investigasi tiket akan dibuka pada fase operasional.
              </p>
            </div>
          </Card>
        </div>
      )}

      <div style={{ marginTop: '32px' }}>
        <SectionHeader
          title="Aktivitas Operasional Terbaru"
          description="Daftar audit alur sistem dan event administratif platform"
        />
        <EmptyState
          title="Data belum tersedia"
          description="Belum ada catatan aktivitas operasional yang tercatat. Seluruh alur transaksi dan audit event akan terisi saat modul bisnis Fase 2 diaktifkan."
        />
      </div>
    </div>
  );
}
