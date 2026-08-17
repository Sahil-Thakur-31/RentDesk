export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  id: string;
  closing: boolean;
  resolve: (value: boolean) => void;
}

type Listener = (state: ConfirmState | null) => void;

let state: ConfirmState | null = null;
const listeners = new Set<Listener>();

const emit = () => {
  listeners.forEach((listener) => listener(state));
};

export const confirmDialog = (options: ConfirmOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    state = { ...options, id: `confirm-${Date.now()}`, closing: false, resolve };
    emit();
  });
};

export const answerConfirm = (value: boolean) => {
  if (!state) return;
  state.resolve(value);
  state = { ...state, closing: true };
  emit();
  window.setTimeout(() => {
    state = null;
    emit();
  }, 180);
};

export const subscribeConfirm = (listener: Listener) => {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
};

export const getConfirmSnapshot = () => state;
