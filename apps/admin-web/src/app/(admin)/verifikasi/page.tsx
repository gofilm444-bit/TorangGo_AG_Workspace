import React from 'react';
import { PageHeader, EmptyState, StatusBadge } from '../../../components/ui';

export default function VerifikasiPage() {
  return (
    <div>
      <PageHeader
        title="Verifikasi Mitra & Dokumen"
        description="Pusat evaluasi dan validasi dokumen KYC merchant, driver, dan entitas operasional"
        action={<StatusBadge variant="neutral">Modul Belum Diaktifkan</StatusBadge>}
      />

      <EmptyState
        title="Data belum tersedia"
        description="Modul verifikasi mitra belum diaktifkan. Alur peninjauan dokumen identitas, kelayakan kendaraan, dan profil merchant akan diintegrasikan pada fase operasional berikutnya."
      />
    </div>
  );
}
