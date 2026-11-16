// Safe mode: the way out when a code cannot be entered (a broken controller or keyboard, a forgotten code). No code is asked for the two
// things it offers: PC mode (Mega Hub closes, the normal Windows desktop is there, no restart) and Uninstall (asks the Windows sign-in).

import { api } from '../core/api.js';
import { attempt } from '../core/feedback.js';
import { t } from '../core/i18n.js';
import { chooseDialog, confirmDialog } from './overlay.js';

/** After this many wrong codes in a row at the start, safe mode is offered (the tries themselves never run out). */
export const WRONG_LIMIT = 5;

export async function safeMode() {
  const pick = await chooseDialog(t('profiles.safeTitle'), [
    { label: t('profiles.safePc'), detail: t('profiles.safePcDetail'), value: 'pc' },
    { label: t('profiles.safeUninstall'), detail: t('profiles.safeUninstallDetail'), value: 'uninstall', danger: true }
  ], 'pc');
  if (pick === 'pc') {
    await attempt(() => api.leaveToPc());
    return true;
  }
  if (pick !== 'uninstall') return false;
  const { ensureWindowsSignInOnly } = await import('./passcode.js');
  if (!(await ensureWindowsSignInOnly(t('settings.power.uninstall')))) return false;
  if (!(await confirmDialog(t('settings.power.uninstallTitle'), t('settings.power.uninstall'), { danger: true, message: t('settings.power.uninstallMessage'), focusCancel: true }))) return false;
  if (!(await confirmDialog(t('settings.power.sure'), t('settings.power.sureYes'), { danger: true, message: t('settings.power.sureMessage'), focusCancel: true }))) return false;
  await attempt(() => api.uninstallMegaHub(), t('settings.power.uninstall'));
  return true;
}

/** Several wrong codes: asks whether to open safe mode. True when it was opened (the code entry ends then). */
export async function offerSafeMode() {
  if (!(await confirmDialog(t('safe.offer'), t('safe.offerYes'), { cancelLabel: t('safe.offerNo') }))) return false;
  return safeMode();
}
