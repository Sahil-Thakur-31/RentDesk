import { useSyncExternalStore } from 'react';
import { dismissToast, subscribeToasts, getToastSnapshot, type ToastType } from '../lib/toast';
import { CheckCircleIcon, CloseIcon, InfoCircleIcon, XCircleIcon } from './icons';

const toneStyles: Record<ToastType, { bg: string; border: string; icon: string; iconBg: string }> = {
  success: { bg: 'bg-white', border: 'border-emerald-100', icon: 'text-emerald-600', iconBg: 'bg-emerald-50' },
  error: { bg: 'bg-white', border: 'border-red-100', icon: 'text-red-600', iconBg: 'bg-red-50' },
  info: { bg: 'bg-white', border: 'border-sky-100', icon: 'text-sky-600', iconBg: 'bg-sky-50' }
};

const ToneIcon = ({ type }: { type: ToastType }) => {
  if (type === 'success') return <CheckCircleIcon width={18} height={18} />;
  if (type === 'error') return <XCircleIcon width={18} height={18} />;
  return <InfoCircleIcon width={18} height={18} />;
};

const ToastViewport = () => {
  const toasts = useSyncExternalStore(subscribeToasts, getToastSnapshot, getToastSnapshot);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[200] flex w-full max-w-sm flex-col gap-2.5">
      {toasts.map((item) => {
        const tone = toneStyles[item.type];
        return (
          <div
            key={item.id}
            className={`${item.leaving ? 'toast-item-leave' : 'toast-item-enter'} pointer-events-auto flex items-start gap-3 rounded-2xl border ${tone.border} ${tone.bg} p-4 shadow-[0_20px_45px_rgba(15,23,42,0.16)]`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.iconBg} ${tone.icon}`}>
              <ToneIcon type={item.type} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-sm font-medium text-[var(--text)]">{item.message}</div>
              {item.description && <div className="mt-0.5 text-xs text-[var(--muted)]">{item.description}</div>}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text)]"
              onClick={() => dismissToast(item.id)}
              aria-label="Dismiss"
            >
              <CloseIcon width={14} height={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastViewport;
