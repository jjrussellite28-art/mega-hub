// Three looks that only change how Mega Hub appears, kept on this device (localStorage, never sent anywhere):
//  - bootScene: the loading screen at the start (an animated scene, or the classic picture)
//  - bgStyle: the default background behind the pages (the classic blurred tint, or one of the neon backgrounds)
//  - avatarAnim: how the profile pictures move on the profile screen
// A value that is not on the list (or storage that is blocked) falls back to the default, so a broken entry can never leave the page
// without a loading screen or a background. The values are applied as attributes on the page, the styles do the rest (styles.css).

export const BOOT_SCENES = Object.freeze(['orbital', 'horizon', 'core', 'pulse', 'classic']);
export const BG_STYLES = Object.freeze(['classic', 'neon-purple', 'neon-blue', 'neon-red', 'neon-green']);
// The two start-choice cards: the original emoji tiles (default) or the picture cards.
export const MODE_CARDS = Object.freeze(['classic', 'art']);
export const AVATAR_ANIMS = Object.freeze(['float', 'bounce', 'pulse', 'wiggle', 'glow', 'off']);

const LISTS = { bootScene: BOOT_SCENES, bgStyle: BG_STYLES, avatarAnim: AVATAR_ANIMS, modeCards: MODE_CARDS };
const DEFAULTS = { bootScene: 'orbital', bgStyle: 'classic', avatarAnim: 'float', modeCards: 'classic' };
const KEYS = { bootScene: 'megahub.bootScene', bgStyle: 'megahub.bgStyle', avatarAnim: 'megahub.avatarAnim', modeCards: 'megahub.modeCards' };

// What was chosen in this session, for the case that storage cannot keep it.
const session = {};

/** The value of one look: the choice of this session, the stored one, or the default. */
export function getLook(name) {
  const list = LISTS[name];
  if (!list) return undefined;
  if (list.includes(session[name])) return session[name];
  try {
    const stored = localStorage.getItem(KEYS[name]);
    if (list.includes(stored)) return stored;
  } catch {
    // Storage blocked: the default counts.
  }
  return DEFAULTS[name];
}

/** Puts the looks on the page: attributes on the root (background, avatar animation) and on the loading screen. */
export function applyLooks() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.bgstyle = getLook('bgStyle');
  root.dataset.avatarAnim = getLook('avatarAnim');
  const boot = document.getElementById('boot');
  if (boot) boot.dataset.scene = getLook('bootScene');
}

/** Saves and applies one look. False for a name or value that is not on the lists. */
export function setLook(name, value) {
  if (!LISTS[name]?.includes(value)) return false;
  session[name] = value;
  try {
    localStorage.setItem(KEYS[name], value);
  } catch {
    // Storage blocked: the choice holds until the page is closed.
  }
  applyLooks();
  return true;
}

// At the start, before the first frame of the page: the loading screen shows the chosen scene from the beginning.
applyLooks();
