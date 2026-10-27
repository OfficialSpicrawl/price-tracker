# Live demo (Cloudflare Worker)

The site for the price tracker, served at <https://price-tracker.spicrawl.com>: a short landing page (a hero with the install command, an ASCII example of a price drop and its alert, and a live check) around a working demo. In the live check a visitor pastes a product URL (optionally a CSS selector for the price) and the Worker checks it with Spicrawl: the CLI's own request (`request` from `../track.mjs`, autoparse or selector extract, `cache: false`) in its capped form, `request(p, { cheap: true })`: `max_cost: 1`, which caps every check at 1 credit (Spicrawl picks the engine itself and ignores an `engine` field). The CLI keeps `mode: "auto"`, which may escalate to 3 or 8 credits a page; the public demo must not, so pages that need JavaScript or pass a bot challenge come back as "Blocked/unavailable". The answer is parsed with the CLI's own `findProduct` / `parsePrice`.

| File | What it is |
|---|---|
| `wrangler.jsonc` | Worker config: custom domain only (`workers_dev` and `preview_urls` off), rate limit, Analytics Engine dataset |
| `src/worker.mjs` | `GET /` serves the page, `POST /api/price` checks one URL, plus `/llms.txt`, `/robots.txt`, `/sitemap.xml` and `/og.png` |
| `src/page.mjs` | The page: one HTML string with inline CSS and a small inline script, no build. Design notes: [`DESIGN.md`](DESIGN.md) |
| `src/llms.mjs` | The text served at `/llms.txt`: the tool described for an AI agent. Keep it in step with the README and `SKILL.md` |
| `vendor/` | The two [ascii.rest](https://ascii.rest) pieces the page plays (`pieces/sparkline.js`, `pieces/terminal.js`: copies with marked changes), `entry.js`, the self-hosted `fonts/` (SIL OFL) and `build.mjs`, which bundles the pieces into `src/vendor/ascii.gen.mjs` and embeds the fonts and the share image into `src/vendor/assets.gen.mjs` (generated, committed). MIT: see `vendor/ascii.rest.LICENSE` |
| `test/worker.test.mjs` | `node:test` with a stubbed env and stubbed `fetch` (no network, no credits) |

## Run it locally

Needs Node.js 22 or later (wrangler 4) and a Spicrawl API key.

```sh
npm install
printf 'SPICRAWL_API_KEY=spicrawl_live_...\n' > demo/.dev.vars   # git-ignored
npm run demo:dev                                                  # http://localhost:8787
```

No Cloudflare login is needed for local dev. Bindings (rate limit, Analytics Engine) are simulated locally. Real scrapes use real credits.

```sh
curl -s localhost:8787/api/price -H 'content-type: application/json' \
  -d '{"url":"https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html","selector":".product_main .price_color"}'
```

## Deploy

You need a Cloudflare account with the `spicrawl.com` zone, Analytics Engine enabled (Workers & Pages, Analytics Engine, one-time), and a Spicrawl API key for the demo's own Spicrawl organization.

```sh
npx wrangler login
npx wrangler secret put SPICRAWL_API_KEY --config demo/wrangler.jsonc   # paste the key when asked
npm run demo:deploy
```

The route is a Workers custom domain (`price-tracker.spicrawl.com`); Cloudflare creates the DNS record on deploy. The key is stored as a Worker secret: it is not in the repo, never sent to the browser and never logged. To rotate it, run `secret put` again.

`npm run demo:deploy` runs `wrangler deploy --config demo/wrangler.jsonc`. Check the bundle without deploying: `npx wrangler deploy --dry-run --config demo/wrangler.jsonc`.

## The page

H1 and the command block (Agent and CLI tabs), one "Try Spicrawl free" button, then the example: an ASCII price line above a terminal that runs `node track.mjs` twice and prints the `ALERT` lines (both from [ascii.rest](https://ascii.rest), MIT), then the live check (a URL input, the bot that mirrors its state), then the button and "Star on GitHub" again. About 100 words of copy; Geist and Geist Mono, self-hosted. Design notes: [DESIGN.md](DESIGN.md).

- **ASCII pieces.** `vendor/build.mjs` bundles `mount()` and the two pieces into `src/vendor/ascii.gen.mjs`, which the page inlines in its one nonce'd script (the CSP allows no other script). Both pieces' first frames are also in the HTML as text, so a crawler, a visitor without script and a reduced-motion visitor see the finished alert. The same script embeds the fonts (`vendor/fonts/*.woff2`: Geist and Geist Mono subsets from Google Fonts, a Righteous subset of the eight wordmark letters, SIL OFL, licences next to them) and `launch/social-preview.png` into `src/vendor/assets.gen.mjs`, which the Worker serves at `/fonts/*` (immutable) and `/og.png`. After changing `vendor/entry.js`, a piece, a font or the share image, run `npm run demo:vendor` and commit the result. The two pieces are copies of ascii.rest 0.4.0 with changes listed at the top of each file; `ascii.rest` and `esbuild` are dev dependencies used only for this step. Deploy is unchanged: there is no build step.
- **Star count.** Read in the Worker from `https://api.github.com/repos/OfficialSpicrawl/price-tracker` and printed into the HTML, so nothing shifts and the browser never calls GitHub (the CSP allows `'self'` only). Cached at the edge for 10 minutes; a failed or malformed read is cached for 1 minute. The "Star on GitHub" buttons show a count only when it is above zero.
- **`/llms.txt`** describes the tool for agents (install, files, flags, cost, limits). **`/og.png`** is `launch/social-preview.png` from this repo (embedded at vendor time), the `og:image` and `twitter:image`. `/robots.txt` and `/sitemap.xml` are served too. Any other path gets a designed 404.
- **Reduced motion.** Both pieces stay on their shipped frame, the bot holds a pose, nothing loops.
- **No internal engine names** appear in the page, in `/llms.txt` or in the `/api/price` response.

## Configuration

| Setting | Where | Meaning |
|---|---|---|
| `SPICRAWL_API_KEY` | secret | Key used for every check and for the credit guard. It needs the scope that reads `/v1/usage/summary`, or the credit guard refuses every check |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | secrets (optional) | Both set: the page shows a Cloudflare Turnstile widget and every check needs a token Cloudflare accepts (see below). Both unset: no widget, no verification. Only one set: checks are refused with "not configured" rather than silently running without it |
| `BEACON_TOKEN` | `vars` in `wrangler.jsonc` | Cloudflare Web Analytics token. Empty (the default) adds no analytics script. Otherwise the page includes `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "..."}'>` |
| `LIMITER` | `ratelimits` | 5 checks per 60 seconds per visitor (`CF-Connecting-IP`; an IPv6 visitor is keyed on its /64), namespace `2026102302` |
| `EVENTS` | `analytics_engine_datasets` | Dataset `spicrawl_demo_events`, one data point per `/api/price` call |

## Guards

Every check, in this order:

1. JSON body only (`content-type: application/json`). A numeric `Content-Length` of at most 4096 bytes is required and is checked before the body is read: none or a non-number is HTTP 411, over 4096 is HTTP 413. This also stops other sites from posting to it from a browser.
2. `url`: http or https only, at most 2048 characters, no `user:password@`. All trailing dots are stripped before the host is checked, so `127.0.0.1..` and `localhost..` are not a way round it, and the stripped host is the one that is fetched. IP-address hosts (IPv4 in any notation, IPv6), single-label names such as `localhost`, and `*.local`, `*.internal`, `*.localhost`, `*.localdomain`, `*.lan`, `*.home.arpa` are refused, which covers loopback and private ranges. A public name that resolves to a private address (like `127.0.0.1.nip.io`) is stopped by Spicrawl's own SSRF protection, not by the Worker.
3. `selector`: text, at most 200 characters.
4. Rate limit: 5 per minute per visitor, then HTTP 429 with a message and `Retry-After: 60`. The key is the raw `CF-Connecting-IP`; an IPv6 address is cut to its /64 first (written out in full, so `2001:db8::1` and `2001:db8::2` share a key), because one subscriber controls a whole /64.
5. Turnstile, only when `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` are both set: the token the widget put in the body (`turnstile`, at most 2048 characters) is verified with `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` (secret, token, visitor IP) before any credit is touched. A missing, rejected or unverifiable token is HTTP 403. The CSP then also allows `challenges.cloudflare.com` for scripts and frames. Create the widget in the Cloudflare dashboard (Turnstile, hostname `price-tracker.spicrawl.com`), then:

   ```sh
   npx wrangler secret put TURNSTILE_SITE_KEY --config demo/wrangler.jsonc
   npx wrangler secret put TURNSTILE_SECRET --config demo/wrangler.jsonc
   ```

   For local dev, add both to `demo/.dev.vars`; Cloudflare's always-pass test keys are `1x00000000000000000000AA` (site key) and `1x0000000000000000000000000000000AA` (secret).
6. Credit guard: `GET https://api.spicrawl.com/v1/usage/summary` with the key, cached for 60 seconds with `caches.default` (at most one summary call per minute per data center). It fails closed: if the summary cannot be read (error, key without the read scope, no `allowance`, a number that is not a number) the check is refused with "The demo can't check its credit balance right now", and a failed read is not cached. From `allowance` it then refuses a check when
   - fewer than 100 credits are left (`remaining_micro / 1e6`): "The demo has used its credits for this month. Run it yourself with a free key.", or
   - the demo is ahead of pace: credits used (`limit_micro - remaining_micro`) exceed `limit_micro * (elapsed / window) + 5% of limit_micro`, where `elapsed / window` is how far through the allowance month (`window_start` to `resets_at`) it is now: "Today's share of the demo's credits is used up. Try again tomorrow, or track it yourself with a free key". One busy day cannot drain the month.

   `allowance.unlimited` skips both checks. Both refusals are HTTP 503 `no_credits` with the commands to run it yourself; the unreadable-summary refusal is HTTP 503 `error`.
7. The Spicrawl call itself carries `max_cost: 1`, so a single check can never cost more than 1 credit, whatever the page is.

Every response carries `X-Content-Type-Options: nosniff`. The page also gets a Content-Security-Policy with a fresh nonce per load (`cache-control: no-cache`, so no shared copy): `default-src 'none'`; scripts only with that nonce plus `static.cloudflareinsights.com` for the optional analytics beacon; styles inline; fonts from the Worker itself (`font-src 'self'`: `/fonts/*.woff2`); `img-src data:`; `connect-src 'self'` plus `cloudflareinsights.com`; `base-uri`, `form-action` and `frame-ancestors` all `'none'`.

`wrangler.jsonc` sets `workers_dev: false` and `preview_urls: false`, so the Worker answers only on `price-tracker.spicrawl.com`, never on a `*.workers.dev` or preview URL.

SDK errors are turned into plain messages (bad key, out of credits, site unreachable, busy, timeout). Error text from the API is never returned, and the log line for a failed check holds only the error code and request id.

## API

`POST /api/price` with `{ "url": "...", "selector": "..." }` (selector optional). The body always has an `outcome`:

| `outcome` | HTTP | Meaning |
|---|---|---|
| `found` | 200 | `title`, `price`, `currency`, `inStock` (true, false or null), `credits`, `host`, `status` |
| `not_found` | 200 | The page answered but no price was found; `message` suggests the selector field |
| `blocked` | 200 | The site answered HTTP 400 or above, or could not be reached; `message` says "Blocked/unavailable" |
| `invalid` | 400, 403, 411, 413 | Input refused by a guard (403: Turnstile token missing or rejected; 411/413: Content-Length missing or over 4096) |
| `rate_limited` | 429 | Over 5 per minute |
| `no_credits` | 503 | Credit guard (used up or ahead of pace), or Spicrawl answered 402. Includes `commands` |
| `error` | 502, 503, 504 | Anything else, with a friendly `message`; also the credit guard when the usage summary cannot be read |

## Analytics

Each call writes one data point: `blobs = ["price-tracker", outcome, targetHost, country]`, `doubles = [creditsUsed, durationMs]`, `indexes = ["price-tracker"]`. In SQL they are `blob1..blob4`, `double1`, `double2` and `index1`.

Checks, credits and latency by outcome over the last 7 days:

```sql
SELECT blob2 AS outcome,
       SUM(_sample_interval) AS checks,
       SUM(_sample_interval * double1) AS credits,
       SUM(_sample_interval * double2) / SUM(_sample_interval) AS avg_ms
FROM spicrawl_demo_events
WHERE index1 = 'price-tracker' AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY outcome
ORDER BY checks DESC
```

Run it with the SQL API (an API token with Account Analytics Read):

```sh
curl "https://api.cloudflare.com/client/v4/accounts/036bd64d65479473f0effc8c4fb126ff/analytics_engine/sql" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --data "SELECT blob3 AS host, SUM(_sample_interval) AS checks FROM spicrawl_demo_events WHERE index1 = 'price-tracker' AND timestamp > NOW() - INTERVAL '7' DAY GROUP BY host ORDER BY checks DESC LIMIT 10"
```

## Tests

```sh
npm test
```

Runs the CLI tests and `demo/test/worker.test.mjs`. The demo tests stub the Worker env (key, limiter, analytics) and `fetch`, so nothing leaves your machine. They cover the page (one H1, share tags, no engine names, the vendored pieces and their first frames), its security headers, the star count (none at zero, cached, tolerant of a GitHub failure), the 404, `/llms.txt`, `/robots.txt`, `/sitemap.xml`, `/og.png`, autoparse and selector checks (including the 1-credit plain-fetch request), not-found, blocked, every input guard (host tricks, credentials, body size), the rate limit and its IPv6 key, Turnstile on and off, the credit guard (fail-closed, pace) and its cache, the `wrangler.jsonc` settings, SDK errors, and that the key never appears in a response.
