<context>
Price tracker is a one-file Node tool (`track.mjs`) on the Spicrawl scraping API. It reads `products.json`, checks each product page, compares with the last run and prints a table plus ALERT lines, optionally posting them to a Discord or Slack webhook.
This film plays on the GitHub README (as a silent looping GIF) and on X / LinkedIn (MP4 with narration). It must read with the sound off: every beat has its caption.
Read `videos/BRAND.md` first. It holds the brief, the look, the claims and the workspace. This prompt only adds the story.
</context>

<inputs>
Decided: 1920x1080, 30 fps, dark, 19.1 s. No music. Narration: Kokoro `af_heart`, four clips in `public/audio/` (measured 2.150, 2.725, 2.350, 3.200 s), each starting 0.25 s into its scene. Mix loudness -16 LUFS.
</inputs>

<direction>
Calm and exact, like the tool: a terminal, a few lines, one number that moves.
Ingredients: Spicrawl mark on the end card only · captions, one per beat, blur swap · clean cuts · typed command with a frame-driven caret.
Only the product's own surfaces, colors, borders and effects.
Banned: anything in BRAND.md "Claims" under never, a Discord or Slack look, glows, gradients, any hue but white on ground, invented numbers on screen that are not marked "example".
</direction>

<cast>
- The brand element: the Spicrawl mark, end card only.
- Cursors: none (a typed command is enough).
- Demo world: books.toscrape.com (A Light in the Attic, target 45, Tipping the Velvet) and the Allbirds Tree Runner on allbirds.com, exactly as `products.json` and the captured runs have them.
</cast>

<structure>
Beat sheet (seconds; the source of truth is `src/price-tracker/cues.ts`).

| Time | Caption | On screen | Narration |
|---|---|---|---|
| 0.00 to 6.60 | "Track prices on any shop." | 0.00 to 2.60 `products.json` fills in line by line (two books.toscrape.com products, `"target": 45` brightest). 2.60 cut to the terminal. 2.80 to 4.00 types `node track.mjs`. 4.25 Enter. 4.60 the real table and the credits line print at once. Idle caret to the cut. | n1 at 0.25 s |
| 6.60 to 10.80 | "No selectors needed for most stores." | `products.json` with name and url only (Allbirds Tree Runner) above a terminal pane. 7.50 to 8.70 types `node track.mjs`. 9.30 the real autoparse row: `$100.00  new  ?`. | n2 at 6.85 s |
| 10.80 to 15.40 | "Get an alert when the price drops." | 10.80 to 14.25 terminal tagged "example". 11.15 types `node track.mjs`. 12.45 the next run: first book £44.99, CHANGE `-6.78 (-13.1%)`, two ALERT lines. 14.25 cut to the alert card (name, `£51.77 -> £44.99`, target line), tagged "example". | n3 at 11.05 s |
| 15.40 to 19.10 | "Free and open source. Built on Spicrawl." | Spicrawl mark blurs in (15.40), "Price tracker" (15.70), `github.com/OfficialSpicrawl/price-tracker` (16.05), `price-tracker.spicrawl.com` (16.30). Hold. | n4 at 15.65 s |

Something moves on every beat: lines appear, characters type, the caret blinks, the table prints. The longest still hold is the real table (4.60 to 6.60), the time it takes to read it.
</structure>

<build>
1. Remotion in `videos/`, set up as BRAND.md "Workspace" says. Everything in `src/price-tracker/`, the time kit in `src/kit/`.
2. Every style is a pure function of the frame (`useTime()`): typing, caret blink, line reveals and blur swaps included.
3. `cues.ts` is the beat sheet as data; scene code holds no frame number.
4. `data.ts` ports `track.mjs` `printTable` and `changeText`, so the columns and the CHANGE text are the tool's own.
5. Final: `bun scripts/render.ts v1`, then `uv run -q --with numpy python3 scripts/verify.py out/price-tracker/v1`.
</build>

<gotchas>
Keep every word's slot (output lines are reserved and hidden, so nothing re-centres). Judge the encoded file and decode its pixels: render the PNG sequence straight to BT.709, never via an intermediate H.264 (it came out 2 to 3 levels dark). The "example" tag stays on every illustrative frame. Never state a number that was not captured, except the example run, which is labelled.
</gotchas>
