// Windows tab: one big Desktop tile. It opens the real Windows desktop (PC mode, no restart) with the controller as a mouse.

import { api } from '../core/api.js';
import { attempt } from '../core/feedback.js';
import { t } from '../core/i18n.js';
import { tilePage } from './tile-page.js';

export const windowsView = tilePage({
  id: 'windows',
  name: () => t('windows.name'),
  tiles: () => [{
    id: 'desktop',
    image: 'assets/desktop-tile.svg',
    name: t('windows.desktop'),
    note: t('windows.desktopNote'),
    open: () => attempt(() => api.openDesktop(), t('windows.openFailed'))
  }]
});
