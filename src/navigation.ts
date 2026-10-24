export type Screen = 'home' | 'about';

export const INITIAL_SCREEN: Screen = 'home';

export function isScreen(value: unknown): value is Screen {
  return value === 'home' || value === 'about';
}

// Screen state lives in memory only, so a reload always starts on home.
export function createNavigation(
  screens: Record<Screen, HTMLElement>,
  onChange?: (screen: Screen) => void,
) {
  let current: Screen = INITIAL_SCREEN;

  function show(next: Screen): void {
    if (next === current) return;
    current = next;
    for (const [name, element] of Object.entries(screens) as [Screen, HTMLElement][]) {
      // `hidden` removes the inactive screen from layout, tab order and the accessibility tree.
      element.hidden = name !== next;
    }
    window.scrollTo(0, 0);
    screens[next].querySelector<HTMLElement>('h1')?.focus();
    onChange?.(next);
  }

  return {
    show,
    get current(): Screen {
      return current;
    },
  };
}
