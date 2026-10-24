import '@fontsource/heebo/400.css';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import './styles.css';
import { createNavigation, isScreen } from './navigation';

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

const navigation = createNavigation({
  home: getElement('screen-home'),
  about: getElement('screen-about'),
});

document.addEventListener('click', (event) => {
  const trigger = (event.target as Element | null)?.closest<HTMLElement>('[data-nav]');
  const target = trigger?.dataset.nav;
  if (isScreen(target)) navigation.show(target);
});
