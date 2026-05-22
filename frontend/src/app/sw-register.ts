// Enhanced service worker registration with update hooks and skip-waiting support
export function registerSW(
  options?: {
    onUpdate?: (reg: ServiceWorkerRegistration) => void;
    onSuccess?: (reg: ServiceWorkerRegistration) => void;
  }
) {
  const { onUpdate, onSuccess } = options || {};
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // Helper to post message(s) to the waiting service worker asking it to skipWaiting
  async function sendSkipWaitingMessage() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to send SKIP_WAITING message', e);
    }
  }

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      // If there's an active, waiting SW it means a new version is already installed
      if (reg.waiting) {
        onUpdate?.(reg);
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') {
            // If there's a controller, the page is currently controlled -> this is an update
            if (navigator.serviceWorker.controller) {
              onUpdate?.(reg);
            } else {
              onSuccess?.(reg);
            }
          }
        });
      });

      // Listen for messages from the SW (e.g. NEW_VERSION_AVAILABLE)
      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === 'NEW_VERSION_AVAILABLE') {
          onUpdate?.(reg);
        }
      });

      // When the new SW takes control, reload so the client gets the new assets
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      // Expose a helper on window to allow manual skipWaiting via UI flows
      // (useful for QA and programmatic flows)
      // eslint-disable-next-line no-param-reassign
      (window as any).__yotop10_sendSkipWaiting = sendSkipWaitingMessage;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('SW registration failed:', err);
    }
  });
}

export async function sendSkipWaiting() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to send SKIP_WAITING', e);
  }
}
