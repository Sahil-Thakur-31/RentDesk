import type { ReactNode } from 'react';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

const toneStyles: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  warning: 'bg-amber-50 text-amber-600 border-amber-100',
  danger: 'bg-red-50 text-red-600 border-red-100',
  info: 'bg-sky-50 text-sky-600 border-sky-100',
  accent: 'bg-violet-50 text-violet-600 border-violet-100',
  neutral: 'bg-black/5 text-[var(--muted)] border-black/5'
};

const dotStyles: Record<BadgeTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  accent: 'bg-violet-500',
  neutral: 'bg-slate-400'
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

const Badge = ({ tone = 'neutral', children, dot = true, className = '' }: BadgeProps) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${toneStyles[tone]} ${className}`}
  >
    {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[tone]}`} />}
    {children}
  </span>
);

export default Badge;
