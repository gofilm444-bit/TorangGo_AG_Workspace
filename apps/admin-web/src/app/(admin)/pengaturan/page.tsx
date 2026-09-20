import { PageHeader, Card, StatusBadge } from '../../../components/ui';
import { adminConfig } from '../../../lib/config';

export default function PengaturanPage() {
  return (
    <div>
      <PageHeader
        title="Pengaturan Platform"
        description="Konfigurasi runtime, parameter operasional, dan informasi batas keamanan"
        action={<StatusBadge variant="info">Fase 1F Shell</StatusBadge>}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' }}>
        <Card title="Konfigurasi Klien (Client-Safe)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Audience Target</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{adminConfig.audience ?? 'ADMIN_WEB'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Environment</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{adminConfig.appEnv}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>API Base URL</span>
              <span style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>{adminConfig.apiBaseUrl}</span>
            </div>
          </div>
        </Card>

        <Card title="Batas Keamanan & Otorisasi">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
              Sesuai arsitektur TorangGo, kode peramban (browser) <strong>bukan merupakan batas otorisasi tepercaya</strong>. Tampilan menu navigasi semata-mata merupakan panduan UX. Penegakan izin aktual wajib dilakukan pada level backend (NestJS guards, session context, and database-backed permission validation).
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <StatusBadge variant="neutral">Autentikasi: Fase 1G</StatusBadge>
              <StatusBadge variant="neutral">RBAC: Backend Enforced</StatusBadge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
