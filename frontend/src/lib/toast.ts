type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let nextId = 0;
let setToasts: ((updater: Toast[] | ((prev: Toast[]) => Toast[])) => void) | null = null;

const AUTO_DISMISS_MS = 4000;
const MAX_TOASTS = 3;

function show(type: ToastType, message: string) {
  if (!setToasts) return;

  const id = ++nextId;

  setToasts((prev: Toast[]) => {
    const next = [...prev, { id, type, message }];
    return next.slice(-MAX_TOASTS);
  });

  setTimeout(() => {
    dismiss(id);
  }, AUTO_DISMISS_MS);
}

function dismiss(id: number) {
  if (!setToasts) return;
  setToasts((prev: Toast[]) => prev.filter((t) => t.id !== id));
}

export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  info: (message: string) => show('info', message),
};

export function initToast(setter: typeof setToasts) {
  setToasts = setter;
}

export type { Toast as ToastItem };
