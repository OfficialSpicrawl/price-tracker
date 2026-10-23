# Live demo (Cloudflare Worker)

A one-page demo of the price tracker, served at <https://price-tracker.spicrawl.com>. A visitor pastes a product URL (optionally a CSS selector for the price) and the Worker checks it with Spicrawl: the same call as `track.mjs` (`mode: "auto"`, `cache: false`, autoparse or selector extract), parsed with the CLI's own `findProduct` / `parsePrice` (imported from `../track.mjs`).

| File | What it is |
|---|---|
| `wrangler.jsonc` | Worker config: custom domain, rate limit, Analytics Engine dataset |
| `src/worker.mjs` | `GET /` serves the page, `POST /api/price` checks one URL |
| `src/page.mjs` | The page: one HTML string with inline CSS and a small inline script, no build |
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

## Configuration

| Setting | Where | Meaning |
|---|---|---|
| `SPICRAWL_API_KEY` | secret | Key used for every check and for the credit guard |
| `BEACON_TOKEN` | `vars` in `wrangler.jsonc` | Cloudflare Web Analytics token. Empty (the default) adds no analytics script. Otherwise the page includes `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "..."}'>` |
| `LIMITER` | `ratelimits` | 5 checks per 60 seconds per visitor IP (`CF-Connecting-IP`), namespace `2026102302` |
| `EVENTS` | `analytics_engine_datasets` | Dataset `spicrawl_demo_events`, one data point per `/api/price` call |

## Guards

Every check, in this order:

1. JSON body only (`content-type: application/json`, max 8 KB). This also stops other sites from posting to it from a browser.
2. `url`: http or https only, at most 2048 characters. IP-address hosts (IPv4 in any notation, IPv6), single-label names such as `localhost`, and `*.local`, `*.internal`, `*.localhost` are refused, which covers loopback and private ranges. A public name that resolves to a private address (like `127.0.0.1.nip.io`) is stopped by Spicrawl's own SSRF protection, not by the Worker.
3. `selector`: text, at most 200 characters.
4. Rate limit: 5 per minute per IP, then HTTP 429 with a message and `Retry-After: 60`.
5. Credit guard: `GET https://api.spicrawl.com/v1/usage/summary` with the key. Below 100 credits left (`allowance.remaining_micro / 1e6`, ignored when `allowance.unlimited`) the check is refused with "The demo has used its credits for this month — run it yourself with a free key" and the commands to do so. The summary is cached for 60 seconds with `caches.default`, so at most one summary call per minute per data center. If the summary cannot be read the check goes ahead; the API still enforces its own limit and the Worker maps that to the same message.

SDK errors are turned into plain messages (bad key, out of credits, site unreachable, busy, timeout). Error text from the API is never returned, and the log line for a failed check holds only the error code and request id.

## API

`POST /api/price` with `{ "url": "...", "selector": "..." }` (selector optional). The body always has an `outcome`:

| `outcome` | HTTP | Meaning |
|---|---|---|
| `found` | 200 | `title`, `price`, `currency`, `inStock` (true, false or null), `credits`, `engine`, `host`, `status` |
| `not_found` | 200 | The page answered but no price was found; `message` suggests the selector field |
| `blocked` | 200 | The site answered HTTP 400 or above, or could not be reached; `message` says "Blocked/unavailable" |
| `invalid` | 400 | Input refused by a guard |
| `rate_limited` | 429 | Over 5 per minute |
| `no_credits` | 503 | Credit guard, or Spicrawl answered 402. Includes `commands` |
| `error` | 502, 503, 504 | Anything else, with a friendly `message` |

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

Runs the CLI tests and `demo/test/worker.test.mjs`. The demo tests stub the Worker env (key, limiter, analytics) and `fetch`, so nothing leaves your machine. They cover the page, autoparse and selector checks, not-found, blocked, every input guard, the rate limit, the credit guard and its cache, SDK errors, and that the key never appears in a response.
