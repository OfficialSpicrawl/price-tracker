# Design notes: price-tracker.spicrawl.com

Why the page looks the way it does, so later edits stay consistent. The code is `src/page.mjs`.

## Brief

- **Subject:** an open-source price and stock tracker. It reads JSON-LD / OpenGraph from a product page and alerts on a drop, a target price or a restock (Discord or Slack), from a terminal, GitHub Actions or an agent skill.
- **Audience:** developers and people who run coding agents (Claude Code, Codex, Cursor).
- **Job:** get one command copied and one free API key claimed. Proof by letting the visitor run a real check.
- **Direction from the owner:** clean (few elements per screen, lots of whitespace, one accent, aligned to one grid, no boxes inside boxes, no competing buttons, no decoration without a job), close to firecrawl.dev (a centered, confident hero with one command as the star, crisp mono details, ASCII texture and illustration), 120 words or fewer of visible copy, Geist and Geist Mono.
- **Stack kept:** a Cloudflare Worker serving one HTML string, inline CSS and one nonce'd inline script. No framework, no build step at deploy. The strict CSP (`default-src 'none'`, `img-src data:`, `connect-src 'self'`) is unchanged.
- **Brand (Spicrawl landing theme, see `../videos/BRAND.md`):** dark grey ground, white as the only accent, no other hue, no gradient, no glow, 10 px corners. A price drop is shown by the numbers and the bars falling, never by a green.

## Concept card

| | |
|---|---|
| Idea | The price, in a terminal. The product reads a number off a page and prints it, so the page is one command, one price line and the output the command prints. |
| Anchor | `node track.mjs` prints a table and `ALERT` lines. That output is the product, so the hero shows it, typed out, next to the price line it is watching. |
| Metaphor | A terminal session and a ticker: monospace, fixed cells, steps instead of glides. |
| Signature | The example: an ASCII price line (a sparkline) above a terminal that types `node track.mjs` twice. The first run is the baseline at 59.00. At the second run the row prints 44.99, the bars step down 59.00, 56.00, 52.30, 48.10, 44.99, and two `ALERT` lines print. One clock drives both. |
| Emotion | Calm and exact, with a small "it is watching" tell (the bot). |
| Motion verb | Tick. Fixed cells, discrete steps, no bounce. |
| Screenshot | The hero: H1, the command, the button, and the price line over the terminal with its alert. |

## Pieces from ascii.rest (MIT)

Two of its 217 pieces, vendored (see `vendor/`): `sparkline` and `terminal`. Both are copies with small, marked changes: the terminal plays price-tracker's own session (real table and `ALERT` format, example prices) and reports its playhead through a `sync` option, so the sparkline reads the price at that moment; the sparkline has an `ago` option for its axis label and one more row of air. `mount()` from the same package plays them, pauses them off screen and in a hidden tab, and shows one still frame under reduced motion. Both frames ship as text in the HTML, so a crawler, a no-script visitor and a reduced-motion visitor see the finished alert. Credit: footer link, the notice at the top of the vendored script, and `vendor/ascii.rest.LICENSE`. Not used: split-flap, scramble, candlesticks (the two above already carry the price ticking down; a third effect would only compete).

## Agent-native layer

- The Agent tab is the default in the command block: `npx skills add OfficialSpicrawl/price-tracker`. The CLI tab has the clone-and-run lines.
- A watcher bot beside the live-check input shows the real state of the check: idle (blinks, glances), working while `/api/price` is in flight (eyes scan, antenna blinks, a stepping orbit appears), asleep when the demo is out of credits. Nothing animates off screen.
- `GET /llms.txt` describes the tool for agents (install, files, flags, cost, limits). `SKILL.md` is linked in the footer. JSON-LD describes the software.
- Libraries.dev bot-avatars, thinking-orbs and border-beam are React components. This page is a no-build Worker with a strict CSP, so the bot and orbit are native SVG and CSS built to the same decision rules (orb only for a wait over 2 s, state from the real status), and the beam was dropped as decoration. Measured before deciding: React plus the three packages bundle to 380 KB (126 KB gzip), 256 KB (87 KB gzip) with a Preact alias, and need a build step and `script-src 'self'`. The HTML is 14 KB. Not worth it for two small cues, and bot-avatars' coloured bodies break the no-hue brand rule.

## Palette

| Role | Hex | Use |
|---|---|---|
| ground | `#16181B` | page |
| card | `#1E2124` | the command block, inputs |
| line | `#2E3135` | 1 px hairlines |
| ctl | `#6B7076` | borders of controls (3.4:1 on ground) |
| ink | `#F9F9F9` | what to read, the filled button |
| muted | `#A9ADB2` | support text (7.6:1 on ground) |
| dim | `#8A8E94` | the prompt glyph only |

## Type

- Geist (400, 500, 600) for the headline and UI, Geist Mono (400, 500, 600) for the command, labels, prices and the ASCII pieces, both OFL (vercel/geist-font) from Google Fonts, which the CSP allows. Geist Mono carries the box-drawing and block glyphs the pieces use, so frames align. Righteous only for the wordmark (a second request that asks for its eight letters).
- Headline 600, `clamp(40px, 7vw, 72px)`, 1.05 leading, -0.03em tracking. Body 16 px at 1.5. Small mono 13 px. The ASCII pieces size from their box (`cqw`), 18 px at most, so 60 columns fill the 640 px column and still fit at 360 px.

## Grid and rhythm

- One centered column of 640 px: the command block, the ASCII pieces and the live check share its edges. The top bar and the footer use the 1120 px container.
- Space between blocks is 88 to 112 px on desktop (72 to 56 on a phone), uneven on purpose: the hero and its example read as one unit, the live check stands apart, the close is last.
- One radius: 10 px. One border: 1 px.

## Composition

```
bar        Spicrawl . Price tracker ............................ [GH Star on GitHub]
hero       H1 (5 words)
           sub (7 words)
           [ Agent | CLI ]  $ npx skills add ...  [Copy]
           [ Try Spicrawl free > ]   1,000 credits a month
example    price  ▇▇▇▇▇▇▇▅▃▂▂ £44.99      (sparkline, one clock)
           ╭─ price-tracker ───────╮      (terminal: node track.mjs, ALERT lines)
live       [bot] Watching
           [ https://shop.example/product ] [Check price]
           [books.toscrape.com] [allbirds.com]                Selector
close      [ Try Spicrawl free > ] [GH Star on GitHub]
footer     Docs  SDK  SKILL.md  llms.txt  Apache-2.0  ASCII by ascii.rest
```

## Interaction

- One treatment for primary targets: the label ticks up and a copy rolls in, the arrow nudges 4 px, and a filled button inverts to an outline (chips invert to filled). Under reduced motion the roll is dropped and an underline marks hover and focus; the inversion stays.
- Utility links (footer, brand) change colour or underline only.
- Focus: 2 px ink outline, 2 px offset, on every target.
- Reduced motion: both pieces stay on their shipped frame, the bot holds a pose, nothing loops.
- Idle motion: the terminal's cursor and the typing loop, the bars, the bot's blink and glance. Off screen, everything pauses.

## Genericness test

A generic model would land on: a hero with a gradient blob, three feature cards, a purple Discord frame, a green "price down" arrow, a screenshot mock-up. Changed: the product's own output is the illustration, in ASCII, driven by one clock; a drop is shown by falling bars and an `ALERT` line, in white on grey; the demo is a single input wired to the real `/api/price` with a bot that mirrors its state.

## Content rules

- 120 words or fewer of visible copy; labels are one to three words; caveats live in tooltips and error states (the selector's tooltip, the blocked and out-of-credit messages).
- No invented stores, stats or testimonials. The ASCII example uses a made-up "Mug" at example prices, labelled "Example data".
- No internal engine names anywhere on the page, in `/llms.txt`, or in the `/api/price` response.
- No star count while the repo has no stars. The count is read server side (GitHub API, edge cached for 10 minutes) and printed into the HTML, so nothing shifts and the browser never calls GitHub.
- Share image: `/og.png` redirects to `../launch/social-preview.png` in this repo.
