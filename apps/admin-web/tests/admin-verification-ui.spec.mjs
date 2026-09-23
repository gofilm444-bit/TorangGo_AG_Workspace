import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 2A2: Admin Web Verification Workflow Suite', () => {
  const pagePath = path.resolve(__dirname, '../src/app/(admin)/verifikasi/page.tsx');
  const navPath = path.resolve(__dirname, '../src/components/shell/navigation.ts');

  it('proves verifikasi/page.tsx exists and is no longer a static placeholder', () => {
    assert.ok(fs.existsSync(pagePath), 'verifikasi/page.tsx must exist');
    const content = fs.readFileSync(pagePath, 'utf-8');

    // Must NOT contain placeholder wording
    assert.ok(!content.includes('Modul Belum Diaktifkan'), 'Must not claim module is inactive');
    assert.ok(!content.includes('dokumen KYC'), 'Must not claim KYC document verification exists in 2A2');

    // Must use real 2A2 title
    assert.ok(content.includes('Verifikasi Merchant & Driver'), 'Must display Phase 2A2 title');
  });

  it('verifies navigation description does not claim KYC or document verification', () => {
    assert.ok(fs.existsSync(navPath), 'navigation.ts must exist');
    const content = fs.readFileSync(navPath, 'utf-8');
    assert.ok(!content.includes('dokumen KYC'), 'Navigation must not claim KYC document functionality');
    assert.ok(content.includes('Verifikasi profil merchant dan driver'), 'Truthful navigation description');
  });

  it('integrates real ApiClient methods for Merchant and Driver workflows', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');

    // Read methods
    assert.ok(content.includes('listMerchantVerifications'), 'Must call listMerchantVerifications');
    assert.ok(content.includes('listDriverVerifications'), 'Must call listDriverVerifications');
    assert.ok(content.includes('getMerchantVerificationDetail'), 'Must call getMerchantVerificationDetail');
    assert.ok(content.includes('getDriverVerificationDetail'), 'Must call getDriverVerificationDetail');

    // Mutation methods
    assert.ok(content.includes('approveMerchant'), 'Must call approveMerchant');
    assert.ok(content.includes('rejectMerchant'), 'Must call rejectMerchant');
    assert.ok(content.includes('suspendMerchant'), 'Must call suspendMerchant');
    assert.ok(content.includes('reactivateMerchant'), 'Must call reactivateMerchant');
    assert.ok(content.includes('approveDriver'), 'Must call approveDriver');
    assert.ok(content.includes('rejectDriver'), 'Must call rejectDriver');
    assert.ok(content.includes('suspendDriver'), 'Must call suspendDriver');
    assert.ok(content.includes('reactivateDriver'), 'Must call reactivateDriver');
  });

  it('implements tab switching between Merchant and Driver queues', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');
    assert.ok(content.includes('Merchant Profiles'), 'Must provide Merchant tab');
    assert.ok(content.includes('Driver Profiles'), 'Must provide Driver tab');
    assert.ok(content.includes('activeTab'), 'Must manage active tab state');
  });

  it('implements status filtering, search, and pagination', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');
    assert.ok(content.includes('PENDING') && content.includes('APPROVED') && content.includes('REJECTED') && content.includes('SUSPENDED'));
    assert.ok(content.includes('searchQuery') || content.includes('appliedSearch'));
    assert.ok(content.includes('currentPage') && content.includes('totalPages'));
    assert.ok(content.includes('Sebelumnya') && content.includes('Selanjutnya'));
  });

  it('implements backend-aligned permission awareness (admin:write and admin:ops)', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');
    assert.ok(content.includes('admin:write'), 'Checks admin:write permission');
    assert.ok(content.includes('admin:ops'), 'Checks admin:ops permission');
    assert.ok(content.includes('hasWritePermission'), 'Computes write permission');
    assert.ok(content.includes('hasOpsPermission'), 'Computes ops permission');
  });

  it('enforces reason validation rules and passes fresh idempotency keys', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');
    // Reason validation
    assert.ok(content.includes('trimmedReason.length < 3') || content.includes('minimal 3 karakter'), 'Validates min 3 characters');
    assert.ok(content.includes('1000'), 'Validates max 1000 characters');

    // Idempotency key generation
    assert.ok(content.includes('idempotencyKey'), 'Must pass idempotencyKey to API calls');
    assert.ok(content.includes('randomUUID'), 'Uses UUID for idempotency key');
  });

  it('renders audit history timeline and Phase 2B merchant KTP review while keeping driver pure 2A2', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');
    assert.ok(content.includes('Riwayat Audit Verifikasi'), 'Renders audit history section');
    assert.ok(content.includes('auditLogs'), 'Reads auditLogs array');

    // Phase 2B: Merchant has authentic KTP document review & NIK reveal
    assert.ok(content.includes('revealMerchantNik'), 'Calls revealMerchantNik API');
    assert.ok(content.includes('Lihat NIK'), 'Provides button to reveal masked NIK');
    assert.ok(content.includes('Lihat Dokumen KTP'), 'Provides button to preview KTP document');
    assert.ok(content.includes('Pratinjau Dokumen Identitas (KTP)'), 'Renders KTP modal preview');

    // Stale review guard (expectedSubmissionId & 409 conflict handling)
    assert.ok(content.includes('expectedSubmissionId'), 'Passes expectedSubmissionId to avoid stale reviews');
    assert.ok(content.includes('Pengajuan telah berubah'), 'Notifies admin on 409 conflict when submission changes');

    // Out of scope check: Driver verification remains pure 2A2 without SIM or STNK
    assert.ok(!content.includes('SIM'), 'No SIM documents for driver in Phase 2B');
    assert.ok(!content.includes('STNK'), 'No STNK documents for driver in Phase 2B');
  });

  it('enforces exact canonical status transition actions and terminal REJECTED state', () => {
    const content = fs.readFileSync(pagePath, 'utf-8');

    // Canonical action triggers
    assert.ok(content.includes("currentDetail.status === 'PENDING'"), 'Renders actions for PENDING');
    assert.ok(content.includes("currentDetail.status === 'APPROVED'"), 'Renders actions for APPROVED');
    assert.ok(content.includes("currentDetail.status === 'SUSPENDED'"), 'Renders actions for SUSPENDED');
    assert.ok(content.includes("currentDetail.status === 'REJECTED'"), 'Handles REJECTED status view');

    // REJECTED profile is terminal for Admin in Phase 2A2/2B: zero mutation buttons
    assert.ok(
      content.includes('peninjauan ulang profil yang ditolak tidak dapat diaktifkan kembali oleh Admin secara sepihak'),
      'Informs user that REJECTED profile is terminal for Admin in Phase 2A2/2B',
    );
    assert.ok(!content.includes('Buka Kembali'), 'Must not contain Buka Kembali button');
  });
});
