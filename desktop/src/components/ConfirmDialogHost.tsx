import { useSyncExternalStore } from 'react';
import { answerConfirm, subscribeConfirm, getConfirmSnapshot } from '../lib/confirmDialog';
import { AlertTriangleIcon } from './icons';

const ConfirmDialogHost = () => {
  const state = useSyncExternalStore(subscribeConfirm, getConfirmSnapshot, getConfirmSnapshot);

  if (!state) return null;

  const danger = Boolean(state.danger);

  return (
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/35 backdrop-blur-sm p-6 ${
        state.closing ? 'confirm-backdrop-leave' : 'confirm-backdrop-enter'
      }`}
      onClick={() => answerConfirm(false)}
    >
      <div
        className={`w-full max-w-sm rounded-3xl border border-black/5 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.28)] ${
          state.closing ? 'confirm-dialog-leave' : 'confirm-dialog-enter'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${danger ? 'bg-red-50 text-[#d82525]' : 'bg-amber-50 text-[#b95709]'}`}>
          <AlertTriangleIcon width={22} height={22} />
        </div>
        <div className="mt-4 text-lg font-semibold text-[var(--text)]">{state.title}</div>
        {state.description && <div className="mt-1.5 text-sm text-[var(--muted)]">{state.description}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn btn-cancel" onClick={() => answerConfirm(false)}>
            {state.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`}
            onClick={() => answerConfirm(true)}
            autoFocus
          >
            {state.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialogHost;
