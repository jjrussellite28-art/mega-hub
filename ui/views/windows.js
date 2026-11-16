// Windows tab: shortcuts to Windows tools. The host opens only the ids of its own list (Hud.WindowsTools).

import { api } from '../core/api.js';
import { attempt } from '../core/feedback.js';
import { t } from '../core/i18n.js';
import { tilePage } from './tile-page.js';

export const WINDOWS_TOOLS = [
  { id: 'explorer', icon: '📁', name: () => t('windows.tool.explorer') },
  { id: 'settings', icon: '⚙️', name: () => t('windows.tool.settings') },
  { id: 'taskmgr', icon: '📊', name: () => t('windows.tool.taskmgr') },
  { id: 'control', icon: '🎛️', name: () => t('windows.tool.control') },
  { id: 'network', icon: '🌐', name: () => t('windows.tool.network') },
  { id: 'bluetooth', icon: '🎧', name: () => t('windows.tool.bluetooth') },
  { id: 'sound', icon: '🔊', name: () => t('windows.tool.sound') },
  { id: 'display', icon: '🖥️', name: () => t('windows.tool.display') },
  { id: 'apps', icon: '📦', name: () => t('windows.tool.apps') },
  { id: 'update', icon: '🔄', name: () => t('windows.tool.update') }
];

export const windowsView = tilePage({
  id: 'windows',
  name: () => t('windows.name'),
  tiles: () => WINDOWS_TOOLS.map((w) => ({
    id: w.id,
    icon: w.icon,
    name: w.name(),
    note: '',
    open: () => attempt(() => api.openWindowsTool(w.id), t('windows.openFailed'))
  }))
});
