import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
}

const tones: Record<string, { text: string; bar: string; iconBg: string; iconText: string }> = {
  default: { text: 'text-[var(--accent)]', bar: 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]', iconBg: 'bg-teal-50', iconText: 'text-[var(--accent)]' },
  success: { text: 'text-[var(--success)]', bar: 'bg-[var(--success)]', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
  warning: { text: 'text-[var(--warning)]', bar: 'bg-[var(--warning)]', iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
  danger: { text: 'text-[var(--danger)]', bar: 'bg-[var(--danger)]', iconBg: 'bg-red-50', iconText: 'text-red-600' }
};

const StatCard = ({ label, value, subLabel, tone = 'default', icon }: StatCardProps) => {
  const { t } = useI18n();
  const toneStyle = tones[tone];

  return (
    <div className="card card-hover relative overflow-hidden p-5">
      <div className={`absolute left-0 top-0 h-1 w-full ${toneStyle.bar}`} />
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{t(label)}</div>
        {icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneStyle.iconBg} ${toneStyle.iconText}`}>
            {icon}
          </div>
        )}
      </div>
      <div className={`mt-2 text-xl font-semibold whitespace-nowrap ${toneStyle.text}`}>{value}</div>
      {subLabel && (
        <div className="mt-1 text-xs text-[var(--muted)]">{typeof subLabel === 'string' ? t(subLabel) : subLabel}</div>
      )}
    </div>
  );
};

export default StatCard;
