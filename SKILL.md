---
name: spicrawl-price-tracker
description: "Use when the user wants to track product prices or stock on web pages and be alerted on a price drop, a target price or an item back in stock (console, Discord or Slack). Runs track.mjs, which scrapes each product in products.json with the Spicrawl API."
---

# Spicrawl price tracker

`track.mjs` reads `products.json`, scrapes each product page with the Spicrawl API, compares price and stock with the last check (`.prices.json`), prints a table, and alerts on a price drop, a price at or below your target, or an item back in stock.

## Setup

1. Needs Node >= 18 and a Spicrawl API key in `SPICRAWL_API_KEY` (free key at https://app.spicrawl.com, 1,000 credits/month). If the variable is not set, ask the user to export it. Do not ask them to paste the key into chat.
2. Run `npm install` once in this directory (the folder that holds `track.mjs`).
3. Optional alerts: `DISCORD_WEBHOOK_URL` and/or `SLACK_WEBHOOK_URL` (one message per run with all ALERT lines).

## Run

Always run from this directory, because `products.json` and `.prices.json` are read from the current directory (there is no flag to change them):

```sh
node track.mjs              # check every product once
node track.mjs --every 30m  # keep running; s, m or h
node track.mjs --help
```

The first check of a product is a baseline (no drop or stock alert). Run it once before expecting changes.

## products.json

A non-empty array. Add one object per product:

```json
{ "name": "Blue Widget", "url": "https://shop.example/widget", "target": 45 }
```

- `url` (required): product page.
- `name` (optional): label in the table and alerts.
- `target` (optional, a number): alert when the price is at or below it (once, when it first gets there).
- `price` and `stock` (optional): CSS selectors for the price element and the availability text.

Start without selectors: the tool reads the page's structured data (JSON-LD, OpenGraph, microdata) for price, currency and availability. Add `price` (and `stock`) selectors only if the NOTE column says `no price or stock found`. Once either selector is set, only the selectors are used for that product, so set both if stock matters. A selector that matches nothing is reported in NOTE as `matched nothing: ...`.

## Read the output

Columns: `NAME  PRICE  CHANGE  STOCK  NOTE`.

- CHANGE: `new` (first check), `=` (same), `-1.50 (-3.0%)` or `+1.50 (+3.0%)` (moved since last check), `-` (no price found).
- STOCK: `in stock`, `out of stock`, or `?` (unknown).
- NOTE: problems. `HTTP 4xx/5xx: blocked or gone, kept last values` means the site refused; it costs 0 credits and the saved state for that product is untouched. Other notes are per-product failures; the rest still run.
- `ALERT ...` lines: price dropped, at or below target, or back in stock. They are also sent to Discord/Slack if set.
- Last line: `Credits used: N (M left this month)`. Exit code is 1 only if the key is rejected or credits run out; a blocked or failed product is not an exit error.

## Cost

A plain fetch scrape is 1 credit per product per check. `mode: "auto"` may escalate to JS rendering (3 credits) or a full browser (8). Requests use `cache: false`, so every check is billed. Budget: products x checks per month; 10 products once a day is ~300 credits, hourly ~7,200 (over the free 1,000). On the free plan keep the product list short and the interval long (every few hours or daily), and give the user the estimate before starting `--every` or cron.

To schedule without `--every`, run once per tick from cron: `0 * * * * cd /path/to/price-tracker && /usr/bin/node track.mjs >> tracker.log 2>&1` (set the env vars above the job).

## Guardrails

- Never print, log, echo or commit `SPICRAWL_API_KEY` or a webhook URL.
- Only track pages the user may fetch; respect each site's terms of service and robots rules.
- Do not hammer a site: use an interval of 15 minutes or more (`--every 15m` at the least; hourly or slower is better).
- A blocked product is final. Do not loop on it or try to get around the block.
