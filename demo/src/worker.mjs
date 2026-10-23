// Live demo of the price tracker: GET / serves the page, POST /api/price checks one product URL.
// It makes the same Spicrawl call as the CLI (request/read come from ../../track.mjs).
import { Spicrawl, isSpicrawlError, AuthenticationError, PermissionDeniedError, InsufficientCreditsError } from "@spicrawl/sdk";
import { request as buildRequest, read as readProduct } from "../../track.mjs";
import { page } from "./page.mjs";

const API = "https://api.spicrawl.com";
const MIN_CREDITS = 100; // refuse new checks below this many credits left on the demo key
const MAX_URL = 2048;
const MAX_SELECTOR = 200;
const MAX_BODY = 8192;
const CREDITS_TTL = 60; // seconds the usage summary is cached

const COMMANDS = [
  "git clone https://github.com/OfficialSpicrawl/price-tracker",
  "cd price-tracker && npm install",
  "export SPICRAWL_API_KEY=spicrawl_live_...   # free key: https://app.spicrawl.com",
  "node track.mjs",
];
const NO_CREDITS = "The demo has used its credits for this month — run it yourself with a free key.";

const first = (v) => (Array.isArray(v) ? v[0] : v);
const text = (v) => (typeof first(v) === "string" ? first(v).trim().slice(0, 300) : "");

const SECURITY = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};
const json = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers: { ...SECURITY, "cache-control": "no-store", ...headers } });

// ---- guards ----------------------------------------------------------------------------

// Returns { url, host } or { error }. Private ranges are refused by blocking every IP literal and
// every single-label or .local/.internal name. ponytail: a public name that resolves to a private
// IP (127.0.0.1.nip.io) is stopped by Spicrawl's own SSRF guard, not here.
export function parseTarget(input) {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return { error: "Enter a product URL." };
  if (raw.length > MAX_URL) return { error: `That URL is too long (max ${MAX_URL} characters).` };
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { error: "That does not look like a URL. Use a full address like https://shop.example/product." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { error: "Only http:// and https:// URLs can be checked." };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const isIp = host.startsWith("[") || /^\d+(\.\d+)*$/.test(host); // the URL parser turns 2130706433 and 0x7f.1 into dotted form
  if (isIp || !host.includes(".") || /\.(local|internal|localhost)$/.test(host)) {
    return { error: "Private, local and IP-address hosts can't be checked. Use a public product page." };
  }
  return { url: u.href, host };
}

// The demo key's credits left, from GET /v1/usage/summary, cached for a minute at the edge.
// Returns null when unknown; the API enforces its own limit (402) so an unknown is let through.
async function creditsLeft(env, ctx) {
  const cache = globalThis.caches?.default;
  const key = new Request("https://price-tracker.spicrawl.com/__cache/credits"); // a cache key only, never fetched
  const hit = await cache?.match(key);
  if (hit) return (await hit.json()).left;
  let left = null;
  try {
    const res = await fetch(`${API}/v1/usage/summary`, {
      headers: { authorization: `Bearer ${env.SPICRAWL_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    const allowance = res.ok ? (await res.json()).allowance : null;
    if (allowance) left = allowance.unlimited ? Infinity : allowance.remaining_micro / 1e6;
  } catch {
    return null;
  }
  if (left === null) return null;
  const body = JSON.stringify({ left: left === Infinity ? 1e12 : left }); // JSON has no Infinity
  const put = cache?.put(key, new Response(body, { headers: { "cache-control": `max-age=${CREDITS_TTL}` } }));
  if (put) ctx?.waitUntil?.(put.catch(() => {}));
  return left;
}

// ---- /api/price ------------------------------------------------------------------------

function friendly(err) {
  if (err instanceof InsufficientCreditsError) return { outcome: "no_credits", status: 503, message: NO_CREDITS, commands: COMMANDS };
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return { outcome: "error", status: 503, message: "The demo's API key is not working right now. Run it yourself with a free key at https://app.spicrawl.com." };
  }
  const code = isSpicrawlError(err) ? err.code : "";
  if (/^ERR::(SECURITY|REQUEST)::/.test(code)) {
    return { outcome: "invalid", status: 400, message: "Spicrawl could not process that request. Check that the URL is a public page and the selector is valid." };
  }
  if (code === "ERR::EXTRACT::INVALID_RULES") return { outcome: "invalid", status: 400, message: "That CSS selector is not valid. Check it and try again." };
  if (/^ERR::(UPSTREAM|PROXY)::/.test(code)) {
    return { outcome: "blocked", status: 200, message: "Blocked/unavailable: the site could not be reached or refused the request." };
  }
  if (/^ERR::LIMIT::/.test(code)) return { outcome: "error", status: 503, message: "Spicrawl is busy right now. Try again in a moment." };
  if (isSpicrawlError(err) && err.status === 0) return { outcome: "error", status: 504, message: "Spicrawl did not answer in time. Try again." };
  return { outcome: "error", status: 502, message: "Something went wrong while checking that page. Try again in a moment." };
}

async function checkPrice(req, env, ctx) {
  const t0 = Date.now();
  let host = "";
  let credits = 0;
  const done = (outcome, status, body = {}, headers) => {
    env.EVENTS?.writeDataPoint({
      blobs: ["price-tracker", outcome, host, req.cf?.country || ""],
      doubles: [credits, Date.now() - t0],
      indexes: ["price-tracker"],
    });
    return json({ outcome, ...body }, status, headers);
  };
  const invalid = (message) => done("invalid", 400, { message });

  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) return invalid("Send a JSON body.");
  let input;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return invalid("Request too large.");
    input = JSON.parse(raw);
  } catch {
    return invalid("Send a JSON body like {\"url\": \"https://...\"}.");
  }
  const target = parseTarget(input?.url);
  if (target.error) return invalid(target.error);
  host = target.host;
  if (input.selector != null && typeof input.selector !== "string") return invalid("The selector must be text.");
  const selector = (input.selector ?? "").trim();
  if (selector.length > MAX_SELECTOR) return invalid(`The selector is too long (max ${MAX_SELECTOR} characters).`);

  const limited = await env.LIMITER?.limit({ key: req.headers.get("cf-connecting-ip") ?? "unknown" });
  if (limited && !limited.success) {
    return done("rate_limited", 429, { message: "Too many checks from your address. The demo allows 5 per minute; try again in a minute." }, { "retry-after": "60" });
  }
  if (!env.SPICRAWL_API_KEY) return done("error", 503, { message: "The demo is not configured yet." });

  const left = await creditsLeft(env, ctx);
  if (left !== null && left < MIN_CREDITS) return done("no_credits", 503, { message: NO_CREDITS, commands: COMMANDS });

  // fetch is passed through a wrapper: workerd rejects a bare global fetch called as a method.
  const client = new Spicrawl({ apiKey: env.SPICRAWL_API_KEY, fetch: (u, i) => fetch(u, i), timeoutMs: 45_000, maxRetries: 0 });
  const product = { url: target.url, price: selector || undefined };
  try {
    const envelope = await client.scrape(buildRequest(product));
    credits = envelope.credits ?? envelope._meta?.creditsCharged ?? 0;
    const facts = { host, credits, engine: envelope.engine ?? envelope._meta?.engine ?? null, status: envelope.status };
    if (envelope.status >= 400) {
      return done("blocked", 200, { ...facts, message: `Blocked/unavailable: the site answered HTTP ${envelope.status}. It may block automated requests, or the page is gone.` });
    }
    const { price, currency, inStock } = readProduct(product, envelope);
    const data = envelope.data ?? {};
    const found = { ...facts, title: text(data.open_graph?.title) || text(data.meta?.title), price, currency, inStock };
    if (price === null || !Number.isFinite(price)) {
      const message = selector
        ? "No price found: your selector matched nothing usable. Check it and try another."
        : "No price found on this page. It may not publish structured price data: open Advanced and enter a CSS selector for the price.";
      return done("not_found", 200, { ...found, price: null, message });
    }
    return done("found", 200, found);
  } catch (err) {
    console.error("price check failed", isSpicrawlError(err) ? `${err.code} ${err.requestId ?? ""}` : "unexpected error"); // never the message: it could echo the request
    const { outcome, status, ...body } = friendly(err);
    return done(outcome, status, body);
  }
}

// ---- routes ----------------------------------------------------------------------------

export default {
  async fetch(req, env, ctx) {
    const { pathname } = new URL(req.url);
    if (pathname === "/") {
      if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
      return new Response(page({ beaconToken: env.BEACON_TOKEN }), {
        headers: { ...SECURITY, "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
      });
    }
    if (pathname === "/api/price") {
      if (req.method !== "POST") return json({ outcome: "invalid", message: "Use POST." }, 405, { allow: "POST" });
      return checkPrice(req, env, ctx);
    }
    return new Response("Not found", { status: 404, headers: SECURITY });
  },
};
