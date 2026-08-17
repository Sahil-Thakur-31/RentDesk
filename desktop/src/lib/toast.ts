export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  leaving?: boolean;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

const emit = () => {
  listeners.forEach((listener) => listener(toasts));
};

const EXIT_DURATION = 220;

export const dismissToast = (id: string) => {
  toasts = toasts.map((item) => (item.id === id ? { ...item, leaving: true } : item));
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    emit();
  }, EXIT_DURATION);
};

const push = (type: ToastType, message: string, description?: string, duration = 4200) => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  toasts = [...toasts, { id, type, message, description }];
  emit();
  if (duration > 0) {
    window.setTimeout(() => dismissToast(id), duration);
  }
  return id;
};

export const toast = {
  success: (message: string, description?: string) => push('success', message, description),
  error: (message: string, description?: string) => push('error', message, description, 5500),
  info: (message: string, description?: string) => push('info', message, description)
};

export const subscribeToasts = (listener: Listener) => {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
};

export const getToastSnapshot = () => toasts;
