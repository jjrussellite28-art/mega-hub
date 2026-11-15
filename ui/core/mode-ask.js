// "Ask at start": when on, Mega Hub opens with a Shell mode or PC mode choice. Kept per browser profile of the app. Without a choice of
// its own it is on while Mega Hub is the Windows shell (that is where the choice matters) and off otherwise.
const KEY = 'megahub.askMode';

export function askModeAtStart(isShell = false) {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch {
    // Storage blocked: the default counts.
  }
  return !!isShell;
}

export function setAskModeAtStart(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked: the choice is not kept */ }
}
