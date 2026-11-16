// Store tab: the game stores. An installed store opens its app; one that is not installed opens its website in Mega Hub's browser.

import { api } from '../core/api.js';
import { attempt } from '../core/feedback.js';
import { openLink } from '../core/links.js';
import { t } from '../core/i18n.js';
import { tilePage } from './tile-page.js';

/** id = the game client's id in the host (Launchers.Find). */
export const STORES = [
  { id: 'steam', name: 'Steam', icon: '🎮', url: 'https://store.steampowered.com/' },
  { id: 'epic', name: 'Epic Games', icon: '⬛', url: 'https://store.epicgames.com/' },
  { id: 'gog', name: 'GOG', icon: '🟣', url: 'https://www.gog.com/' },
  { id: 'ea', name: 'EA app', icon: '🔶', url: 'https://www.ea.com/games' },
  { id: 'ubisoft', name: 'Ubisoft Connect', icon: '🔷', url: 'https://store.ubisoft.com/' },
  { id: 'battlenet', name: 'Battle.net', icon: '🔹', url: 'https://shop.battle.net/' },
  { id: 'xbox', name: 'Xbox / Microsoft Store', icon: '🟩', url: 'https://www.xbox.com/games/store' }
];

let installed = new Set();

/** What a tile does: the store's app when it is installed, its website otherwise. */
export function storeAction(store, have) {
  return have.has(store.id) ? 'app' : 'web';
}

async function load() {
  const list = await api.getLaunchers().catch(() => null);
  if (Array.isArray(list)) installed = new Set(list.map((l) => l.id));
}

export const storeView = tilePage({
  id: 'store',
  name: () => t('store.name'),
  load,
  tiles: () => STORES.map((s) => {
    const app = storeAction(s, installed) === 'app';
    return {
      id: s.id,
      icon: s.icon,
      name: s.name,
      note: app ? t('store.openApp') : t('store.openWeb'),
      open: () => (app ? attempt(() => api.openLauncher(s.id), t('store.openFailed')) : openLink(s.url, 'store'))
    };
  })
});
