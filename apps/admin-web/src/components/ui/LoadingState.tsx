import React from 'react';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = 'Memuat data operasional...',
  className = '',
}: LoadingStateProps) {
  return (
    <div
      className={`state-container ${className}`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="spinner" aria-hidden="true" />
      <p className="state-title">{message}</p>
    </div>
  );
}
