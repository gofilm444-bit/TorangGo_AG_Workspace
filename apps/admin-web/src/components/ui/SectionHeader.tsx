import React from 'react';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  action,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`section-header ${className}`}>
      <div>
        <h2 className="section-header-title">{title}</h2>
        {description && <p className="section-header-desc">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
