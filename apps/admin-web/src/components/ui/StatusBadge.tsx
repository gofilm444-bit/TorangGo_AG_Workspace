import React from 'react';

export interface StatusBadgeProps {
  variant?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  variant = 'neutral',
  children,
  showDot = true,
  className = '',
}: StatusBadgeProps) {
  return (
    <span className={`admin-badge admin-badge-${variant} ${className}`}>
      {showDot && <span className="admin-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
