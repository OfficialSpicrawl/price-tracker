#!/usr/bin/env node
// Price / stock tracker on the Spicrawl API (https://docs.spicrawl.com).
// Reads products.json, scrapes each page, compares with .prices.json, alerts on changes.
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { Spicrawl, isSpicrawlError, InsufficientCreditsError, AuthenticationError } from "@spicrawl/sdk";

const PRODUCTS_FILE = "products.json";
const STATE_FILE = ".prices.json";
const USAGE = "Usage: node track.mjs [--every 30m]   (s, m or h; omit to run once)";

// ---- parsing ---------------------------------------------------------------------------

const first = (v) => (Array.isArray(v) ? v[0] : v);
// ponytail: a currency symbol is only a guess ("$" is assumed USD); prefer priceCurrency when the page has it.
const SYMBOLS = { "£": "GBP", $: "USD", "€": "EUR", "₹": "INR", "¥": "JPY" };
const currencyOf = (text) => SYMBOLS[String(text).match(/[£$€₹¥]/)?.[0]] ?? null;

// "£51.77" -> 51.77, "$1,299.00" -> 1299, "1.299,00 €" -> 1299, "49,99" -> 49.99. null if no number.
// ponytail: one separator followed by exactly 3 digits ("1,299") is read as thousands, never decimals.
export function parsePrice(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const m = String(value ?? "").replace(/(?<![\d.,])(\d{1,3})\s(?=\d{3}(?!\d))/g, "$1").match(/\d[\d.,]*/);
  if (!m) return null;
  const s = m[0].replace(/[.,]+$/, "");
  const seps = s.match(/[.,]/g) ?? [];
  const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  const decimal = seps.length > 0 && seps.filter((c) => c === s[last]).length === 1 && s.length - last - 1 !== 3;
  const digits = (t) => t.replace(/[.,]/g, "");
  return Number(decimal ? `${digits(s.slice(0, last))}.${s.slice(last + 1)}` : digits(s));
}

const OUT_OF_STOCK = /out[\s_-]?of[\s_-]?stock|not[\s_-]?in[\s_-]?stock|sold[\s_-]?out|unavailable|discontinued|\boos\b/i;
const IN_STOCK = /in[\s_-]?stock/i;
// "https://schema.org/InStock", "In stock (22 available)", "oos" ... -> true / false / null (unknown)
export const stockOf = (text) => (OUT_OF_STOCK.test(text) ? false : IN_STOCK.test(text) ? true : null);

// Spicrawl autoparse puts OpenGraph under data.open_graph with the og: prefix stripped ("price:amount").
const OG_PRICE = ["price:amount", "product:price:amount", "og:price:amount"];
const OG_CURRENCY = ["price:currency", "product:price:currency", "og:price:currency"];
const OG_STOCK = ["availability", "product:availability", "og:availability"];

// Walks whatever `autoparse` put in envelope.data (its exact shape is not documented) and returns the
// first price, currency and availability it finds in a schema.org Offer (or under `offers`) or in
// OpenGraph keys. ponytail: first match wins, so a multi-variant product reports its first offer.
export function findProduct(data) {
  const found = { price: null, currency: null, inStock: null };
  let priceText = null;
  const walk = (node, inOffer, depth) => {
    if (node === null || typeof node !== "object" || depth > 12) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, inOffer, depth + 1));
    const offer = inOffer || String(node["@type"] ?? "").includes("Offer");
    for (const [key, raw] of Object.entries(node)) {
      const value = typeof first(raw) === "object" ? raw : first(raw); // repeated meta tags arrive as arrays
      if (typeof value === "object") {
        walk(value, offer || key === "offers" || key === "priceSpecification", depth + 1);
        continue;
      }
      const k = key.toLowerCase();
      if (found.price === null && ((offer && (k === "price" || k === "lowprice")) || OG_PRICE.includes(k))) {
        found.price = parsePrice(value);
        priceText = value;
      } else if (found.currency === null && ((offer && k === "pricecurrency") || OG_CURRENCY.includes(k))) {
        found.currency = typeof value === "string" ? value.toUpperCase() : null;
      } else if (found.inStock === null && ((offer && k === "availability") || OG_STOCK.includes(k))) {
        found.inStock = stockOf(value);
      }
    }
  };
  walk(data, false, 0);
  found.currency ??= currencyOf(priceText);
  return found;
}

// ---- one check -------------------------------------------------------------------------

// Default: autoparse (JSON-LD / OpenGraph / microdata). With "price" / "stock" selectors in
// products.json: CSS extraction instead. cache:false because Spicrawl caches results for 48h by
// default, and a price tracker needs the page as it is now. request/read are exported for demo/.
// The CLI escalates (mode "auto", up to 8 credits a page) because its user pays with their own key.
// { cheap: true } is for the public demo: the plain fetch engine, never more than 1 credit.
const usesSelectors = (p) => Boolean(p.price || p.stock);

export function request(p, { cheap = false } = {}) {
  const base = { url: p.url, ...(cheap ? { max_cost: 1 } : { mode: "auto" }), cache: false };
  if (!usesSelectors(p)) return { ...base, autoparse: true };
  return { ...base, extract: Object.fromEntries([["price", p.price], ["stock", p.stock]].filter(([, sel]) => sel)) };
}

export function read(p, envelope) {
  if (!usesSelectors(p)) return findProduct(envelope.data);
  const price = first(envelope.data?.price);
  return { price: parsePrice(price), currency: currencyOf(price), inStock: stockOf(first(envelope.data?.stock)) };
}

const money = (n, currency) => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(n);
  } catch {
    return n.toFixed(2);
  }
};

function changeText(prev, price) {
  if (price === null) return "-";
  if (prev?.price == null) return "new";
  const d = price - prev.price;
  if (d === 0) return "=";
  const sign = d > 0 ? "+" : "-";
  const pct = prev.price ? ` (${sign}${Math.abs((d / prev.price) * 100).toFixed(1)}%)` : "";
  return `${sign}${Math.abs(d).toFixed(2)}${pct}`;
}

// Checks every product in turn. `state` is { [url]: { price, currency, inStock, lastChecked, lowest } }.
// Returns the new state, table rows, alert lines and credits used. Nothing is written or sent here.
export async function track({ client, products, state = {} }) {
  const next = { ...state };
  const rows = [];
  const alerts = [];
  let credits = 0;
  let remaining = null;
  let fatal = null;

  for (const p of products) {
    const name = p.name ?? p.url;
    const row = { name: name.slice(0, 40), price: "-", change: "-", stock: "-", note: "" };
    rows.push(row);
    try {
      const envelope = await client.scrape(request(p));
      credits += envelope.credits ?? envelope._meta?.creditsCharged ?? 0;
      remaining = envelope._meta?.creditsRemaining ?? remaining;

      if (envelope.status >= 400) {
        row.note = `HTTP ${envelope.status}: blocked or gone, kept last values`;
        continue;
      }
      const found = read(p, envelope);
      if (found.price === null && found.inStock === null) {
        const empty = envelope.empty_fields?.length ? ` (matched nothing: ${envelope.empty_fields.join(", ")})` : "";
        const hint = usesSelectors(p) ? "check your selectors" : 'add "price"/"stock" selectors to products.json';
        row.note = `no price or stock found${empty}; ${hint}`;
        continue;
      }

      const prev = state[p.url];
      const currency = found.currency ?? prev?.currency ?? null;
      const { price, inStock } = found;
      if (price !== null && prev?.price != null && price < prev.price) {
        alerts.push(`${name}: price dropped ${money(prev.price, currency)} -> ${money(price, currency)} ${p.url}`);
      }
      const wasUnderTarget = prev?.price != null && prev.price <= p.target;
      if (price !== null && p.target !== undefined && price <= p.target && !wasUnderTarget) {
        alerts.push(`${name}: ${money(price, currency)} is at or below your target ${money(p.target, currency)} ${p.url}`);
      }
      if (prev?.inStock === false && inStock === true) {
        alerts.push(`${name}: back in stock ${p.url}`);
      }

      const lows = [prev?.lowest, price].filter((n) => n != null);
      next[p.url] = {
        price: price ?? prev?.price ?? null,
        currency,
        inStock: inStock ?? prev?.inStock ?? null,
        lastChecked: new Date().toISOString(),
        lowest: lows.length ? Math.min(...lows) : null,
      };
      row.price = price === null ? "-" : money(price, currency);
      row.change = changeText(prev, price);
      row.stock = inStock === null ? "?" : inStock ? "in stock" : "out of stock";
      if (envelope.empty_fields?.length) row.note = `matched nothing: ${envelope.empty_fields.join(", ")}`;
    } catch (err) {
      row.note = describe(err);
      // Every later product would fail the same way, so stop the run.
      if (err instanceof AuthenticationError || err instanceof InsufficientCreditsError) {
        fatal = err;
        break;
      }
    }
  }
  return { state: next, rows, alerts, credits, remaining, fatal };
}

// ---- alerts and output -----------------------------------------------------------------

export async function notify(alerts, { env = process.env, fetch = globalThis.fetch } = {}) {
  if (alerts.length === 0) return;
  const text = alerts.join("\n").slice(0, 1900); // Discord rejects content over 2000 characters
  const hooks = [
    [env.DISCORD_WEBHOOK_URL, { content: text }],
    [env.SLACK_WEBHOOK_URL, { text }],
  ];
  for (const [url, body] of hooks) {
    if (!url) continue;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) console.error(`Webhook failed: HTTP ${res.status}`);
    } catch (err) {
      console.error(`Webhook failed: ${err.message}`);
    }
  }
}

function describe(err) {
  if (!isSpicrawlError(err)) return err instanceof Error ? err.message : String(err);
  let text = err.message.includes(err.code) ? err.message : `${err.message} [${err.code}]`;
  if (err.diagnostics?.hint) text += ` Hint: ${err.diagnostics.hint}`;
  if (err instanceof AuthenticationError) text += " Check SPICRAWL_API_KEY, or get a free key at https://app.spicrawl.com.";
  if (err instanceof InsufficientCreditsError) text += " The monthly credits are used up; they reset next month (https://app.spicrawl.com).";
  return text;
}

function printTable(rows) {
  const cols = Object.keys(rows[0]);
  const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => r[c].length)));
  const line = (r) => cols.map((c, i) => r[c].padEnd(width[i])).join("  ").trimEnd();
  console.log([line(Object.fromEntries(cols.map((c) => [c, c.toUpperCase()]))), ...rows.map(line)].join("\n"));
}

// ---- CLI -------------------------------------------------------------------------------

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT" && fallback !== undefined) return fallback;
    throw new Error(`${path}: ${err.message}`);
  }
}

function loadProducts() {
  const products = readJson(PRODUCTS_FILE);
  const ok =
    Array.isArray(products) &&
    products.length > 0 &&
    products.every((p) => typeof p?.url === "string" && (p.target === undefined || typeof p.target === "number"));
  if (!ok) throw new Error(`${PRODUCTS_FILE} must be a non-empty array of { "url", "name"?, "target"? (number), "price"?, "stock"? }`);
  return products;
}

function parseInterval(text) {
  const m = /^(\d+)([smh])$/.exec(text);
  if (!m || Number(m[1]) === 0) throw new Error(`Bad --every "${text}". ${USAGE}`);
  return Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5 }[m[2]];
}

async function main() {
  const { values } = parseArgs({ options: { every: { type: "string" }, help: { type: "boolean", short: "h" } } });
  if (values.help) return console.log(USAGE);
  const everyMs = values.every ? parseInterval(values.every) : 0;

  if (!process.env.SPICRAWL_API_KEY) {
    throw new Error(
      "SPICRAWL_API_KEY is not set. Get a free key (1,000 credits/month) at https://app.spicrawl.com, then:\n  export SPICRAWL_API_KEY=spicrawl_live_...",
    );
  }
  const products = loadProducts();
  const client = new Spicrawl(); // reads SPICRAWL_API_KEY

  for (;;) {
    const result = await track({ client, products, state: readJson(STATE_FILE, {}) });
    writeFileSync(STATE_FILE, JSON.stringify(result.state, null, 2) + "\n");

    console.log(`\n${new Date().toISOString()}`);
    printTable(result.rows);
    for (const alert of result.alerts) console.log(`ALERT ${alert}`);
    const left = result.remaining === null ? "" : ` (${result.remaining} left this month)`;
    console.log(`Credits used: ${result.credits}${left}`);
    await notify(result.alerts);

    if (result.fatal) {
      process.exitCode = 1;
      return;
    }
    if (!everyMs) return;
    await sleep(everyMs);
  }
}

// Run main() only when executed directly (also through the npm bin symlink), not when imported by the tests.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(describe(err));
    process.exit(1);
  });
}
