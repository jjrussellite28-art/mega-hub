// Media tab: opens MegaWatch, a separate media app. Mega Hub brings no videos, add-ons or sources of its own. Not installed: its download
// page opens in Mega Hub's browser. Switching the tab off (Settings) hides it and closes MegaWatch.

import { api } from '../core/api.js';
import { attempt, toast } from '../core/feedback.js';
import { openLink } from '../core/links.js';
import { t } from '../core/i18n.js';
import { tilePage } from './tile-page.js';

/** MegaWatch's releases page (where its own installer is). */
export const MEGAWATCH_URL = 'https://github.com/jjrussellite28-art/MegaWatch/releases';

let installed = true;

/** What the MegaWatch tile does: open the app when it is installed, its download page otherwise. */
export const mediaAction = (have) => (have ? 'app' : 'web');

async function load() {
  const info = await api.getMediaInfo?.().catch(() => null);
  if (info) installed = !!info.installed;
}

export const mediaView = tilePage({
  id: 'media',
  name: () => t('media.name'),
  load,
  tiles: () => [
    {
      id: 'megawatch',
      icon: '🎬',
      name: 'MegaWatch',
      note: mediaAction(installed) === 'app' ? t('media.open') : t('media.install'),
      open: () => (mediaAction(installed) === 'app' ? attempt(() => api.openMegaWatch(), t('media.openFailed')) : openLink(MEGAWATCH_URL, 'media'))
    },
    {
      id: 'good-to-know',
      icon: 'ℹ️',
      name: t('media.info.name'),
      note: t('media.info.note'),
      open: () => toast(t('media.info.text'), 7000)
    }
  ]
});
