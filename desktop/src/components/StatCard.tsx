import { useI18n } from '../lib/i18n';

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

const tones: Record<string, { text: string; bar: string }> = {
  default: { text: 'text-[var(--accent)]', bar: 'bg-[var(--accent)]' },
  success: { text: 'text-[var(--success)]', bar: 'bg-[var(--success)]' },
  warning: { text: 'text-[var(--warning)]', bar: 'bg-[var(--warning)]' },
  danger: { text: 'text-[var(--danger)]', bar: 'bg-[var(--danger)]' }
};

const StatCard = ({ label, value, subLabel, tone = 'default' }: StatCardProps) => {
  const { t } = useI18n();

  return (
    <div className="relative overflow-hidden bg-white rounded-2xl border border-black/5 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className={`absolute left-0 top-0 h-1 w-full ${tones[tone].bar}`} />
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{t(label)}</div>
      <div className={`text-2xl font-semibold mt-2 ${tones[tone].text}`}>{value}</div>
      {subLabel && <div className="text-xs text-[var(--muted)] mt-1">{t(subLabel)}</div>}
    </div>
  );
};

export default StatCard;

