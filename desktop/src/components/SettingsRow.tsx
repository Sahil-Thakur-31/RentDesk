import type { ReactNode } from 'react';

interface SettingsSectionProps {
  title?: string;
  children: ReactNode;
}

export const SettingsSection = ({ title, children }: SettingsSectionProps) => (
  <div>
    {title && <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{title}</div>}
    <div className="divide-y divide-black/5 rounded-3xl border border-black/5 bg-white shadow-sm">{children}</div>
  </div>
);

interface SettingsRowProps {
  icon?: ReactNode;
  label: string;
  description?: string;
  control?: ReactNode;
  danger?: boolean;
  align?: 'center' | 'start';
}

const SettingsRow = ({ icon, label, description, control, danger, align = 'center' }: SettingsRowProps) => (
  <div className={`flex flex-wrap items-${align === 'start' ? 'start' : 'center'} justify-between gap-4 px-5 py-4`}>
    <div className="flex min-w-0 items-center gap-3">
      {icon && (
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            danger ? 'bg-red-50 text-red-600' : 'bg-[var(--surface-2)] text-[var(--muted)]'
          }`}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className={`text-sm font-semibold ${danger ? 'text-red-700' : 'text-[var(--text)]'}`}>{label}</div>
        {description && <div className="mt-0.5 text-xs text-[var(--muted)]">{description}</div>}
      </div>
    </div>
    {control && <div className="shrink-0">{control}</div>}
  </div>
);

export default SettingsRow;
