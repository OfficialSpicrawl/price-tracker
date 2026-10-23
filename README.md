# price-tracker: price and stock monitoring for any online store

[![test](https://github.com/OfficialSpicrawl/price-tracker/actions/workflows/test.yml/badge.svg)](https://github.com/OfficialSpicrawl/price-tracker/actions/workflows/test.yml)
[Live demo](https://price-tracker.spicrawl.com) · [Demo video](videos/) · Apache-2.0

Open-source **price tracker** and **stock monitor**: point it at product pages on Shopify and most e-commerce stores, read the price from the page's JSON-LD / OpenGraph data (no selectors needed), and get **Discord or Slack alerts** on price drops, target prices and restocks. Run it from cron or **GitHub Actions**, or as a **Claude Code / Codex agent skill** for AI agents.

Watches product pages and tells you when a price drops, falls to your target, or an item comes back in stock. It uses the [Spicrawl](https://docs.spicrawl.com) web scraping API through [`@spicrawl/sdk`](https://github.com/OfficialSpicrawl/sdk), in one file (`track.mjs`) with no build step.

It alerts when:

- the price is lower than the last check,
- the price is at or below the `target` you set (once, when it first gets there),
- an item goes from out of stock to in stock.

The first check of a product is the baseline: no drop or stock alerts. A target alert still fires if the price is already at or below it.

## Quickstart

You need Node.js 18 or later and a free Spicrawl API key (1,000 credits/month) from <https://app.spicrawl.com>.

```sh
git clone https://github.com/OfficialSpicrawl/price-tracker.git
cd price-tracker
npm install
export SPICRAWL_API_KEY=spicrawl_live_...
node track.mjs
```

The example `products.json` tracks two pages on books.toscrape.com. Output:

```text
NAME                  PRICE   CHANGE  STOCK     NOTE
A Light in the Attic  £51.77  new     in stock
Tipping the Velvet    £53.74  new     in stock
Credits used: 2 (998 left this month)
```

Run it again later and the CHANGE column shows what moved. Last prices are kept in `.prices.json` (last price, currency, in stock, last checked, lowest seen).

## products.json

```json
[
  {
    "name": "A Light in the Attic",
    "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    "target": 45,
    "price": ".product_main .price_color",
    "stock": ".product_main .availability"
  }
]
```

| Field | Required | Meaning |
|---|---|---|
| `url` | yes | Product page |
| `name` | no | Label for the table and alerts (default: the URL) |
| `target` | no | Alert when the price is at or below this number |
| `price` | no | CSS selector for the element holding the price |
| `stock` | no | CSS selector for the element holding the availability text |

**Without selectors** the tool asks Spicrawl for the page's structured data (`autoparse: true`: JSON-LD, OpenGraph, microdata) and looks for a schema.org `Product`/`Offer` (`price`, `lowPrice`, `priceCurrency`, `availability`) or OpenGraph `product:price:amount` keys. Most shops publish this, and it survives redesigns.

**With selectors** it asks Spicrawl to extract just those elements (`extract: { price, stock }`). Use this for pages without structured data, like books.toscrape.com. Prices like `£51.77`, `$1,299.00` and `1.299,00 €` are parsed into numbers. Stock text containing "in stock" counts as in stock; "out of stock", "sold out" or "unavailable" counts as out of stock; anything else is unknown. If a selector matches nothing, the NOTE column says so.

Every request uses `mode: "auto"`, which starts with a plain fetch and only escalates to JavaScript rendering if the page needs it. Every request also sends `cache: false`: Spicrawl otherwise reuses stored results for up to 48 hours, which would show you an old price.

If the site answers with HTTP 400 or above (blocked, page gone), the row says so and the saved state is not touched.

## Alerts

Every run prints the table above. Set either variable (or both) to also get alerts in chat, as one message per run:

```sh
export DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## Run it on a schedule

Loop in the foreground, checking every 30 minutes (`s`, `m` or `h`):

```sh
node track.mjs --every 30m
```

Or run once per call from cron (put the variables above the job, and use the absolute path of `node`):

```cron
SPICRAWL_API_KEY=spicrawl_live_...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
0 * * * * cd /path/to/price-tracker && /usr/bin/node track.mjs >> tracker.log 2>&1
```

Or on GitHub Actions, as `.github/workflows/price-tracker.yml` in a fork of this repo. Add `SPICRAWL_API_KEY` (and a webhook URL) under Settings, Secrets and variables, Actions. The cache step carries `.prices.json` from one run to the next.

```yaml
name: price-tracker
on:
  schedule:
    - cron: "0 */6 * * *" # every 6 hours
  workflow_dispatch:
jobs:
  track:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: price-tracker
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - uses: actions/cache@v4
        with:
          path: price-tracker/.prices.json
          key: prices-${{ github.run_id }}
          restore-keys: prices-
      - run: node track.mjs
        env:
          SPICRAWL_API_KEY: ${{ secrets.SPICRAWL_API_KEY }}
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
```

## Credits

- A plain fetch scrape costs 1 credit. A page that needs JavaScript rendering costs more (3 credits; 8 for a full Chromium), and `mode: "auto"` bills only the step that worked.
- Failed requests cost 0.
- Each run prints the credits it used and how many are left this month.
- Budget: products x checks per month. Ten products once a day is about 300 credits; the same ten hourly is about 7,200.

If the key is rejected or the credits run out, the run stops and says so (exit code 1). Other failures (a timeout, one bad page) show up in that product's NOTE and the rest are still checked.

## Tests

```sh
npm test
```

The tests pass a stubbed `fetch` into the SDK client, so they make no network calls and use no credits. They cover JSON-LD autoparse, selector extraction, price drop plus target alerts, back-in-stock, a blocked (403) page and running out of credits.

## Limits

- Pages are checked one after another.
- One price per page: if a product has several offers, the first one found wins.
- A lone `$` is read as USD, and a number like `1,299` or `1.299` (one separator, three digits after it) is read as thousands, not decimals.

## Use it from Claude Code or Codex

This folder includes a `SKILL.md` (the Agent Skills format) that tells an AI coding agent how to run the tracker. Copy this folder to `~/.claude/skills/spicrawl-price-tracker/` (Claude Code) or to `.agents/skills/spicrawl-price-tracker/` in a repo (Codex and other agents), and run `npm install` in it.

Make sure `SPICRAWL_API_KEY` is set in the shell the agent runs in, then ask for it in plain words, for example: "track the price of these two products and ping Discord when one drops below $50".
