export interface LifecycleHandlers {
  /** The page went to the background, was locked or is being left. */
  onHide(): void;
  /** The page is visible again, including a restore from the back/forward cache. */
  onShow(): void;
}

interface LifecycleTargets {
  doc?: EventTarget & { readonly visibilityState: DocumentVisibilityState };
  win?: EventTarget;
}

// Translates page lifecycle events into hide/show. Duplicates are expected (for example
// visibilitychange followed by pagehide); handlers must be idempotent.
// No unload/beforeunload listeners, so the page stays eligible for the back/forward cache.
export function createLifecycle(
  { onHide, onShow }: LifecycleHandlers,
  { doc = document, win = window }: LifecycleTargets = {},
): void {
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') onHide();
    else onShow();
  });
  win.addEventListener('pagehide', () => onHide());
  win.addEventListener('pageshow', (event) => {
    // A normal load already starts idle; only a cache restore needs handling.
    if ((event as PageTransitionEvent).persisted && doc.visibilityState === 'visible') onShow();
  });
}
