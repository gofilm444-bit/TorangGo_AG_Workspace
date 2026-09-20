import React from 'react';
import { PageHeader, EmptyState, StatusBadge } from '../../../components/ui';

export default function OperasionalPage() {
  return (
    <div>
      <PageHeader
        title="Operasional Platform"
        description="Pengawasan pesanan aktif, pemantauan alur pengantaran, dan manajemen katalog"
        action={<StatusBadge variant="neutral">Modul Belum Diaktifkan</StatusBadge>}
      />

      <EmptyState
        title="Fitur operasional akan tersedia pada fase berikutnya"
        description="Pemantauan transaksi berjalan, dispatch armada driver, dan pembaruan ketersediaan menu merchant dijadwalkan untuk implementasi alur bisnis Fase 2."
      />
    </div>
  );
}
