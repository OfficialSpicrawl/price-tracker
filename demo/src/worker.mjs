// Live demo of the price tracker: GET / serves the page, POST /api/price checks one product URL.
// It builds the CLI's request in its capped form (plain fetch, 1 credit at most) and reads the answer with the CLI's parser (request/read come from ../../track.mjs).
import { Spicrawl, isSpicrawlError, AuthenticationError, PermissionDeniedError, InsufficientCreditsError } from "@spicrawl/sdk";
import { request as buildRequest, read as readProduct } from "../../track.mjs";
import { page } from "./page.mjs";
import { openpanelCsp, openpanelTag } from "./openpanel.mjs";

const API = "https://api.spicrawl.com";
const MIN_CREDITS = 100; // refuse new checks below this many credits left on the demo key
const MAX_URL = 2048;
const MAX_SELECTOR = 200;
const MAX_BODY = 4096; // bytes; a numeric Content-Length no larger than this is required before the body is read
const MAX_TOKEN = 2048; // a Turnstile token is far shorter
const CREDITS_TTL = 60; // seconds the usage summary is cached
const PACE_SLACK = 0.05; // the demo may run this share of the monthly limit ahead of an even spend
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const COMMANDS = [
  "git clone https://github.com/OfficialSpicrawl/price-tracker",
  "cd price-tracker && npm install",
  "export SPICRAWL_API_KEY=spicrawl_live_...   # free key: https://app.spicrawl.com",
  "node track.mjs",
];
const NO_CREDITS = "The demo has used its credits for this month — run it yourself with a free key.";
const PACED = "Today's share of the demo's credits is used up. Try again tomorrow, or track it yourself with a free key.";
const UNKNOWN_CREDITS = "The demo can't check its credit balance right now. Try again in a minute, or run it yourself with a free key.";

const first = (v) => (Array.isArray(v) ? v[0] : v);
const text = (v) => (typeof first(v) === "string" ? first(v).trim().slice(0, 300) : "");

const SECURITY = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};
// A fresh nonce per page load; the only inline script is the page's own. Turnstile's host is allowed only when it is on.
const csp = (nonce, turnstile, op = { script: "", connect: "" }) =>
  [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' https://static.cloudflareinsights.com${turnstile ? " https://challenges.cloudflare.com" : ""}${op.script}`,
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src data:",
    `connect-src 'self' https://cloudflareinsights.com${op.connect}`,
    ...(turnstile ? ["frame-src https://challenges.cloudflare.com"] : []),
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
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
  if (u.username || u.password) return { error: "Remove the username and password from the URL." };
  const host = u.hostname.toLowerCase().replace(/\.+$/, ""); // all trailing dots: 127.0.0.1.. is not parsed as an IP
  const isIp = host.startsWith("[") || /^\d+(\.\d+)*$/.test(host); // the URL parser turns 2130706433 and 0x7f.1 into dotted form
  if (isIp || !host.includes(".") || /(^|\.)(localhost|local|internal|localdomain|lan|home\.arpa)$/.test(host)) {
    return { error: "Private, local and IP-address hosts can't be checked. Use a public product page." };
  }
  u.hostname = host; // fetch exactly the host that was checked
  return { url: u.href, host };
}

// The demo key's allowance, from GET /v1/usage/summary, cached for a minute at the edge. Returns
// { unlimited } or { limit, remaining, start, end } (micro-credits, epoch ms), or null when the
// summary cannot be read or is malformed: the caller then refuses (fail closed).
async function allowanceOf(env, ctx) {
  const cache = globalThis.caches?.default;
  const key = new Request("https://price-tracker.spicrawl.com/__cache/allowance"); // a cache key only, never fetched
  const hit = await cache?.match(key);
  if (hit) return hit.json();
  let a;
  try {
    const res = await fetch(`${API}/v1/usage/summary`, {
      headers: { authorization: `Bearer ${env.SPICRAWL_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const raw = (await res.json()).allowance;
    if (raw?.unlimited === true) a = { unlimited: true };
    else {
      a = { limit: Number(raw?.limit_micro), remaining: Number(raw?.remaining_micro), start: Date.parse(raw?.window_start), end: Date.parse(raw?.resets_at) };
      if (!(a.limit > 0 && a.remaining >= 0 && a.end > a.start)) return null; // also false for NaN
    }
  } catch {
    return null;
  }
  const put = cache?.put(key, new Response(JSON.stringify(a), { headers: { "cache-control": `max-age=${CREDITS_TTL}` } }));
  if (put) ctx?.waitUntil?.(put.catch(() => {}));
  return a;
}

// null to go ahead, else the refusal. Fails closed: a summary that can't be read (no read scope, outage,
// malformed numbers) stops the check. Also paces the spend: the demo may be at most PACE_SLACK of the monthly
// limit ahead of an even spend over the allowance month, so one busy day can't drain the month.
async function creditRefusal(env, ctx) {
  const a = await allowanceOf(env, ctx);
  if (!a) return { outcome: "error", message: UNKNOWN_CREDITS };
  if (a.unlimited) return null;
  if (!(a.remaining / 1e6 >= MIN_CREDITS)) return { outcome: "no_credits", message: NO_CREDITS };
  const elapsed = Math.min(Math.max(Date.now() - a.start, 0), a.end - a.start) / (a.end - a.start);
  if (a.limit - a.remaining > a.limit * (elapsed + PACE_SLACK)) return { outcome: "no_credits", message: PACED };
  return null;
}

// The rate-limit key: the visitor's address, with an IPv6 address cut to its /64 (one subscriber owns a whole /64).
export function limiterKey(ip) {
  if (!ip.includes(":") || ip.includes(".")) return ip; // IPv4, or an IPv6 with an embedded IPv4 (left whole)
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(":");
}

// true only when Cloudflare says this one-time token is good. Any failure to ask is a no.
async function humanVerified(env, token, ip) {
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN) return false;
  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok && (await res.json()).success === true;
  } catch {
    return false;
  }
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
  const invalid = (message, status = 400) => done("invalid", status, { message });

  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) return invalid("Send a JSON body.");
  const length = req.headers.get("content-length") ?? "";
  if (!/^\d{1,9}$/.test(length)) return invalid("Send a Content-Length header.", 411); // checked before the body is read
  if (Number(length) > MAX_BODY) return invalid("Request too large.", 413);
  let input;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return invalid("Request too large.", 413);
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

  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const limited = await env.LIMITER?.limit({ key: limiterKey(ip) });
  if (limited && !limited.success) {
    return done("rate_limited", 429, { message: "Too many checks from your address. The demo allows 5 per minute; try again in a minute." }, { "retry-after": "60" });
  }
  const turnstile = Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET);
  if (!env.SPICRAWL_API_KEY || Boolean(env.TURNSTILE_SITE_KEY) !== Boolean(env.TURNSTILE_SECRET)) { // half-set Turnstile must not mean "off"
    return done("error", 503, { message: "The demo is not configured yet." });
  }
  if (turnstile && !(await humanVerified(env, input.turnstile, ip))) {
    return invalid("Verification failed. Reload the page and try again.", 403);
  }

  const refusal = await creditRefusal(env, ctx);
  if (refusal) return done(refusal.outcome, 503, { message: refusal.message, commands: COMMANDS });

  // fetch is passed through a wrapper: workerd rejects a bare global fetch called as a method.
  const client = new Spicrawl({ apiKey: env.SPICRAWL_API_KEY, fetch: (u, i) => fetch(u, i), timeoutMs: 45_000, maxRetries: 0 });
  const product = { url: target.url, price: selector || undefined };
  try {
    const envelope = await client.scrape(buildRequest(product, { cheap: true }));
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
      if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { ...SECURITY, allow: "GET, HEAD" } });
      const nonce = btoa(crypto.randomUUID());
      const turnstileSiteKey = env.TURNSTILE_SECRET ? env.TURNSTILE_SITE_KEY || "" : "";
      return new Response(page({ beaconToken: env.BEACON_TOKEN, nonce, turnstileSiteKey, analytics: openpanelTag(env, nonce, "price-tracker") }), {
        headers: {
          ...SECURITY,
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache", // the nonce is per request, so no shared copy
          "content-security-policy": csp(nonce, Boolean(turnstileSiteKey), openpanelCsp(env)),
        },
      });
    }
    if (pathname === "/api/price") {
      if (req.method !== "POST") return json({ outcome: "invalid", message: "Use POST." }, 405, { allow: "POST" });
      return checkPrice(req, env, ctx);
    }
    return new Response("Not found", { status: 404, headers: SECURITY });
  },
};
