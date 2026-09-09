import React from 'react';
import Link from 'next/link';
import { PageHeader, SectionHeader, Card, StatusBadge, EmptyState, Button } from '../../../components/ui';
import { adminConfig } from '../../../lib/config';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard Operasional"
        description="Shell administrasi platform TorangGo — Tata letak operasional pra-integrasi bisnis"
        action={
          <StatusBadge variant="info">
            Audience: {adminConfig.audience ?? 'ADMIN_WEB'}
          </StatusBadge>
        }
      />

      <div className="grid-cards">
        {/* 1. Ringkasan Platform */}
        <Card
          title="Ringkasan Platform"
          footer={
            <span>Lingkungan: <strong>{adminConfig.appEnv}</strong></span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Status Shell</span>
              <StatusBadge variant="success">Siap Operasi</StatusBadge>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Data belum tersedia. Metrik bisnis tidak difabrikasi pada fondasi shell ini.
            </p>
          </div>
        </Card>

        {/* 2. Status Operasional */}
        <Card
          title="Status Operasional"
          footer={
            <span>Konektivitas API: <strong>{adminConfig.apiBaseUrl}</strong></span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Backend Gateway</span>
              <StatusBadge variant="neutral">Tersambung</StatusBadge>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Menunggu integrasi fase operasional. Telemetri live belum dihubungkan.
            </p>
          </div>
        </Card>

        {/* 3. Verifikasi */}
        <Card
          title="Verifikasi"
          action={
            <Link href="/verifikasi">
              <Button variant="ghost" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                Buka
              </Button>
            </Link>
          }
          footer={
            <span>Modul: Pendaftaran Mitra & Dokumen</span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Antrean Berkas</span>
              <StatusBadge variant="neutral">0 Menunggu</StatusBadge>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Data belum tersedia. Alur persetujuan mitra dimulai pada Fase 2.
            </p>
          </div>
        </Card>

        {/* 4. Keuangan */}
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
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Data belum tersedia. Tidak ada angka transaksi atau GMV fiktif.
            </p>
          </div>
        </Card>

        {/* 5. Dukungan */}
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
            <p style={{ margin: '8px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Data belum tersedia. Kanal investigasi tiket akan dibuka pada fase operasional.
            </p>
          </div>
        </Card>
      </div>

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
