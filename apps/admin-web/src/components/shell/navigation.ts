export interface NavItem {
  id: string;
  label: string;
  href: string;
  description: string;
  iconName: 'dashboard' | 'verifikasi' | 'operasional' | 'keuangan' | 'dukungan' | 'pengaturan';
}

/**
 * Canonical navigation items for TorangGo Admin Web Shell.
 * Strict adherence to the 6 shell destinations defined in Phase 1F.
 */
export const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    description: 'Ringkasan platform dan status operasional',
    iconName: 'dashboard',
  },
  {
    id: 'verifikasi',
    label: 'Verifikasi',
    href: '/verifikasi',
    description: 'Verifikasi profil merchant dan driver',
    iconName: 'verifikasi',
  },
  {
    id: 'operasional',
    label: 'Operasional',
    href: '/operasional',
    description: 'Pemantauan layanan, katalog, dan alur pengantaran',
    iconName: 'operasional',
  },
  {
    id: 'keuangan',
    label: 'Keuangan',
    href: '/keuangan',
    description: 'Rekonsiliasi transaksi, pencairan, dan riwayat mutasi',
    iconName: 'keuangan',
  },
  {
    id: 'dukungan',
    label: 'Dukungan',
    href: '/dukungan',
    description: 'Pusat bantuan keluhan, tiket eskalasi, dan resolusi',
    iconName: 'dukungan',
  },
  {
    id: 'pengaturan',
    label: 'Pengaturan',
    href: '/pengaturan',
    description: 'Konfigurasi platform, parameter audit, dan sistem',
    iconName: 'pengaturan',
  },
] as const;
