import React from 'react';
import { PageHeader, EmptyState, StatusBadge } from '../../../components/ui';

export default function KeuanganPage() {
  return (
    <div>
      <PageHeader
        title="Keuangan & Rekonsiliasi"
        description="Audit transaksi pembayaran, ledger saldo akun, dan penyelesaian dana mitra"
        action={<StatusBadge variant="neutral">Modul Belum Diaktifkan</StatusBadge>}
      />

      <EmptyState
        title="Data belum tersedia"
        description="Pencatatan mutasi keuangan, pemrosesan payout, dan rekonsiliasi escrow akan tersedia setelah integrasi modul pembayaran dan ledger pada fase berikutnya."
      />
    </div>
  );
}
