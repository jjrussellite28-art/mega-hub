// Switching Mega Hub to the next screen on the start choice and the profile picker only: LB/RB (Page Up/Down on the keyboard),
// the mouse's side buttons (back/forward) and the clickable ◀ ▶ arrows. Everywhere else LB/RB switch tabs again.

import { api } from '../core/api.js';
import { el } from '../core/dom.js';
import { attempt } from '../core/feedback.js';
import { t } from '../core/i18n.js';
import { sound } from '../sound.js';
import { listScreens } from '../views/display.js';
import { stepNumber } from '../core/screen-rules.js';

/** Moves Mega Hub to the next screen (no code asked: this is the start choice). Resolves the new screen list, or null. */
export async function stepScreen(d) {
  const next = stepNumber(await listScreens(), d);
  if (next === null) return null;
  const list = await attempt(() => api.setScreen(next), t('display.screen.failed'));
  if (list) sound.move?.();
  return list ?? null;
}

/** The two arrows with the name of the screen between them; hidden with one screen. `onStep(d)` does the moving. */
export function screenArrows(onStep) {
  const label = el('span', { className: 'screen-arrows-label' });
  const box = el('div', { className: 'screen-arrows', hidden: true },
    el('button', { className: 'screen-arrow', type: 'button', textContent: '◀', ariaLabel: t('screens.previous'), onclick: () => onStep(-1) }),
    label,
    el('button', { className: 'screen-arrow', type: 'button', textContent: '▶', ariaLabel: t('screens.next'), onclick: () => onStep(1) }));
  box.set = (screens) => {
    box.hidden = !screens || screens.length < 2;
    const now = screens?.find((s) => s.chosen) ?? screens?.find((s) => s.primary);
    label.textContent = now ? `${t('display.screen.number', { n: now.number })}${now.primary ? ` · ${t('screens.main')}` : ''}` : '';
  };
  return box;
}

/** The mouse's back/forward buttons while a page is open; returns the function that stops listening. */
export function bindSideButtons(onStep) {
  const on = (e) => {
    if (e.button !== 3 && e.button !== 4) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'mouseup') onStep(e.button === 3 ? -1 : 1);
  };
  const types = ['mousedown', 'mouseup', 'auxclick'];
  types.forEach((n) => window.addEventListener(n, on, true));
  return () => types.forEach((n) => window.removeEventListener(n, on, true));
}
