import '@fontsource/heebo/400.css';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import './styles.css';
import { createAudioAdapter } from './audio';
import { createController } from './controller';
import { createNavigation, isScreen } from './navigation';
import { createSequencePlayer, type Scheduler } from './sequence-player';
import { loadLastResult, saveLastResult } from './storage';
import { createDomView } from './view';

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

const scheduler: Scheduler = {
  setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
};

const view = createDomView({
  onStart: () => controller.start(),
  onPlayAgain: () => controller.start(),
  onPad: (color) => controller.pressPad(color),
});

const audio = createAudioAdapter({
  onStatus: (available) => view.setAudioNotice(!available),
});

const player = createSequencePlayer({
  onLight: (color) => view.light(color),
  onTone: (color, ms) => audio.play(color, ms),
  scheduler,
});

const controller = createController({
  view,
  player,
  audio,
  results: { load: loadLastResult, save: saveLastResult },
  scheduler,
});

const navigation = createNavigation(
  {
    home: getElement('screen-home'),
    about: getElement('screen-about'),
  },
  (screen) => controller.onScreenChange(screen),
);

document.addEventListener('click', (event) => {
  const trigger = (event.target as Element | null)?.closest<HTMLElement>('[data-nav]');
  const target = trigger?.dataset.nav;
  if (isScreen(target)) navigation.show(target);
});
