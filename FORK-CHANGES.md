# Fork changes

## 2026-11-04 — release preparation (unreleased)

- Identify Mega Hub as an independent GPL-3.0-only fork of CouchHUD and retain upstream credits.
- Use the fork's repository for app update discovery, project links, installer publisher and release tooling defaults.
- Change visible UI text and product metadata to Mega Hub; retain internal compatibility identifiers.
- Include LICENSE, credits, source instructions and third-party notices in published app output.
- Prepare a source archive from the exact build commit and attach it to draft release preparation.
- Disable tag-driven public release publication: release output remains a draft.

The GPL license and inherited authors' notices are retained. This list describes preparation changes,
not a released feature upgrade. See docs/RELEASE-CHECKLIST.md for unfinished work.

## 2026-11-04 — Mega Hub name and supplied artwork (unreleased)

- Rename the visible product from Ultimate Setup to Mega Hub; the repository URL and internal compatibility identifiers remain unchanged.
- Add the user-supplied Bing Image Creator logo unchanged, credit its generation source, and use it in the README, startup screen, setup welcome and Windows application icon.
- Retain upstream credits and GPL v3 without claiming exclusive rights in the AI-generated artwork.

## 2026-11-15 — profile screen, loading screens, neon backgrounds, unlock (unreleased)

- Profile screen: "Who is playing?" with tall colored cards, a greeting by the time of day and moving profile pictures (Settings › Appearance › Profile animation: floating, bouncing, pulsing, wiggling, glowing or off; still with "Reduce animations").
- Loading screen: four original animated scenes (orbital rings, digital horizon, power core, pulse bars) plus the classic picture; Settings › Appearance › Loading screen, shown at the next start.
- Backgrounds: neon purple, blue, red and green next to the classic tint (Settings › Appearance › Background style). The classic stays the default; pages with a game's artwork keep the artwork.
- Unlock: the button disappears as soon as it is pressed and an open-lock icon shows once unlocked; a cancelled unlock shows a "Locked" note with an "Unlock now" button for 5 seconds.
- The way to set up automatic Windows sign-in (skipping the Windows PIN) is removed from Settings; turning an existing one off stays.
- Setup texts: "use at your own risk" and the data warning are replaced by friendlier wording (everything can be undone; a tip about the Windows sign-in and device encryption).
- These are interface changes only (ui/); no host, service or privileged code was changed.

## 2026-11-10 — own artwork and logo (unreleased)

- Replace the inherited CouchHUD artwork (installer wizard pictures, icons, logo, banner, social preview, phone-page icon) so the fork cannot be mistaken for an official CouchHUD release, as the CouchHUD author asked.
- Replace the earlier Bing logo with one ChatGPT-made logo for every platform (no Windows, Android or Apple mark); originals and provenance in ui/assets/MEGA-HUB-LOGO.md.
- Use the wide Mega Hub picture as the startup-screen background.
- Own signing key and own catalog are still to do (docs/RELEASE-CHECKLIST.md).

