import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Card({
  title,
  action,
  footer,
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div className={`admin-card ${className}`} {...props}>
      {title && (
        <div className="admin-card-header">
          <h3 className="admin-card-title">{title}</h3>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="admin-card-body">{children}</div>
      {footer && <div className="admin-card-footer">{footer}</div>}
    </div>
  );
}
