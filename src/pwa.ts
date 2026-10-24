import { registerSW } from 'virtual:pwa-register';

// Registers the service worker only. A new version is left waiting on purpose:
// no update prompt, no skipWaiting and no reload, so an active game is never interrupted.
export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisterError: (error: unknown) => console.warn('Service worker registration failed', error),
  });
}
