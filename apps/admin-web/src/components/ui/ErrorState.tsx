import React from 'react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = 'Terjadi Kesalahan Sistem',
  message = 'Tidak dapat memproses permintaan operasional saat ini. Silakan coba kembali.',
  requestId,
  onRetry,
  retryLabel = 'Coba Lagi',
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`state-container ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <svg
        className="state-icon"
        style={{ color: 'var(--color-danger)' }}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      <h3 className="state-title">{title}</h3>
      <p className="state-desc">{message}</p>
      {requestId && (
        <div className="state-correlation" title="Identifier korelasi permintaan">
          Request ID: {requestId}
        </div>
      )}
      {onRetry && (
        <div className="state-actions" style={{ marginTop: '16px' }}>
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
