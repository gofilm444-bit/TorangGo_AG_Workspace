'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PageHeader,
  Card,
  StatusBadge,
  EmptyState,
  LoadingState,
  ErrorState,
  Button,
} from '../../../components/ui';
import { adminApiClient } from '../../../lib/api';
import { useAdminAuth } from '../../../lib/auth-context';
import type {
  MerchantVerificationItemDto,
  MerchantVerificationDetailResponseDto,
  DriverVerificationItemDto,
  DriverVerificationDetailResponseDto,
  VerificationAuditLogItemDto,
} from '@platform/api-client';

type TabType = 'MERCHANT' | 'DRIVER';
type StatusFilterType = '' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
type ActionType = 'APPROVE' | 'REJECT' | 'SUSPEND' | 'REACTIVATE';

interface ActionModalState {
  open: boolean;
  action: ActionType;
  profileId: string;
  targetName: string;
  currentStatus: string;
  reason: string;
  reasonError: string | null;
  submitting: boolean;
  error: string | null;
}

export default function VerifikasiPage() {
  const { admin } = useAdminAuth();
  const permissions = useMemo(() => admin?.permissions ?? [], [admin]);
  const hasWritePermission = permissions.includes('admin:write');
  const hasOpsPermission = permissions.includes('admin:ops');

  // View state
  const [activeTab, setActiveTab] = useState<TabType>('MERCHANT');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // List data state
  const [merchantItems, setMerchantItems] = useState<MerchantVerificationItemDto[]>([]);
  const [driverItems, setDriverItems] = useState<DriverVerificationItemDto[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Detail data state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [merchantDetail, setMerchantDetail] = useState<MerchantVerificationDetailResponseDto | null>(null);
  const [driverDetail, setDriverDetail] = useState<DriverVerificationDetailResponseDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Action modal & Feedback state
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch list data
  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      if (activeTab === 'MERCHANT') {
        const res = await adminApiClient.listMerchantVerifications({
          status: statusFilter ? (statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED') : undefined,
          q: appliedSearch || undefined,
          page: currentPage,
          limit: pageSize,
        });
        setMerchantItems(res.items);
        setTotalItems(res.total);
      } else {
        const res = await adminApiClient.listDriverVerifications({
          status: statusFilter ? (statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED') : undefined,
          q: appliedSearch || undefined,
          page: currentPage,
          limit: pageSize,
        });
        setDriverItems(res.items);
        setTotalItems(res.total);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat daftar verifikasi';
      setListError(msg);
    } finally {
      setLoadingList(false);
    }
  }, [activeTab, statusFilter, appliedSearch, currentPage]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Fetch detail data when selection changes
  const fetchDetail = useCallback(async (profileId: string) => {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      if (activeTab === 'MERCHANT') {
        const res = await adminApiClient.getMerchantVerificationDetail(profileId);
        setMerchantDetail(res);
      } else {
        const res = await adminApiClient.getDriverVerificationDetail(profileId);
        setDriverDetail(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat rincian profil verifikasi';
      setDetailError(msg);
    } finally {
      setLoadingDetail(false);
    }
  }, [activeTab]);

  const handleSelectProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    fetchDetail(profileId);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSelectedProfileId(null);
    setMerchantDetail(null);
    setDriverDetail(null);
    setFeedback(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setAppliedSearch(searchQuery.trim());
  };

  const handleSearchReset = () => {
    setSearchQuery('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  const openActionModal = (
    action: ActionType,
    profileId: string,
    targetName: string,
    currentStatus: string,
  ) => {
    setActionModal({
      open: true,
      action,
      profileId,
      targetName,
      currentStatus,
      reason: '',
      reasonError: null,
      submitting: false,
      error: null,
    });
  };

  const closeActionModal = () => {
    if (!actionModal?.submitting) {
      setActionModal(null);
    }
  };

  const handleActionSubmit = async () => {
    if (!actionModal) return;

    const { action, profileId, reason } = actionModal;
    const trimmedReason = reason.trim();

    // Client-side validation for reason
    if (action !== 'APPROVE') {
      if (!trimmedReason) {
        setActionModal((prev) => prev ? { ...prev, reasonError: 'Alasan tindakan wajib diisi' } : null);
        return;
      }
      if (trimmedReason.length < 3) {
        setActionModal((prev) => prev ? { ...prev, reasonError: 'Alasan minimal 3 karakter' } : null);
        return;
      }
      if (trimmedReason.length > 1000) {
        setActionModal((prev) => prev ? { ...prev, reasonError: 'Alasan maksimal 1000 karakter' } : null);
        return;
      }
    } else if (trimmedReason.length > 1000) {
      setActionModal((prev) => prev ? { ...prev, reasonError: 'Catatan persetujuan maksimal 1000 karakter' } : null);
      return;
    }

    setActionModal((prev) => prev ? { ...prev, submitting: true, error: null } : null);

    // Generate UUIDv7-style idempotency key for this distinct admin action
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      if (activeTab === 'MERCHANT') {
        let updated: MerchantVerificationDetailResponseDto;
        if (action === 'APPROVE') {
          updated = await adminApiClient.approveMerchant(profileId, { reason: trimmedReason || undefined }, { idempotencyKey });
        } else if (action === 'REJECT') {
          updated = await adminApiClient.rejectMerchant(profileId, { reason: trimmedReason }, { idempotencyKey });
        } else if (action === 'SUSPEND') {
          updated = await adminApiClient.suspendMerchant(profileId, { reason: trimmedReason }, { idempotencyKey });
        } else {
          updated = await adminApiClient.reactivateMerchant(profileId, { reason: trimmedReason }, { idempotencyKey });
        }
        setMerchantDetail(updated);
      } else {
        let updated: DriverVerificationDetailResponseDto;
        if (action === 'APPROVE') {
          updated = await adminApiClient.approveDriver(profileId, { reason: trimmedReason || undefined }, { idempotencyKey });
        } else if (action === 'REJECT') {
          updated = await adminApiClient.rejectDriver(profileId, { reason: trimmedReason }, { idempotencyKey });
        } else if (action === 'SUSPEND') {
          updated = await adminApiClient.suspendDriver(profileId, { reason: trimmedReason }, { idempotencyKey });
        } else {
          updated = await adminApiClient.reactivateDriver(profileId, { reason: trimmedReason }, { idempotencyKey });
        }
        setDriverDetail(updated);
      }

      setFeedback({
        type: 'success',
        message: `Tindakan ${action} berhasil diterapkan pada profil ${actionModal.targetName}`,
      });
      setActionModal(null);
      fetchList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses tindakan verifikasi';
      setActionModal((prev) => prev ? { ...prev, submitting: false, error: msg } : null);
    }
  };

  const renderBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <StatusBadge variant="warning">Menunggu (PENDING)</StatusBadge>;
      case 'APPROVED':
        return <StatusBadge variant="success">Disetujui (APPROVED)</StatusBadge>;
      case 'REJECTED':
        return <StatusBadge variant="danger">Ditolak (REJECTED)</StatusBadge>;
      case 'SUSPENDED':
        return <StatusBadge variant="neutral">Ditangguhkan (SUSPENDED)</StatusBadge>;
      default:
        return <StatusBadge variant="neutral">{status}</StatusBadge>;
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentDetail = activeTab === 'MERCHANT' ? merchantDetail : driverDetail;

  return (
    <div>
      <PageHeader
        title="Verifikasi Merchant & Driver"
        description="Tinjau dan kelola status verifikasi profil merchant dan driver"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <span
              className={`admin-badge ${hasWritePermission ? 'admin-badge-success' : 'admin-badge-neutral'}`}
              title="Izin admin:write diperlukan untuk menyetujui atau menolak"
            >
              WRITE: {hasWritePermission ? 'Tersedia' : 'Tidak Ada'}
            </span>
            <span
              className={`admin-badge ${hasOpsPermission ? 'admin-badge-info' : 'admin-badge-neutral'}`}
              title="Izin admin:ops diperlukan untuk menangguhkan atau mengaktifkan kembali"
            >
              OPS: {hasOpsPermission ? 'Tersedia' : 'Tidak Ada'}
            </span>
          </div>
        }
      />

      <EmptyState
        title="Data belum tersedia"
        description="Modul verifikasi mitra belum diaktifkan. Alur peninjauan dokumen identitas, kelayakan kendaraan, dan profil merchant akan diintegrasikan pada fase operasional berikutnya."
      />
      {feedback && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: feedback.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: feedback.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => handleTabChange('MERCHANT')}
          style={{
            padding: '10px 20px',
            fontWeight: activeTab === 'MERCHANT' ? 600 : 500,
            borderBottom: activeTab === 'MERCHANT' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'MERCHANT' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            fontSize: '0.9375rem',
          }}
        >
          Merchant Profiles
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('DRIVER')}
          style={{
            padding: '10px 20px',
            fontWeight: activeTab === 'DRIVER' ? 600 : 500,
            borderBottom: activeTab === 'DRIVER' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'DRIVER' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            fontSize: '0.9375rem',
          }}
        >
          Driver Profiles
        </button>
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Status:
            </span>
            {(['', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`admin-btn ${statusFilter === st ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '0.8125rem' }}
              >
                {st === '' ? 'Semua' : st}
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder={activeTab === 'MERCHANT' ? 'Cari telepon / nama bisnis...' : 'Cari telepon / nama driver...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '0.875rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                width: '240px',
              }}
            />
            <Button type="submit" variant="secondary" style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>
              Cari
            </Button>
            {appliedSearch && (
              <button
                type="button"
                onClick={handleSearchReset}
                className="admin-btn admin-btn-ghost"
                style={{ padding: '6px 8px', fontSize: '0.8125rem' }}
              >
                Reset
              </button>
            )}
          </form>
        </div>
      </Card>

      {/* Main Grid: List on Left, Detail on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedProfileId ? '1fr 1.1fr' : '1fr', gap: '24px' }}>
        {/* Left Column: Queue Table */}
        <div>
          {loadingList && (
            <div style={{ padding: '48px 0' }}>
              <LoadingState message={`Memuat antrean verifikasi ${activeTab === 'MERCHANT' ? 'merchant' : 'driver'}...`} />
            </div>
          )}

          {listError && !loadingList && (
            <div style={{ padding: '24px 0' }}>
              <ErrorState
                title="Gagal Memuat Antrean"
                message={listError}
                onRetry={fetchList}
                retryLabel="Coba Lagi"
              />
            </div>
          )}

          {!loadingList && !listError && (
            <>
              {((activeTab === 'MERCHANT' && merchantItems.length === 0) ||
                (activeTab === 'DRIVER' && driverItems.length === 0)) ? (
                <EmptyState
                  title="Tidak ada profil verifikasi"
                  description={
                    appliedSearch || statusFilter
                      ? 'Tidak ada profil yang sesuai dengan filter atau kata kunci pencarian.'
                      : `Belum ada profil ${activeTab === 'MERCHANT' ? 'merchant' : 'driver'} yang terdaftar pada sistem.`
                  }
                />
              ) : (
                <div className="table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">Nama / Entitas</th>
                        <th scope="col">No. Telepon</th>
                        <th scope="col">Status</th>
                        <th scope="col">Tgl Daftar</th>
                        <th scope="col">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab === 'MERCHANT'
                        ? merchantItems.map((item) => (
                            <tr
                              key={item.profileId}
                              style={{
                                backgroundColor: selectedProfileId === item.profileId ? 'var(--color-primary-light)' : undefined,
                                cursor: 'pointer',
                              }}
                              onClick={() => handleSelectProfile(item.profileId)}
                            >
                              <td>
                                <div style={{ fontWeight: 600 }}>{item.businessName || 'Tanpa Nama Bisnis'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  ID: {item.profileId.substring(0, 8)}...
                                </div>
                              </td>
                              <td style={{ fontSize: '0.875rem' }}>{item.phone}</td>
                              <td>{renderBadge(item.status)}</td>
                              <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                {new Date(item.createdAt).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-outline"
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectProfile(item.profileId);
                                  }}
                                >
                                  Tinjau
                                </button>
                              </td>
                            </tr>
                          ))
                        : driverItems.map((item) => (
                            <tr
                              key={item.profileId}
                              style={{
                                backgroundColor: selectedProfileId === item.profileId ? 'var(--color-primary-light)' : undefined,
                                cursor: 'pointer',
                              }}
                              onClick={() => handleSelectProfile(item.profileId)}
                            >
                              <td>
                                <div style={{ fontWeight: 600 }}>{item.fullName || 'Tanpa Nama Driver'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  ID: {item.profileId.substring(0, 8)}...
                                </div>
                              </td>
                              <td style={{ fontSize: '0.875rem' }}>{item.phone}</td>
                              <td>{renderBadge(item.status)}</td>
                              <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                                {new Date(item.createdAt).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-outline"
                                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectProfile(item.profileId);
                                  }}
                                >
                                  Tinjau
                                </button>
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Menampilkan halaman {currentPage} dari {totalPages} (Total: {totalItems})
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="admin-btn admin-btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '0.8125rem' }}
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="admin-btn admin-btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '0.8125rem' }}
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Selected Profile Detail & Action Controls */}
        {selectedProfileId && (
          <div>
            {loadingDetail && (
              <div style={{ padding: '48px 0' }}>
                <LoadingState message="Memuat detail profil dan riwayat audit..." />
              </div>
            )}

            {detailError && !loadingDetail && (
              <ErrorState
                title="Gagal Memuat Detail"
                message={detailError}
                onRetry={() => fetchDetail(selectedProfileId)}
                retryLabel="Coba Lagi"
              />
            )}

            {!loadingDetail && !detailError && currentDetail && (
              <Card
                title={`Detail Profil ${activeTab === 'MERCHANT' ? 'Merchant' : 'Driver'}`}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProfileId(null);
                      setMerchantDetail(null);
                      setDriverDetail(null);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.25rem' }}
                  >
                    ✕
                  </button>
                }
              >
                {/* Profile Identity Data */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Status Saat Ini:</span>
                    <div>{renderBadge(currentDetail.status)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      {activeTab === 'MERCHANT' ? 'Nama Bisnis:' : 'Nama Lengkap:'}
                    </span>
                    <strong style={{ fontSize: '0.9375rem' }}>
                      {activeTab === 'MERCHANT'
                        ? (currentDetail as MerchantVerificationDetailResponseDto).businessName || '—'
                        : (currentDetail as DriverVerificationDetailResponseDto).fullName || '—'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>No. Telepon (E.164):</span>
                    <span>{currentDetail.phone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Profile ID:</span>
                    <code style={{ fontSize: '0.75rem' }}>{currentDetail.profileId}</code>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Canonical User ID:</span>
                    <code style={{ fontSize: '0.75rem' }}>{currentDetail.userId}</code>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Terdaftar Pada:</span>
                    <span style={{ fontSize: '0.8125rem' }}>
                      {new Date(currentDetail.createdAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Terakhir Diperbarui:</span>
                    <span style={{ fontSize: '0.8125rem' }}>
                      {new Date(currentDetail.updatedAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Controlled Status Actions */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-canvas)',
                    border: '1px solid var(--color-border)',
                    marginBottom: '24px',
                  }}
                >
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px' }}>
                    Tindakan Status Administratif
                  </div>

                  {/* Matrix Controls */}
                  {currentDetail.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        disabled={!hasWritePermission}
                        className="admin-btn admin-btn-primary"
                        onClick={() =>
                          openActionModal(
                            'APPROVE',
                            currentDetail.profileId,
                            (activeTab === 'MERCHANT'
                              ? (currentDetail as MerchantVerificationDetailResponseDto).businessName
                              : (currentDetail as DriverVerificationDetailResponseDto).fullName) || currentDetail.phone,
                            currentDetail.status,
                          )
                        }
                      >
                        Setujui Profil (APPROVE)
                      </button>
                      <button
                        type="button"
                        disabled={!hasWritePermission}
                        className="admin-btn admin-btn-danger"
                        onClick={() =>
                          openActionModal(
                            'REJECT',
                            currentDetail.profileId,
                            (activeTab === 'MERCHANT'
                              ? (currentDetail as MerchantVerificationDetailResponseDto).businessName
                              : (currentDetail as DriverVerificationDetailResponseDto).fullName) || currentDetail.phone,
                            currentDetail.status,
                          )
                        }
                      >
                        Tolak Profil (REJECT)
                      </button>
                    </div>
                  )}

                  {currentDetail.status === 'APPROVED' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        disabled={!hasWritePermission || !hasOpsPermission}
                        className="admin-btn admin-btn-danger"
                        onClick={() =>
                          openActionModal(
                            'SUSPEND',
                            currentDetail.profileId,
                            (activeTab === 'MERCHANT'
                              ? (currentDetail as MerchantVerificationDetailResponseDto).businessName
                              : (currentDetail as DriverVerificationDetailResponseDto).fullName) || currentDetail.phone,
                            currentDetail.status,
                          )
                        }
                      >
                        Tangguhkan Profil (SUSPEND)
                      </button>
                    </div>
                  )}

                  {currentDetail.status === 'SUSPENDED' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        disabled={!hasWritePermission || !hasOpsPermission}
                        className="admin-btn admin-btn-primary"
                        onClick={() =>
                          openActionModal(
                            'REACTIVATE',
                            currentDetail.profileId,
                            (activeTab === 'MERCHANT'
                              ? (currentDetail as MerchantVerificationDetailResponseDto).businessName
                              : (currentDetail as DriverVerificationDetailResponseDto).fullName) || currentDetail.phone,
                            currentDetail.status,
                          )
                        }
                      >
                        Aktifkan Kembali (REACTIVATE)
                      </button>
                    </div>
                  )}

                  {currentDetail.status === 'REJECTED' && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      Profil ini berstatus <strong>REJECTED</strong>. Sesuai arsitektur Fase 2A2, peninjauan ulang profil yang ditolak tidak dapat diaktifkan kembali oleh Admin secara sepihak dan harus melalui alur resubmission pendaftaran.
                    </div>
                  )}

                  {/* Permission warning if disabled */}
                  {((currentDetail.status === 'PENDING' && !hasWritePermission) ||
                    ((currentDetail.status === 'APPROVED' || currentDetail.status === 'SUSPENDED') && (!hasWritePermission || !hasOpsPermission))) && (
                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-danger)' }}>
                      Akun Anda tidak memiliki izin administratif yang cukup untuk menjalankan tindakan ini (Dibutuhkan: {currentDetail.status === 'PENDING' ? 'WRITE' : 'WRITE + OPS'}).
                    </div>
                  )}
                </div>

                {/* Audit Trail Timeline */}
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px' }}>
                    Riwayat Audit Verifikasi ({currentDetail.auditLogs?.length ?? 0})
                  </div>

                  {!currentDetail.auditLogs || currentDetail.auditLogs.length === 0 ? (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: '12px 0' }}>
                      Belum ada catatan audit verifikasi untuk profil ini.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {currentDetail.auditLogs.map((log: VerificationAuditLogItemDto) => (
                        <div
                          key={log.id}
                          style={{
                            padding: '12px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                              {log.action}: {log.fromStatus} → {log.toStatus}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {new Date(log.createdAt).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            Operator: <strong>{log.actorAdminUsername || log.actorAdminId}</strong>
                            {log.requestId && <span> • ReqID: <code>{log.requestId}</code></span>}
                          </div>
                          {log.reason && (
                            <div
                              style={{
                                marginTop: '4px',
                                padding: '6px 8px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--color-bg-canvas)',
                                fontSize: '0.8125rem',
                                color: 'var(--color-text-primary)',
                                fontStyle: 'italic',
                              }}
                            >
                              &ldquo;{log.reason}&rdquo;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Confirmation & Reason Modal */}
      {actionModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.125rem', fontWeight: 600 }}>
              Konfirmasi Tindakan: {actionModal.action}
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Anda akan melakukan <strong>{actionModal.action}</strong> terhadap profil{' '}
              <strong>{actionModal.targetName}</strong> (Status saat ini: {actionModal.currentStatus}).
            </p>

            {actionModal.error && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-danger-bg)',
                  color: 'var(--color-danger)',
                  fontSize: '0.8125rem',
                }}
              >
                {actionModal.error}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="verification-reason"
                style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}
              >
                {actionModal.action === 'APPROVE'
                  ? 'Catatan Persetujuan (Opsional, maks 1000 karakter):'
                  : 'Alasan Tindakan (Wajib, 3–1000 karakter):'}
              </label>
              <textarea
                id="verification-reason"
                rows={3}
                value={actionModal.reason}
                onChange={(e) =>
                  setActionModal((prev) =>
                    prev ? { ...prev, reason: e.target.value, reasonError: null } : null,
                  )
                }
                placeholder={
                  actionModal.action === 'APPROVE'
                    ? 'Tambahkan catatan jika diperlukan...'
                    : 'Tuliskan alasan yang jelas untuk tindakan ini...'
                }
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '0.875rem',
                  border: `1px solid ${actionModal.reasonError ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  resize: 'vertical',
                }}
              />
              {actionModal.reasonError && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '4px' }}>
                  {actionModal.reasonError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                disabled={actionModal.submitting}
                className="admin-btn admin-btn-secondary"
                onClick={closeActionModal}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionModal.submitting}
                className={`admin-btn ${
                  actionModal.action === 'APPROVE' || actionModal.action === 'REACTIVATE'
                    ? 'admin-btn-primary'
                    : 'admin-btn-danger'
                }`}
                onClick={handleActionSubmit}
              >
                {actionModal.submitting ? 'Memproses...' : `Ya, ${actionModal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
