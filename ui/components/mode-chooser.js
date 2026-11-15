// Start choice: Mega Hub mode (stay in Mega Hub) or PC mode (the normal Windows desktop), then the screen, then Next.
// A near-blank page: only the clock, the bell and the Unlock button stay. It only asks; PC mode itself is the host's enterPcMode / quit.

import { api } from '../core/api.js';
import { el, setFocused } from '../core/dom.js';
import { attempt, toast } from '../core/feedback.js';
import { push, removePage, render } from '../core/nav.js';
import { state } from '../core/state.js';
import { sound } from '../sound.js';
import { t } from '../core/i18n.js';
import { getLook } from '../core/look-prefs.js';
import { listScreens } from '../views/display.js';
import { confirmDialog } from './overlay.js';
import { ensureUnlocked } from './passcode.js';

// i18n-used: modeask.couch modeask.couchHint modeask.pc modeask.pcHint
const CHOICES = [
  { id: 'couch', icon: '🛋️', picture: 'assets/mode-card-couch.png', label: 'modeask.couch', hint: 'modeask.couchHint' },
  { id: 'pc', icon: '🖥️', picture: 'assets/mode-card-pc.png', label: 'modeask.pc', hint: 'modeask.pcHint' }
];

/** Rows, top to bottom: the two modes, the screens, the Next button. */
const ROW_MODES = 0;
const ROW_SCREENS = 1;
const ROW_NEXT = 2;

export function showModeChooser() {
  // A protected profile waiting at the picker, or another page already open: stay out of the way.
  if (state.pickerHold || state.stack.length || state.overlay) return;
  const page = {
    id: 'mode-chooser',
    name: t('modeask.title'),
    row: ROW_MODES,
    mode: 0,
    /** 0 = all screens (mirror, the default); otherwise the number of one screen. */
    screenIndex: 0,
    screens: [],
    busy: false,
    build(root) {
      // The original tiles by default; the picture cards (name and logo are in them) when chosen in the setup or the settings.
      const art = getLook('modeCards') === 'art';
      this.tiles = CHOICES.map((c) => (art
        ? el('li', { className: 'profile-tile mode-card', ariaLabel: `${t(c.label)}. ${t(c.hint)}` },
          el('img', { className: 'mode-card-picture', src: c.picture, alt: '', draggable: false }))
        : el('li', { className: 'profile-tile' },
          el('span', { className: 'profile-avatar big', textContent: c.icon }),
          el('strong', { className: 'profile-name', textContent: t(c.label) }),
          el('small', { className: 'profile-lock', textContent: t(c.hint) }))));
      this.screenRow = el('ul', { className: 'mode-screens' });
      this.nextBtn = el('button', { className: 'mode-next', type: 'button', textContent: t('modeask.next'), onclick: () => this.next() });
      root.append(el('div', { className: 'profile-picker mode-chooser' },
        el('h2', { textContent: t('modeask.title') }),
        el('ul', { className: 'profile-tiles' }, this.tiles),
        el('p', { className: 'profile-greeting', textContent: t('modeask.screens') }),
        this.screenRow,
        this.nextBtn));
      this.update();
      // The list of screens comes from the host; with one screen the section stays out.
      listScreens().then((list) => {
        this.screens = list ?? [];
        this.update();
        // Several screens: every screen shows this page and its "Screen N" label, so it can be chosen from the couch.
        if (this.screens.length > 1) attempt(() => api.screenOverlay?.(true));
      }).catch(() => {});
    },
    options() {
      return [{ label: t('modeask.allScreens'), number: 0 }, ...this.screens.map((s) => ({ label: t('display.screen.number', { n: s.number }), number: s.number }))];
    },
    update() {
      if (!this.tiles) return;
      setFocused(this.tiles, this.row === ROW_MODES ? this.mode : -1);
      this.tiles.forEach((n, i) => n.classList.toggle('chosen', i === this.mode));
      const opts = this.options();
      this.screenRow.hidden = this.screens.length < 2;
      this.screenRow.previousSibling.hidden = this.screens.length < 2;
      this.screenRow.replaceChildren(...opts.map((o, i) => el('li', { className: `mode-screen${i === this.screenIndex ? ' chosen' : ''}${this.row === ROW_SCREENS && i === this.screenIndex ? ' focused' : ''}`, textContent: o.label })));
      this.nextBtn.classList.toggle('focused', this.row === ROW_NEXT);
    },
    onClose() {
      attempt(() => api.screenOverlay?.(false));
    },
    async next() {
      if (this.busy) return;
      this.busy = true;
      try {
        const choice = CHOICES[this.mode].id;
        const number = this.options()[this.screenIndex]?.number ?? 0;
        // The copies and labels stay up while the question is shown, so it can be answered from any screen.
        // One screen chosen: ask once, then Mega Hub moves there.
        if (number > 0 && this.screens.length > 1) {
          if (!(await confirmDialog(t('modeask.isThisScreen', { n: number }), t('modeask.yes')))) return;
          await attempt(() => api.setScreen(number), t('display.screen.failed'));
        }
        if (choice === 'couch') {
          // Locked: offer the unlock now; skipping keeps the limited mode (the Unlock button stays).
          if (state.info?.locked || state.info?.codeSet) {
            if (await confirmDialog(t('modeask.unlockNow'), t('modeask.unlock'), { cancelLabel: t('modeask.skip') })) await ensureUnlocked(t('modeask.unlock'));
          }
          removePage(this);
          return render();
        }
        // PC at the start: Mega Hub quits completely (no RAM used, gone from Task Manager) and the normal Windows desktop is there.
        if (!(await ensureUnlocked(t('power.quit.label')))) return;
        removePage(this);
        render();
        await attempt(() => api.quit());
      } finally {
        this.busy = false;
      }
    },
    async handle(action) {
      if (this.busy) return;
      switch (action) {
        case 'left':
        case 'right': {
          const d = action === 'left' ? -1 : 1;
          if (this.row === ROW_MODES) this.mode = (this.mode + d + CHOICES.length) % CHOICES.length;
          else if (this.row === ROW_SCREENS) {
            const n = this.options().length;
            this.screenIndex = (this.screenIndex + d + n) % n;
          } else return;
          sound.move?.();
          return this.update();
        }
        case 'down':
        case 'up': {
          const d = action === 'down' ? 1 : -1;
          let row = this.row + d;
          if (row === ROW_SCREENS && this.screens.length < 2) row += d;
          if (row < ROW_MODES || row > ROW_NEXT) return sound.bump();
          this.row = row;
          sound.move?.();
          return this.update();
        }
        case 'b':
          return sound.bump();
        case 'a':
          sound.select();
          if (this.row === ROW_NEXT) return this.next();
          // A on a mode or a screen: take it and go down to the next row.
          this.row = this.row === ROW_MODES && this.screens.length >= 2 ? ROW_SCREENS : ROW_NEXT;
          return this.update();
        default:
      }
    },
    hints() {
      return [['A', t('modeask.hintChoose')], ['↕', t('modeask.hintRows')]];
    }
  };
  push(page);
  void toast;
}
