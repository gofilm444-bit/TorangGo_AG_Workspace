import React from 'react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'Data belum tersedia',
  description = 'Belum ada catatan operasional yang tercatat untuk modul ini.',
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`state-container ${className}`} role="region" aria-label={title}>
      <svg
        className="state-icon"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
        />
      </svg>
      <h3 className="state-title">{title}</h3>
      <p className="state-desc">{description}</p>
      {action && <div className="state-actions">{action}</div>}
    </div>
  );
}
