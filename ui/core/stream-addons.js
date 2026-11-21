// Starter for the Media tab's own add-on layer (original code, no code from Stremio, Debrify or any other app).
//
// An "add-on" is a small web service that answers a public, documented JSON protocol: /manifest.json describes it,
// /catalog/{type}/{id}.json lists titles, /meta/{type}/{id}.json gives details, /stream/{type}/{id}.json gives
// ways to play. This file speaks that protocol as a client and turns every answer into one common Mega Hub shape
// (a "media item"), so any add-on can show up as normal tiles, whatever it runs on.
//
// Pure logic: no DOM, no app state. Network access is passed in (`fetchFn`) so it can be tested without a network.

const TIMEOUT_MS = 10000;
const MAX_ITEMS = 200;
const MAX_STREAMS = 50;
const MAX_TEXT = 600;

/** Plain http(s) address or null. Anything else (javascript:, file:, data:, ...) is never shown or opened. */
export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

function text(value, max = MAX_TEXT) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * The add-on's base address from what a person pastes: the manifest link, the base link or a stremio:// install link.
 * Returns null when it is not a usable http(s) address.
 */
export function addonBase(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (/^stremio:\/\//i.test(s)) s = 'https://' + s.slice('stremio://'.length);
  const url = safeUrl(s);
  if (!url) return null;
  const u = new URL(url);
  u.search = '';
  u.hash = '';
  u.pathname = u.pathname.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
  return u.href.replace(/\/$/, '');
}

async function getJson(fetchFn, url, timeoutMs = TIMEOUT_MS) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetchFn(url, ctl ? { signal: ctl.signal } : undefined);
    if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : 'none'}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Reads and checks an add-on's manifest. Returns the clean add-on record the app keeps. */
export async function loadAddon(input, fetchFn = fetch) {
  const base = addonBase(input);
  if (!base) throw new Error('not-an-address');
  const m = await getJson(fetchFn, `${base}/manifest.json`);
  if (!m || typeof m !== 'object' || !text(m.id) || !text(m.name)) throw new Error('not-an-addon');
  const resources = (Array.isArray(m.resources) ? m.resources : [])
    .map((r) => (typeof r === 'string' ? r : text(r?.name)))
    .filter(Boolean);
  const catalogs = (Array.isArray(m.catalogs) ? m.catalogs : [])
    .filter((c) => c && text(c.type) && text(c.id))
    .map((c) => ({
      type: text(c.type, 40),
      id: text(c.id, 120),
      name: text(c.name, 120) || text(c.id, 120),
      // A catalog that needs a search word or other required extras cannot be browsed as a plain list.
      browsable: !(Array.isArray(c.extra) && c.extra.some((e) => e && e.isRequired))
    }));
  return {
    base,
    id: text(m.id, 200),
    name: text(m.name, 120),
    version: text(m.version, 40),
    description: text(m.description),
    logo: safeUrl(m.logo),
    resources,
    catalogs,
    // Add-ons can ask for setup on their own web page; Mega Hub only offers to open that page.
    configurable: !!(m.behaviorHints && m.behaviorHints.configurable)
  };
}

/** One catalog entry or detail record in Mega Hub's common shape. */
export function toMediaItem(meta, addon) {
  if (!meta || typeof meta !== 'object' || !text(meta.id) || !text(meta.name)) return null;
  const year = text(meta.releaseInfo || meta.year, 20);
  return {
    id: text(meta.id, 200),
    type: text(meta.type, 40) || 'movie',
    name: text(meta.name, 200),
    poster: safeUrl(meta.poster),
    background: safeUrl(meta.background),
    year,
    description: text(meta.description),
    genres: Array.isArray(meta.genres) ? meta.genres.map((g) => text(g, 40)).filter(Boolean).slice(0, 10) : [],
    source: addon ? { id: addon.id, name: addon.name } : null
  };
}

/** Lists what a catalog holds, as media items. */
export async function loadCatalog(addon, catalog, fetchFn = fetch, extra = '') {
  const tail = extra ? `/${encodeURIComponent(extra).replace(/%3D/gi, '=').replace(/%26/gi, '&')}` : '';
  const url = `${addon.base}/catalog/${encodeURIComponent(catalog.type)}/${encodeURIComponent(catalog.id)}${tail}.json`;
  const data = await getJson(fetchFn, url);
  const metas = Array.isArray(data?.metas) ? data.metas : [];
  return metas.slice(0, MAX_ITEMS).map((m) => toMediaItem(m, addon)).filter(Boolean);
}

/** Details for one title (the add-on may not offer them; then null). */
export async function loadMeta(addon, type, id, fetchFn = fetch) {
  if (!addon.resources.includes('meta')) return null;
  const data = await getJson(fetchFn, `${addon.base}/meta/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`);
  return toMediaItem(data?.meta, addon);
}

/**
 * Ways to play a title. Only a plain web address can play in Mega Hub's own player today; entries that need a
 * torrent client or a debrid service are kept but marked `playable: false` so the screen can say why.
 */
export function toStream(s) {
  if (!s || typeof s !== 'object') return null;
  const url = safeUrl(s.url);
  const title = text(s.title || s.description || s.name, 200) || (url ? 'Stream' : 'Source');
  return {
    title,
    url,
    playable: !!url,
    needs: url ? null : s.infoHash ? 'torrent' : s.externalUrl ? 'external' : 'unknown',
    externalUrl: safeUrl(s.externalUrl),
    subtitles: (Array.isArray(s.subtitles) ? s.subtitles : [])
      .map((x) => ({ lang: text(x?.lang, 20), url: safeUrl(x?.url) }))
      .filter((x) => x.url)
  };
}

export async function loadStreams(addon, type, id, fetchFn = fetch) {
  if (!addon.resources.includes('stream')) return [];
  const data = await getJson(fetchFn, `${addon.base}/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`);
  const streams = Array.isArray(data?.streams) ? data.streams : [];
  return streams.slice(0, MAX_STREAMS).map(toStream).filter(Boolean);
}

/** Streams from every installed add-on that offers them; one add-on failing never hides the others. */
export async function loadAllStreams(addons, type, id, fetchFn = fetch) {
  const results = await Promise.allSettled(addons.map((a) => loadStreams(a, type, id, fetchFn)));
  const out = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') r.value.forEach((s) => out.push({ ...s, from: addons[i].name }));
  });
  // Playable ones first.
  return out.sort((a, b) => Number(b.playable) - Number(a.playable));
}

// ---------------------------------------------------------------------------
// The list of installed add-ons (kept by the app; this part only edits the list)

/** Adds an add-on to the list (replacing an older copy of the same one). */
export function withAddon(list, addon) {
  return [...list.filter((a) => a.id !== addon.id && a.base !== addon.base), addon];
}

export function withoutAddon(list, id) {
  return list.filter((a) => a.id !== id);
}
