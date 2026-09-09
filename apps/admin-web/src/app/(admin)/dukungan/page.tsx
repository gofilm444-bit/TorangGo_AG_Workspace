import React from 'react';
import { PageHeader, EmptyState, StatusBadge } from '../../../components/ui';

export default function DukunganPage() {
  return (
    <div>
      <PageHeader
        title="Dukungan & Penanganan Keluhan"
        description="Pusat resolusi tiket pelanggan, sengketa pesanan, dan bantuan pengguna aplikasi"
        action={<StatusBadge variant="neutral">Modul Belum Diaktifkan</StatusBadge>}
      />

      <EmptyState
        title="Menunggu integrasi fase berikutnya"
        description="Kanal penerimaan tiket bantuan, riwayat percakapan pengguna, dan antrean investigasi keluhan akan dihubungkan saat infrastruktur dukungan diluncurkan."
      />
    </div>
  );
}
