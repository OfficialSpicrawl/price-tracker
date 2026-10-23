# Spicrawl price tracker video kit

The look, rules, assets and code for the price-tracker film. The film prompt (`price-tracker-prompt.md`) only adds the story.
Sources: Spicrawl's landing theme (`webora-ui/landing/src/styles/globals.css`, `.spicrawl-theme`), `HeroTerminal.tsx` / `CodePanel.tsx` (terminal chrome), the shared brief `OfficialSpicrawl/FILM-BRIEF.md`, and the tool itself (`../track.mjs`, `../products.json`, `../README.md`). When this file and the repo disagree, the repo wins.

## The brief (from the interview, already done)
- Plays: GitHub README (GIF) and X / LinkedIn (MP4 with sound). Format 16:9, 1920x1080, 30 fps. Length 15 to 20 s (this film: 19.1 s).
- Music: none. Narration: Kokoro TTS, voice `af_heart`, reading the captions. About -16 LUFS.
- Must show: `products.json`, `node track.mjs`, the real table, an autoparse run on a Shopify store, a price-drop alert (labelled example).
- Ingredients: brand element = Spicrawl mark on the end card only · words = short captions, one per beat · transitions = clean cuts · extras = frame-driven typing caret, "example" tag, no cursor, no music, no mascot.
- Ending: mark, "Price tracker", `github.com/OfficialSpicrawl/price-tracker`, `price-tracker.spicrawl.com`.

## Hard rules
- Ground is dark grey, never black. White is the only accent. No other hues, no gradients, no glows, no particles, no bouncy easing (landing theme).
- Code and terminal text read as steps of luminance, not hue: keyword brightest, then string, number, flag, comment (landing theme `--code-*`).
- Type: Inter for captions and UI words, JetBrains Mono for the terminal, code and URLs, Righteous only for the "Spicrawl" wordmark (not used in this film: the mark carries the end card).
- Corners: 10 px (brief). Terminal chrome matches `TerminalFrame`: card ground, 1 px border, a header strip with a mono title (background at 40% over the card).
- Copy: sentence case, plain words, one short line per caption (brief).
- Claims: see "Claims".

## Frame (1920x1080, 30 fps, dark)
- Framing: full bleed ground. Caption band at the top (centre y = 118), content zone y 215 to 1035, content kept 100 px from the edges.
- Words: Inter 600, 62 px, near-white, one line per beat. A caption holds for its whole scene and swaps with a blur (in over 0.4 s, out over 0.18 s). Its narration clip starts 0.25 s into the scene, so the caption is on screen the whole time the clip plays.
- Scenes: the tool's own text only (plus the "example" tag and the alert card).

## Color
| Token | Value | Use |
|---|---|---|
| ground | `#16181B` | background |
| card | `#1E2124` | terminal and alert card body |
| elevated | `#26292D` | unused |
| border | `#2E3135` | 1 px window and card borders, section dividers, tag outline |
| header strip | `#1B1D20` | window header (ground at 40% over the card, as `TerminalFrame`) |
| foreground | `#F9F9F9` | main text |
| accent | `#FAFAFA` / `#FFFFFF` bold | the one thing to read: `target`, the CHANGE value, `ALERT`, the new price |
| muted foreground | `#A9ADB2` | titles, credits line, old price |
| code steps | `#FAFAFA` keyword, `#D3D6D9` string, `#AEB2B7` number, `#9A9EA3` flag, `#8A8E94` comment | JSON and terminal tones |

Hex only for anything that animates. The `oklch` values in the CSS comments convert to slightly darker hexes than the stated ones; the stated hexes (`#16181B`, `#1E2124`, `#2E3135`, `#A9ADB2`) are used, per the brief.

## Type
- Files (copied, not committed; see Workspace): `public/fonts/inter-latin-wght-normal.woff2`, `jetbrains-mono-latin-wght-normal.woff2`, `righteous-latin-400-normal.woff2`.
- Sizes at 1080p: caption 62 px; terminal 28 px mono on a 44 px line, scaled by 1.15 to 1.5 per scene (effective 32 to 42 px); end title 108 px; URLs 36 px mono; alert card 68 / 124 / 38 px.

## Signature elements
| Element | Look | Source | In films |
|---|---|---|---|
| Terminal window | card ground, 1 px border, header strip with mono title | `CodePanel.tsx` `TerminalFrame` | one window per scene, hard cuts between |
| Prompt and caret | `$ ` bold, block caret `0.6em` wide, solid while typing, blinks at 1.9 Hz when idle | `HeroTerminal.tsx` | frame-driven (`PromptLine`), 12 characters per second |
| "example" tag | mono 20 px, muted, 1 px border, 6 px radius, top right | this film | on every illustrative frame (scene 3) |
| Alert card | card ground, border, eyebrow + name + price change + target line | this film | plain, no Discord or Slack look |
| Spicrawl mark | `public/brand/mark-dark.svg` (white on dark) | landing brand assets | end card only, blur-in |

## Logo and brand element
- Logo: `Spicrawl logo dark.svg` from `webora-ui/landing/public/spicrawl assets/svg/` (copied to `public/brand/`). Reveal: blur swap. No mascot sway.
- Never: a recoloured mark, a glow, a gradient, a Discord or Slack clone.

## Components
| Need | Component | In films |
|---|---|---|
| Terminal chrome | `CodePanel.tsx` `TerminalFrame` | redrawn in `src/price-tracker/parts.tsx` (`Window`): the landing code uses Tailwind and a React clock |
| Terminal run and typing | `HeroTerminal.tsx` | redrawn, frame-driven (`PromptLine`): the original uses `setTimeout` |
| Table output | `track.mjs` `printTable` | ported 1:1 in `data.ts` (`table`), column widths computed the same way |

## Motion
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for blur swaps; nothing bounces. Typing is linear, 12 characters per second.
- Transitions: clean cuts on scene boundaries. The terminal output appears at once, as `track.mjs` prints it (one `console.log`).

## Claims
- The film may show: `node track.mjs` reading `products.json`, a price and stock table, the CHANGE and ALERT wording `track.mjs` prints, autoparse (no selectors) working on a Shopify page, alerts posted to a chat webhook, the free plan's credits line.
- Real (captured 2026-10-23): the scene 1 table and credits line (`Credits used: 2 (976 left this month)`), and the Allbirds Tree Runner row (`$100.00`, `new`, stock `?`).
- Illustrative, tagged "example" on screen: the second run (the first book at £44.99, CHANGE `-6.78 (-13.1%)`, the two ALERT lines, the alert card). The wording is `track.mjs`'s own: `changeText` for CHANGE, and a drop from £51.77 to £44.99 fires both the "price dropped" alert and the "at or below your target" alert (target 45). The URL tails are cut with an ellipsis so the lines fit.
- Trimmed from the real run: the ISO timestamp line `track.mjs` prints above the table is not shown (the README output omits it too).
- It never shows or claims: search, crawl, AI extraction, other plans' prices, "free" cached hits.
- Approved lines: "Track prices on any shop." "No selectors needed for most stores." "Get an alert when the price drops." "Free and open source. Built on Spicrawl."
- Words to avoid: anything promising an alert on every shop, or a price that was not captured.

## Workspace
- Folder `videos/`, its own package (not part of the shipped tool). Remotion `4.0.538`, every `@remotion/*` pinned to the same version, React 19.2.0.
- No Tailwind, so no webpack override.
- Setup after a fresh clone: `npm install`, copy the three font files and the three logo SVGs (paths above) into `public/fonts` and `public/brand` (fonts are git-ignored), then `npm run narration` (about 7 minutes the first time) to regenerate `public/audio/n1-n4.wav`.
- Scripts: `scripts/narration.sh` + `say.py` (Kokoro), `scripts/stills.ts` (bundle once, render many frames: `bun scripts/stills.ts out/review/x 60 165 --composition PriceTracker`), `scripts/render.ts` (PNG sequence, narration mix + loudnorm, MP4, GIF), `scripts/verify.py`.
- Outputs: `out/price-tracker/vN/` holds `price-tracker.mp4`, `price-tracker.gif`, `poster.png`, `narration.wav`, `stills/`. Keep every version.
