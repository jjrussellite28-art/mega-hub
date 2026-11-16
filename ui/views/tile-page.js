// A tab of big tiles (Store, Windows): one grid, controller, keyboard and mouse. The tiles come from a list; A (or a click) runs `open`.

import { el, keepInView, setFocused } from '../core/dom.js';
import { move } from '../core/nav.js';
import { setBackground } from '../core/art.js';
import { t } from '../core/i18n.js';

const COLUMNS = 4;

/** `tiles()` returns [{ id, icon, name, note, open }]. `load()` may refresh what the tiles depend on and returns a promise. */
export function tilePage({ id, name, background, tiles, load }) {
  return {
    get name() { return typeof name === 'function' ? name() : name; },
    id,
    index: 0,
    keepsTrailer: false,
    build(root) {
      this.items = tiles();
      this.index = Math.min(this.index, Math.max(0, this.items.length - 1));
      this.cards = this.items.map((item, i) => el('button', {
        className: 'tile-card', type: 'button',
        onclick: () => { this.index = i; this.update(); item.open(); }
      },
      item.image ? el('img', { className: 'tile-image', src: item.image, alt: '' }) : el('span', { className: 'tile-icon', textContent: item.icon }),
      el('span', { className: 'tile-name', textContent: item.name }),
      el('span', { className: 'tile-note', textContent: item.note ?? '' })));
      this.scroller = el('div', { className: 'tile-grid list-scroll' }, this.cards);
      root.append(el('div', { className: 'tile-page' }, this.scroller));
      setBackground({ id: `__${id}`, name: this.name, art: {} });
      this.update({ instant: true });
      load?.().then(() => { if (this.cards?.[0]?.isConnected) { const at = this.index; this.items = tiles(); this.cards.forEach((c, i) => { const note = c.querySelector('.tile-note'); if (note) note.textContent = this.items[i]?.note ?? ''; }); this.index = at; } });
    },
    update({ instant = false } = {}) {
      if (!this.cards) return;
      setFocused(this.cards, this.index);
      keepInView(this.scroller, this.cards[this.index], { instant });
    },
    handle(action) {
      const count = this.items?.length ?? 0;
      switch (action) {
        case 'left': return move(this, -1, count);
        case 'right': return move(this, 1, count);
        case 'up': return move(this, -COLUMNS, count, true);
        case 'down': return move(this, COLUMNS, count, true);
        case 'a': return this.items?.[this.index]?.open();
      }
    },
    hints() {
      return [['A', t('tiles.hint.open')], ['B', t('news.hint.home')]];
    }
  };
}
