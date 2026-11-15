import { $ } from './dom.js';
import { t } from './i18n.js';

// The shared busy state of buttons, rows and footer hints (a running action ignores a second press instead of a toast).
export { isBusy, markBusy, runBusy } from './busy.js';

let toastTimer;

/** How long the "Locked / Unlock now" note stays on screen. */
export const UNLOCK_NOTE_MS = 5000;

/** The code screen for a locked couch; after the unlock the page is built again, after a cancel the short note with the button follows. */
export async function askToUnlock(reason = '') {
  const { ensureUnlocked } = await import('../components/passcode.js');
  if (await ensureUnlocked(reason)) {
    const { render } = await import('./nav.js');
    render();
    return true;
  }
  toast(t('unlockChip.locked'), UNLOCK_NOTE_MS, { action: { label: t('feedback.unlockNow'), run: () => askToUnlock(reason) } });
  return false;
}

/** `long`: a text of several lines; it sits low on the screen so it never covers the title of the page behind it. */
export function toast(text, ms = 2500, { long = false, action = null } = {}) {
  const t = $('#toast');
  t.textContent = text;
  // A button on the right of the text (mouse or touch), e.g. "Unlock now" on a locked-message.
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      t.hidden = true;
      clearTimeout(toastTimer);
      action.run();
    });
    t.append(button);
  }
  t.classList.toggle('has-action', !!action);
  t.classList.toggle('long', long);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

/**
 * Runs a UI action and turns failures into a toast instead of a silent unhandled rejection.
 * `quietLocked`: for reads the page makes on its own (not because the user asked): a locked couch is no error then, the
 * result is undefined and the page shows "locked" or nothing.
 * `onCodesDamaged`: who offers the reset when the service's code store is damaged (the settings' own code changes pass it); it gets the
 * message and answers whether it offered the reset. Without one, or when it did not, the message is a toast.
 */
export async function attempt(action, label, { quietLocked = false, lockedValue = undefined, onCodesDamaged = null } = {}) {
  try {
    return await action();
  } catch (err) {
    if (quietLocked && err?.locked) return lockedValue;
    // A protected profile waits at the picker: the host answers only the picker; everything else is reloaded once it is chosen.
    if (err?.held) return undefined;
    // The service's code file is damaged: the message says so, with the reset where the caller offers it.
    if (err?.codesDamaged) {
      if (!(onCodesDamaged && (await onCodesDamaged(err.message)))) toast(err.message, 8000, { long: true });
      return undefined;
    }
    console.error(err);
    // A locked couch: the code screen opens right away (controller, keyboard or mouse); after the unlock the page is built again.
    // A cancel leaves everything as it was and shows a short "Locked" note (5 seconds) with an "Unlock now" button: pressing it
    // closes the note and opens the code screen again.
    if (err?.locked) {
      await askToUnlock(label ?? '');
      return undefined;
    }
    toast(`${label ?? t('feedback.failed')}: ${err?.message || err}`, 5000);
    return undefined;
  }
}
