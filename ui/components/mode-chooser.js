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
import { chooseLayout, listScreens } from '../views/display.js';
import { confirmDialog } from './overlay.js';
import { ensureUnlocked } from './passcode.js';
import { startProfiles } from './profiles.js';
import { bindSideButtons, screenArrows, stepScreen } from './screen-switch.js';

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
    screenIndex: 1,
    screens: [],
    busy: false,
    // LB/RB (Page Up/Down) move Mega Hub to the next screen here; after this page they switch tabs again.
    captures: (action) => action === 'lb' || action === 'rb',
    // The tiles, chips and Next button handle their own clicks (onclick below). Without this the app's general mouse handler counted a click on a
    // tile a second time as "A" on whatever the first click had moved to, which opened the Display chip.
    pointer() {},
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
      // The mouse works as well: a click takes the mode (like A) and goes down to the next row.
      this.tiles.forEach((tile, i) => { tile.onclick = () => this.pick(ROW_MODES, i); });
      this.screenRow = el('ul', { className: 'mode-screens' });
      this.arrows = screenArrows((d) => this.step(d));
      // Which screens are connected: size, the Windows main screen and where Mega Hub is now.
      this.screenInfo = el('ul', { className: 'mode-screen-info' });
      this.unbind = bindSideButtons((d) => this.step(d));
      this.nextBtn = el('button', { className: 'mode-next', type: 'button', textContent: t('modeask.next'), onclick: () => this.next() });
      root.append(el('div', { className: 'profile-picker mode-chooser' },
        el('h2', { textContent: t('modeask.title') }),
        el('ul', { className: 'profile-tiles' }, this.tiles),
        el('p', { className: 'profile-greeting', textContent: t('modeask.screens') }),
        this.screenRow,
        this.arrows,
        this.screenInfo,
        this.nextBtn));
      this.update();
      // The list of screens comes from the host; with one screen the section stays out.
      listScreens().then((list) => {
        this.screens = list ?? [];
        // One screen by default: the one Mega Hub is on now (else the Windows main screen); mirroring stays a choice.
        const here = this.screens.find((s) => s.chosen) ?? this.screens.find((s) => s.primary);
        if (here) this.screenIndex = 2 + this.screens.indexOf(here);
        this.arrows.set(this.screens);
        this.update();
        // Several screens: every screen shows this page and its "Screen N" label, so it can be chosen from the couch.
        if (this.screens.length > 1) attempt(() => api.screenOverlay?.(true));
      }).catch(() => {});
    },
    options() {
      // The first chip is the display settings (screens together: one, same picture, both); always there, also with one screen.
      return [{ label: `⚙ ${t('modeask.display')}`, display: true, number: 0 }, { label: t('modeask.allScreens'), number: 0 }, ...this.screens.map((s) => ({ label: `${t('display.screen.number', { n: s.number })}${s.primary ? ` · ${t('screens.main')}` : ''}`, number: s.number }))];
    },
    update() {
      if (!this.tiles) return;
      setFocused(this.tiles, this.row === ROW_MODES ? this.mode : -1);
      this.tiles.forEach((n, i) => n.classList.toggle('chosen', i === this.mode));
      const opts = this.options();
      this.screenRow.previousSibling.hidden = this.screens.length < 2;
      this.screenRow.replaceChildren(...opts.map((o, i) => el('li', { className: `mode-screen${i === this.screenIndex ? ' chosen' : ''}${this.row === ROW_SCREENS && i === this.screenIndex ? ' focused' : ''}`, textContent: o.label, onclick: () => this.pick(ROW_SCREENS, i) })));
      this.screenInfo.replaceChildren(...(this.screens.length > 1 ? this.screens : []).map((s) => el('li', {
        textContent: [t('display.screen.number', { n: s.number }), `${s.width} × ${s.height}`, s.primary ? t('screens.main') : null, s.chosen ? t('screens.here') : null].filter(Boolean).join(' · ')
      })));
      this.nextBtn.classList.toggle('focused', this.row === ROW_NEXT);
    },
    /** A mouse click on a mode or a screen: the same as moving there and pressing A. */
    pick(row, index) {
      if (this.busy) return;
      this.row = row;
      if (row === ROW_MODES) this.mode = index;
      else this.screenIndex = index;
      return this.handle('a');
    },
    /** LB/RB, the mouse's side buttons, Page Up/Down and the arrows: Mega Hub moves to the next screen, right away and without a code. */
    async step(d) {
      if (this.busy) return;
      this.busy = true;
      try {
        const list = await stepScreen(d);
        if (list) {
          this.screens = list;
          const now = list.find((s) => s.chosen);
          if (now) this.screenIndex = 2 + list.indexOf(now);
          this.arrows.set(list);
          attempt(() => api.screenOverlay?.(true));
        }
      } finally {
        this.busy = false;
        this.update();
      }
    },
    /** The display settings chip: how the screens work together; afterwards the list of screens is read again. */
    async changeDisplay() {
      this.busy = true;
      try {
        if (await chooseLayout({ guard: false })) {
          this.screens = (await listScreens()) ?? [];
          if (this.screenIndex >= this.options().length) this.screenIndex = 1;
        }
      } finally {
        this.busy = false;
        this.update();
      }
    },
    onClose() {
      this.unbind?.();
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
          // The profile picker comes next (its profile asks for its own code). With no picker (auto sign-in, one open profile) a locked
          // couch offers the unlock here; skipping keeps the limited mode (the Unlock button stays).
          const willPick = !!(await attempt(() => api.getProfiles()))?.picker;
          if (!willPick && (state.info?.locked || state.info?.codeSet)) {
            if (await confirmDialog(t('modeask.unlockNow'), t('modeask.unlock'), { cancelLabel: t('modeask.skip') })) await ensureUnlocked(t('modeask.unlock'));
          }
          removePage(this);
          render();
          if (willPick) await startProfiles().catch(console.error);
          return;
        }
        // PC at the start: Mega Hub quits completely (no RAM used, gone from Task Manager) and the normal Windows desktop is there.
        // No code and no restart: PC mode is never locked out. Mega Hub closes at once; only when the host refuses (somebody is signed in
        // already) the usual unlock comes first.
        if (!(await api.leaveToPc().then(() => true, () => false))) {
          if (!(await ensureUnlocked(t('power.quit.label')))) return;
          removePage(this);
          render();
          await attempt(() => api.quit());
        }
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
          if (row < ROW_MODES || row > ROW_NEXT) return sound.bump();
          this.row = row;
          sound.move?.();
          return this.update();
        }
        case 'lb':
          return this.step(-1);
        case 'rb':
          return this.step(1);
        case 'b':
          return sound.bump();
        case 'a':
          sound.select();
          if (this.row === ROW_NEXT) return this.next();
          if (this.row === ROW_SCREENS && this.options()[this.screenIndex]?.display) return this.changeDisplay();
          // A on a mode or a screen: take it and go down to the next row.
          this.row = this.row === ROW_MODES && this.screens.length >= 2 ? ROW_SCREENS : ROW_NEXT;
          return this.update();
        default:
      }
    },
    hints() {
      return [['A', t('modeask.hintChoose')], ['↕', t('modeask.hintRows')], ...(this.screens.length > 1 ? [['LB RB', t('screens.hintSwitch')]] : [])];
    }
  };
  push(page);
  void toast;
}
