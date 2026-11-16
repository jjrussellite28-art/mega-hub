// Pure rule for the start screens (tested by scripts/ui-logic-check.mjs).

/** The screen after (d = 1) or before (d = -1) the current one; null with fewer than two screens. */
export function stepNumber(screens, d) {
  if (!Array.isArray(screens) || screens.length < 2) return null;
  const list = [...screens].sort((a, b) => a.number - b.number);
  const at = list.findIndex((s) => s.chosen);
  const from = at >= 0 ? at : Math.max(0, list.findIndex((s) => s.primary));
  return list[(from + d + list.length) % list.length].number;
}
