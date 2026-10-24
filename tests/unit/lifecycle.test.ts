import { describe, expect, it, vi } from 'vitest';
import { createLifecycle } from '../../src/lifecycle';

function setup() {
  const doc = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
  });
  const win = new EventTarget();
  const onHide = vi.fn();
  const onShow = vi.fn();
  createLifecycle({ onHide, onShow }, { doc, win });

  function setVisibility(state: DocumentVisibilityState): void {
    doc.visibilityState = state;
    doc.dispatchEvent(new Event('visibilitychange'));
  }
  function pageshow(persisted: boolean): void {
    win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
  }
  return { doc, win, onHide, onShow, setVisibility, pageshow };
}

describe('lifecycle', () => {
  it('maps visibility changes to hide and show', () => {
    const { onHide, onShow, setVisibility } = setup();
    setVisibility('hidden');
    expect(onHide).toHaveBeenCalledOnce();
    expect(onShow).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(onShow).toHaveBeenCalledOnce();
  });

  it('treats pagehide as hide', () => {
    const { win, onHide } = setup();
    win.dispatchEvent(new Event('pagehide'));
    expect(onHide).toHaveBeenCalledOnce();
  });

  it('treats a back/forward cache restore as show', () => {
    const { onShow, pageshow } = setup();
    pageshow(true);
    expect(onShow).toHaveBeenCalledOnce();
  });

  it('ignores a normal page load', () => {
    const { onHide, onShow, pageshow } = setup();
    pageshow(false);
    expect(onShow).not.toHaveBeenCalled();
    expect(onHide).not.toHaveBeenCalled();
  });

  it('ignores a cache restore while the page is still hidden', () => {
    const { doc, onShow, pageshow } = setup();
    doc.visibilityState = 'hidden';
    pageshow(true);
    expect(onShow).not.toHaveBeenCalled();
  });
});
