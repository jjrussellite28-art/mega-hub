// Original profile pictures, drawn here (nothing downloaded, nobody's artwork): round faces that differ in skin, hair, eyes, mouth and a
// small extra. Plus the check for a custom picture the host made (a small JPEG as a data URL), so only that exact shape is ever shown.

const SKIN = ['#f6d3b3', '#e9b48a', '#c98a5e', '#8d5a3b', '#f2c7a0', '#ffd9c2'];
const HAIR = ['#2b2118', '#6b3f1d', '#d9a441', '#c8442b', '#3a3a52', '#8a8fa3'];
const SHIRT = ['#3fa9f5', '#30a46c', '#e5484d', '#8e4ec6', '#ff8800', '#12a594'];

const HAIR_STYLE = [
  (c) => `<path d="M22 46 Q22 14 50 14 Q78 14 78 46 Q66 30 50 30 Q34 30 22 46Z" fill="${c}"/>`,
  (c) => `<path d="M20 52 Q18 12 50 12 Q82 12 80 52 L74 40 Q50 24 26 40Z" fill="${c}"/><circle cx="50" cy="10" r="7" fill="${c}"/>`,
  (c) => `<path d="M24 44 Q30 16 50 16 Q70 16 76 44 Q62 34 50 36 Q38 34 24 44Z" fill="${c}"/><rect x="20" y="40" width="9" height="30" rx="4" fill="${c}"/><rect x="71" y="40" width="9" height="30" rx="4" fill="${c}"/>`,
  (c) => `<path d="M26 40 Q50 6 74 40 Q50 28 26 40Z" fill="${c}"/>`
];
const EYES = [
  '<circle cx="40" cy="52" r="3.6" fill="#222"/><circle cx="60" cy="52" r="3.6" fill="#222"/>',
  '<path d="M35 53 Q40 47 45 53M55 53 Q60 47 65 53" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/>',
  '<ellipse cx="40" cy="52" rx="4" ry="5" fill="#fff"/><ellipse cx="60" cy="52" rx="4" ry="5" fill="#fff"/><circle cx="41" cy="53" r="2.4" fill="#222"/><circle cx="61" cy="53" r="2.4" fill="#222"/>'
];
const MOUTH = [
  '<path d="M40 66 Q50 76 60 66" stroke="#7a2e2e" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
  '<ellipse cx="50" cy="69" rx="6" ry="4.5" fill="#7a2e2e"/>',
  '<path d="M42 68 H58" stroke="#7a2e2e" stroke-width="3.2" stroke-linecap="round"/>'
];
const EXTRA = [
  '',
  '<circle cx="40" cy="52" r="8.5" fill="none" stroke="#333" stroke-width="2.2"/><circle cx="60" cy="52" r="8.5" fill="none" stroke="#333" stroke-width="2.2"/><path d="M48.5 52 H51.5" stroke="#333" stroke-width="2.2"/>',
  '<circle cx="34" cy="62" r="4" fill="#ff7a8a" opacity=".45"/><circle cx="66" cy="62" r="4" fill="#ff7a8a" opacity=".45"/>',
  '<path d="M33 72 Q50 90 67 72 Q50 80 33 72Z" fill="#2b2118" opacity=".8"/>'
];

/** The ids of the drawn pictures, art1 … art12. */
export const ART_IDS = Object.freeze(Array.from({ length: 12 }, (_, i) => `art${i + 1}`));

const isArt = (id) => typeof id === 'string' && /^art([1-9]|1[0-2])$/.test(id);

/** The picture as a data URL for a CSS background or an img (only for a known id; null otherwise). */
export function artUrl(id) {
  if (!isArt(id)) return null;
  const n = Number(id.slice(3)) - 1;
  const skin = SKIN[n % SKIN.length];
  const hair = HAIR[(n * 5 + 1) % HAIR.length];
  const shirt = SHIRT[(n * 7 + 2) % SHIRT.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
    + `<path d="M12 100 Q14 78 50 78 Q86 78 88 100Z" fill="${shirt}"/>`
    + `<rect x="43" y="68" width="14" height="14" rx="5" fill="${skin}"/>`
    + `<circle cx="50" cy="50" r="28" fill="${skin}"/>`
    + HAIR_STYLE[n % HAIR_STYLE.length](hair)
    + EYES[(n * 2 + 1) % EYES.length] + EXTRA[(n * 3) % EXTRA.length] + MOUTH[(n + 2) % MOUTH.length]
    + '</svg>';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** A custom picture is exactly what the host makes: a JPEG data URL of base64 only, small enough to keep in the settings. */
export const isCustomAvatar = (value) => typeof value === 'string' && value.length < 70000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);

/** What to put in a CSS background for this avatar value, or null for an emoji/preset id. */
export function pictureOf(value) {
  if (isCustomAvatar(value)) return value;
  return artUrl(value);
}

export const randomArt = () => ART_IDS[Math.floor(Math.random() * ART_IDS.length)];
