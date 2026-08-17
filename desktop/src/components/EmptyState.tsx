import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

const defaultIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h18M3 12h18M3 17h10" />
  </svg>
);

const EmptyState = ({ title, description, icon, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-1)] text-[var(--muted)]">
      {icon || defaultIcon}
    </div>
    <div className="text-sm font-semibold text-[var(--text)]">{title}</div>
    {description && <div className="max-w-sm text-sm text-[var(--muted)]">{description}</div>}
    {action}
  </div>
);

export default EmptyState;
