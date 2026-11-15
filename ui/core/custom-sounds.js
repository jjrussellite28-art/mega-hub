// The person's own sound files (Settings › Sound): the events they can be chosen for, and the plain { event: url } map the sound code plays.

/** The events, in the order of the picker; "music" is the background music. */
export const CUSTOM_SOUND_EVENTS = Object.freeze(['music', 'move', 'tab', 'select', 'back', 'bump', 'open']);
export const SOUND_FILES = Object.freeze(['.wav', '.ogg', '.mp3']);

/** From what the host sends ({ event: { name, url } }) to { event: url }; only known events and https URLs of the local-file host. */
export function soundUrls(view) {
  const out = {};
  if (!view || typeof view !== 'object') return out;
  for (const event of CUSTOM_SOUND_EVENTS) {
    const url = view[event]?.url;
    if (typeof url === 'string' && url.startsWith('https://local.megahub/')) out[event] = url;
  }
  return out;
}
