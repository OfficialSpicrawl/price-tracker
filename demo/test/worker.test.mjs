import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import worker, { parseTarget, limiterKey } from "../src/worker.mjs";
import { ASCII_JS } from "../src/vendor/ascii.gen.mjs";
import { priceAt } from "../vendor/pieces/terminal.js";

const KEY = "spicrawl_live_SECRET_KEY_123";
const BOOK = "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html";
const SHOE = "https://www.allbirds.com/products/mens-tree-runners";

const realFetch = globalThis.fetch;
const realCaches = globalThis.caches;
const realConsoleError = console.error;
let calls; // every request the Worker made to api.spicrawl.com
let api; // per-test overrides: { summary, scrape, turnstile }
let cacheStore;
let githubCalls; // requests the Worker made to api.github.com

const DAY = 86_400_000;
// A usage summary `elapsed` of the way through a 30-day allowance month, `used` of `limit` credits spent.
const summary = ({ used = 100, elapsed = 0.5, limit = 1000 } = {}) => ({
  allowance: {
    unlimited: false,
    limit_micro: limit * 1e6,
    used_micro: used * 1e6,
    remaining_micro: (limit - used) * 1e6,
    window_start: new Date(Date.now() - elapsed * 30 * DAY).toISOString(),
    resets_at: new Date(Date.now() + (1 - elapsed) * 30 * DAY).toISOString(),
  },
});

// A stand-in for api.spicrawl.com (GET /v1/usage/summary, POST /v1/scrape), for Turnstile's siteverify and for the GitHub repo API.
function stubFetch() {
  return async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (new URL(url).hostname === "api.github.com") {
      githubCalls++;
      const g = api.github ?? { stargazers_count: 0 };
      return g instanceof Response ? g : Response.json(g);
    }
    const form = init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : null;
    calls.push({ url: String(url), path, init, form, body: init.body && !form ? JSON.parse(init.body) : null });
    if (path === "/turnstile/v0/siteverify") return api.turnstile instanceof Response ? api.turnstile : Response.json(api.turnstile ?? { success: true });
    if (path === "/v1/usage/summary") {
      const s = api.summary ?? summary();
      return s instanceof Response ? s : Response.json(s);
    }
    assert.equal(path, "/v1/scrape");
    const scrape = api.scrape;
    if (scrape instanceof Response) return scrape;
    const envelope = { url: "", final_url: "", status: 200, content: "", headers: {}, truncated: false, credits: 1, engine: "fetch", proxy_source: "pool", warnings: [], ...scrape };
    return Response.json(envelope, { headers: { "x-credits-charged": String(envelope.credits), "x-engine": envelope.engine, "x-target-status": String(envelope.status) } });
  };
}

const problem = (status, code, title) =>
  new Response(JSON.stringify({ type: "about:blank", title, status, code, detail: `${title} ${KEY}` }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });

beforeEach(() => {
  calls = [];
  githubCalls = 0;
  api = {};
  cacheStore = new Map();
  globalThis.fetch = stubFetch();
  globalThis.caches = {
    default: {
      match: async (req) => (cacheStore.has(req.url) ? new Response(cacheStore.get(req.url)) : undefined),
      put: async (req, res) => void cacheStore.set(req.url, await res.text()),
    },
  };
  console.error = () => {};
});
afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.caches = realCaches;
  console.error = realConsoleError;
});

function makeEnv(extra = {}) {
  const points = [];
  const limits = [];
  return {
    SPICRAWL_API_KEY: KEY,
    BEACON_TOKEN: "",
    EVENTS: { writeDataPoint: (p) => points.push(p) },
    LIMITER: { limit: async (o) => (limits.push(o), { success: true }) },
    points,
    limits,
    ...extra,
  };
}

const ctx = { waitUntil: (p) => p };

// length: the Content-Length header; omitted by default means the real byte length, null means none.
async function price(body, env = makeEnv(), { raw = false, type = "application/json", headers = {}, length } = {}) {
  const text = raw ? body : JSON.stringify(body);
  const cl = length === undefined ? String(Buffer.byteLength(text)) : length;
  const req = new Request("https://price-tracker.spicrawl.com/api/price", {
    method: "POST",
    headers: { "content-type": type, "cf-connecting-ip": "203.0.113.7", ...(cl === null ? {} : { "content-length": cl }), ...headers },
    body: text,
  });
  const res = await worker.fetch(req, env, ctx);
  const out = await res.text();
  assert.ok(!out.includes(KEY), "the API key must never appear in a response");
  return { res, json: JSON.parse(out), env };
}

const scrapes = () => calls.filter((c) => c.path === "/v1/scrape");

test("GET / serves the page: hero, live check, examples, agent section, links, share tags, no beacon by default", async () => {
  const res = await worker.fetch(new Request("https://price-tracker.spicrawl.com/"), makeEnv(), ctx);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  for (const needle of [
    "Get alerted when a price drops.",
    "Track product pages.",
    "Check price",
    "CSS selector",
    "Try Spicrawl free",
    "1,000 credits a month",
    "Star on GitHub",
    "npx skills add OfficialSpicrawl/price-tracker",
    "ASCII by ascii.rest",
    "node track.mjs",
    'property="og:image"',
    'name="twitter:card" content="summary_large_image"',
    'rel="canonical"',
    "/llms.txt",
    BOOK,
    SHOE,
    "git clone https://github.com/OfficialSpicrawl/price-tracker",
    "npm install",
    "node track.mjs",
    "Discord, Slack or your agent",
    "https://app.spicrawl.com",
    "https://github.com/OfficialSpicrawl/price-tracker",
    "font-family: \"Righteous\"",
    'rel="preload" href="/fonts/righteous.woff2"',
    "#top-h { font-family: var(--display)",
    "/fonts/geist.woff2",
    "/fonts/geist-mono.woff2",
    "prefers-reduced-motion",
    "#16181B",
  ]) {
    assert.ok(html.includes(needle), `page should contain ${needle}`);
  }
  assert.ok(!html.includes("cloudflareinsights"));
  assert.ok(!html.includes(KEY));
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, "one h1");
  assert.ok(!/engine|moli|chromium|camoufox|obscura|browserless|headful|headless|playwright|puppeteer/i.test(html), "no internal engine names");
  assert.ok(!/[\u2013\u2014]/.test(html.replace(/<style>[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "")), "no en or em dashes in the page text");
});

test("the star button shows a count only when the repo has stars, printed into the HTML (no browser call to GitHub)", async () => {
  const get = async () => (await worker.fetch(new Request("https://price-tracker.spicrawl.com/"), makeEnv(), ctx)).text();
  assert.ok(!(await get()).includes('class="count"'), "0 stars: no count");
  cacheStore.clear();
  api.github = { stargazers_count: 1234 };
  const html = await get();
  assert.equal((html.match(/class="count"/g) ?? []).length, 2, "header and close button");
  assert.ok(html.includes("<span>1.2k</span>"));
  assert.ok(html.includes("Star on GitHub"));
  const csp = (await worker.fetch(new Request("https://x.test/"), makeEnv(), ctx)).headers.get("content-security-policy");
  assert.ok(!csp.includes("api.github.com"), "the browser never talks to GitHub");
});

test("star count: cached for ten minutes, and a GitHub failure or a bad number shows no count", async () => {
  api.github = { stargazers_count: 7 };
  const get = async () => (await worker.fetch(new Request("https://x.test/"), makeEnv(), ctx)).text();
  await get();
  await get();
  assert.equal(githubCalls, 1, "second view comes from the cache");
  cacheStore.clear();
  api.github = new Response("rate limited", { status: 403 });
  assert.ok(!(await get()).includes('class="count"'));
  await get();
  assert.equal(githubCalls, 2, "a failed read is cached too");
  cacheStore.clear();
  api.github = { stargazers_count: "lots" };
  assert.ok(!(await get()).includes('class="count"'));
  cacheStore.clear();
  globalThis.fetch = async () => { throw new Error("network down"); };
  const res = await worker.fetch(new Request("https://x.test/"), makeEnv(), ctx);
  assert.equal(res.status, 200, "the page still renders");
});

test("the page's inline script parses (a stray escape in the template would only show in a browser)", async () => {
  const html = await (await worker.fetch(new Request("https://price-tracker.spicrawl.com/"), makeEnv(), ctx)).text();
  const code = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Script(code), "inline script has a syntax error");
});

test("the ASCII pieces are vendored with their MIT notice, inline in the page's one script, and ship as text first", async () => {
  assert.match(ASCII_JS, /ascii\.rest 0\.4\.0/);
  assert.match(ASCII_JS, /MIT License[\s\S]*bas3line/);
  const html = await (await worker.fetch(new Request("https://price-tracker.spicrawl.com/"), makeEnv(), ctx)).text();
  assert.ok(html.includes(ASCII_JS.slice(0, 200).replace(/&/g, "&")) || html.includes("ascii.rest 0.4.0"), "the vendored script is in the page");
  assert.match(html, /<legend>price-tracker<\/legend>/);
  assert.match(html, /<pre id="term" aria-hidden="true">NAME  PRICE   CHANGE           STOCK/, "the terminal's first frame is in the HTML");
  assert.match(html, /<pre id="spark" aria-hidden="true">[^<]*£44\.99/, "the chart's first frame is the price after the drop");
  assert.match(html, /ALERT Mug: £44\.99 is at or below your target £45\.00/);
  assert.equal(html.match(/<script nonce=/g).length, 1, "one nonce'd script, no external script tag for the pieces");
  assert.ok(!/<script[^>]+src=[^>]*ascii/.test(html));
  assert.deepEqual([priceAt(0, 8), priceAt(8.2, 8), priceAt(9, 8), priceAt(12, 8)], [59, 56, 48.1, 44.99]);
});

test("unknown paths get a designed 404 (one H1, a way back, noindex, a CSP, no script); other methods get plain text", async () => {
  const res = await worker.fetch(new Request("https://price-tracker.spicrawl.com/nope"), makeEnv(), ctx);
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type"), /text\/html/);
  const html = await res.text();
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
  assert.ok(html.includes('href="/"') && html.includes("noindex") && !html.includes("<script"));
  assert.ok(res.headers.get("content-security-policy").includes("default-src 'none'"));
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  const post = await worker.fetch(new Request("https://x.test/nope", { method: "POST", body: "{}" }), makeEnv(), ctx);
  assert.equal(post.status, 404);
  assert.equal(await post.text(), "Not found");
});

test("/og.png and the self-hosted fonts are served from the Worker (no third party), immutable fonts, GET only", async () => {
  const og = await worker.fetch(new Request("https://price-tracker.spicrawl.com/og.png"), makeEnv(), ctx);
  assert.equal(og.status, 200);
  assert.equal(og.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await og.arrayBuffer()), readFileSync(new URL("../../launch/social-preview.png", import.meta.url)), "the share image is launch/social-preview.png");
  for (const path of ["/fonts/geist.woff2", "/fonts/geist-mono.woff2", "/fonts/geist-mono-symbols.woff2", "/fonts/righteous.woff2"]) {
    const res = await worker.fetch(new Request(`https://price-tracker.spicrawl.com${path}`), makeEnv(), ctx);
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get("content-type"), "font/woff2");
    assert.match(res.headers.get("cache-control"), /immutable/);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.subarray(0, 4).toString(), "wOF2", `${path} is woff2`);
    assert.equal((await worker.fetch(new Request(`https://x.test${path}`, { method: "POST" }), makeEnv(), ctx)).status, 405);
  }
  const html = await (await worker.fetch(new Request("https://price-tracker.spicrawl.com/"), makeEnv(), ctx)).text();
  assert.ok(html.includes('property="og:image" content="https://price-tracker.spicrawl.com/og.png"'));
  assert.ok(html.includes('name="twitter:image" content="https://price-tracker.spicrawl.com/og.png"'));
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(html), "no Google Fonts");
});

test("/llms.txt, /robots.txt and /sitemap.xml are served as text, GET only, no engine names", async () => {
  for (const [path, type, needle] of [["/llms.txt", /text\/plain/, "npx skills add OfficialSpicrawl/price-tracker"], ["/robots.txt", /text\/plain/, "Sitemap: https://price-tracker.spicrawl.com/sitemap.xml"], ["/sitemap.xml", /xml/, "<loc>https://price-tracker.spicrawl.com/</loc>"]]) {
    const res = await worker.fetch(new Request(`https://price-tracker.spicrawl.com${path}`), makeEnv(), ctx);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type"), type);
    const body = await res.text();
    assert.ok(body.includes(needle), path);
    assert.ok(!/obscura|moli|chromium|camoufox|browserless|headful|headless|playwright|puppeteer/i.test(body), path);
    assert.equal((await worker.fetch(new Request(`https://x.test${path}`, { method: "POST" }), makeEnv(), ctx)).status, 405);
  }
});

test("security headers: a per-request-nonce CSP on the page, nosniff on every response", async () => {
  const get = () => worker.fetch(new Request("https://price-tracker.spicrawl.com/"), makeEnv({ BEACON_TOKEN: "abc123" }), ctx);
  const [a, b] = [await get(), await get()];
  const htmlA = await a.clone().text();
  const nonce = (res) => res.headers.get("content-security-policy").match(/script-src 'nonce-([^']+)'/)[1];
  assert.notEqual(nonce(a), nonce(b));
  assert.ok(htmlA.includes(`<script nonce="${nonce(a)}">`), "the inline script carries this response's nonce");
  assert.equal((htmlA.match(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/g) ?? []).length, 1, "no other inline script (JSON-LD is data, not script)");
  assert.ok(!/ on\w+=/i.test(htmlA), "no inline event handlers");
  const csp = a.headers.get("content-security-policy");
  for (const part of [
    "default-src 'none'",
    "https://static.cloudflareinsights.com",
    "style-src 'unsafe-inline'",
    "font-src 'self'",
    "connect-src 'self' https://cloudflareinsights.com",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ]) {
    assert.ok(csp.includes(part), part);
  }
  assert.ok(!csp.includes("challenges.cloudflare.com") && !csp.includes("unsafe-eval"));
  assert.match(a.headers.get("cache-control"), /no-cache/);

  const responses = [
    a,
    await worker.fetch(new Request("https://x.test/nope"), makeEnv(), ctx),
    await worker.fetch(new Request("https://x.test/", { method: "POST", body: "{}" }), makeEnv(), ctx),
    await worker.fetch(new Request("https://x.test/api/price"), makeEnv(), ctx),
    (await price({ url: "nope" })).res,
    (await price({ url: SHOE }, makeEnv({ SPICRAWL_API_KEY: undefined }))).res,
  ];
  for (const res of responses) assert.equal(res.headers.get("x-content-type-options"), "nosniff", String(res.status));
});

test("GET / adds the Web Analytics beacon only for a clean token", async () => {
  const withToken = await (await worker.fetch(new Request("https://x.test/"), makeEnv({ BEACON_TOKEN: "abc123" }), ctx)).text();
  assert.ok(withToken.includes(`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "abc123"}'></script>`));
  const injected = await (await worker.fetch(new Request("https://x.test/"), makeEnv({ BEACON_TOKEN: `x'"><script>` }), ctx)).text();
  assert.ok(!injected.includes("cloudflareinsights"));
});

test("autoparse: reads price, currency, stock and title from the OpenGraph shape; plain fetch capped at 1 credit", async () => {
  api.scrape = {
    credits: 1,
    engine: "fetch",
    data: {
      meta: { title: "Men's Tree Runners | Allbirds" },
      open_graph: { title: "Men's Tree Runners", "price:amount": "100.00", "price:currency": "USD", availability: "instock" },
    },
  };
  const { res, json, env } = await price({ url: SHOE });

  assert.equal(res.status, 200);
  assert.deepEqual(json, {
    outcome: "found",
    host: "www.allbirds.com",
    credits: 1,
    status: 200,
    title: "Men's Tree Runners",
    price: 100,
    currency: "USD",
    inStock: true,
  });
  const [scrape] = scrapes();
  assert.deepEqual(scrape.body, { url: SHOE, max_cost: 1, cache: false, autoparse: true, response_format: "json" });
  assert.equal(new Headers(scrape.init.headers).get("authorization"), `Bearer ${KEY}`);
  assert.deepEqual(env.points, [
    { blobs: ["price-tracker", "found", "www.allbirds.com", ""], doubles: [1, env.points[0].doubles[1]], indexes: ["price-tracker"] },
  ]);
  assert.ok(env.points[0].doubles[1] >= 0);
  assert.deepEqual(env.limits, [{ key: "203.0.113.7" }]);
});

test("autoparse: falls back to meta.title when there is no OpenGraph title", async () => {
  api.scrape = { data: { meta: { title: "Kettle" }, json_ld: [{ "@type": "Product", offers: { "@type": "Offer", price: "19.99", priceCurrency: "EUR", availability: "https://schema.org/OutOfStock" } }] } };
  const { json } = await price({ url: "https://shop.example/kettle" });
  assert.deepEqual([json.title, json.price, json.currency, json.inStock], ["Kettle", 19.99, "EUR", false]);
});

test("selector: sends extract and parses the price text", async () => {
  api.scrape = { data: { price: "£51.77" }, empty_fields: [] };
  const { json } = await price({ url: BOOK, selector: "  .product_main .price_color " });
  assert.deepEqual(scrapes()[0].body, { url: BOOK, max_cost: 1, cache: false, extract: { price: ".product_main .price_color" }, response_format: "json" });
  assert.deepEqual([json.outcome, json.price, json.currency, json.inStock, json.title], ["found", 51.77, "GBP", null, ""]);
});

test("no price found: says so, suggests the selector, still reports credits, never the engine", async () => {
  api.scrape = { credits: 3, engine: "obscura", data: { meta: { title: "Home" } } };
  const { res, json, env } = await price({ url: SHOE });
  assert.equal(res.status, 200);
  assert.equal(json.outcome, "not_found");
  assert.equal(json.price, null);
  assert.match(json.message, /No price found/);
  assert.match(json.message, /selector/);
  assert.equal(json.credits, 3);
  assert.ok(!("engine" in json), "the engine name is internal and is not returned");
  assert.equal(env.points[0].blobs[1], "not_found");
  assert.equal(env.points[0].doubles[0], 3);
});

test("a selector that matches nothing is reported as not found", async () => {
  api.scrape = { data: {}, empty_fields: ["price"] };
  const { json } = await price({ url: BOOK, selector: ".nope" });
  assert.equal(json.outcome, "not_found");
  assert.match(json.message, /selector matched nothing/);
});

test("target status >= 400 is Blocked/unavailable", async () => {
  api.scrape = { status: 403, credits: 0, data: { open_graph: { "price:amount": "5" } } };
  const { res, json, env } = await price({ url: SHOE });
  assert.equal(res.status, 200);
  assert.equal(json.outcome, "blocked");
  assert.match(json.message, /^Blocked\/unavailable/);
  assert.match(json.message, /403/);
  assert.equal(env.points[0].blobs[1], "blocked");
});

test("rejects bad input before any API call", async () => {
  const bad = [
    "ftp://example.com/a",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "not a url",
    "",
    "http://localhost/admin",
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://[fe80::1]/",
    "https://printer.local/",
    "https://db.internal/",
    "https://intranet/",
    "http://127.0.0.1../",
    "http://127.0.0.1.../admin",
    "http://localhost../",
    "http://metadata.google.internal../",
    "https://user:pw@example.com/",
    "https://user@example.com/",
    "https://:pw@example.com/",
    "https://router.lan/",
    "https://nas.localdomain/",
    "https://printer.home.arpa/",
    "https://home.arpa/",
    "https://8.8.8.8/",
    "https://example.com/" + "a".repeat(2048),
  ];
  for (const url of bad) {
    const { res, json, env } = await price({ url });
    assert.equal(res.status, 400, url.slice(0, 60));
    assert.equal(json.outcome, "invalid", url.slice(0, 60));
    assert.equal(env.points[0].blobs[1], "invalid");
  }
  const { res, json } = await price({ url: BOOK, selector: "a".repeat(201) });
  assert.equal(res.status, 400);
  assert.match(json.message, /selector is too long/);
  assert.equal((await price({ url: BOOK, selector: 5 })).res.status, 400);
  assert.equal((await price("{nope", makeEnv(), { raw: true })).res.status, 400);
  assert.equal((await price("url=x", makeEnv(), { raw: true, type: "text/plain" })).res.status, 400);
  assert.deepEqual(calls, []);
});

test("body size: a numeric Content-Length of at most 4096 is required before the body is read", async () => {
  let read = 0;
  const send = async (headers, body = '{"url":"https://shop.example/p"}') => {
    const req = new Request("https://price-tracker.spicrawl.com/api/price", { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
    const text = req.text.bind(req);
    req.text = () => (read++, text());
    const res = await worker.fetch(req, makeEnv(), ctx);
    return [res.status, (await res.json()).outcome];
  };
  assert.deepEqual(await send({}), [411, "invalid"]); // none (chunked)
  assert.deepEqual(await send({ "content-length": "abc" }), [411, "invalid"]);
  assert.deepEqual(await send({ "content-length": "-5" }), [411, "invalid"]);
  assert.deepEqual(await send({ "content-length": "4097" }), [413, "invalid"]);
  assert.deepEqual(await send({ "content-length": "99999999999" }), [411, "invalid"]);
  assert.equal(read, 0, "none of those bodies was read");

  const big = JSON.stringify({ url: BOOK, selector: "x", pad: "a".repeat(4100) });
  const { res } = await price(big, makeEnv(), { raw: true });
  assert.equal(res.status, 413);
  const head = JSON.stringify({ url: BOOK, selector: ".p", pad: "" });
  const exact = JSON.stringify({ url: BOOK, selector: ".p", pad: "a".repeat(4096 - Buffer.byteLength(head)) });
  assert.equal(Buffer.byteLength(exact), 4096);
  api.scrape = { data: { price: "1.00" } };
  assert.equal((await price(exact, makeEnv(), { raw: true })).json.outcome, "found");
  assert.equal(scrapes().length, 1);
});

test("accepts public hosts, including ones that merely contain private-looking text", () => {
  for (const url of ["https://www.allbirds.com/products/x?a=1#b", "http://localhost.example.com/", "https://local.example.org/", "https://10.example.com/"]) {
    assert.ok(parseTarget(url).url, url);
  }
  assert.equal(parseTarget("https://Shop.Example.com./p").host, "shop.example.com");
  assert.equal(parseTarget("https://Shop.Example.com../p").url, "https://shop.example.com/p"); // the checked host is the fetched host
  for (const url of ["https://lan.example.com/", "https://localdomain.shop/", "https://my-home.arpa.example.org/"]) assert.ok(parseTarget(url).url, url);
});

test("rate limit key: an IPv6 visitor is keyed on its /64, an IPv4 one on the address", async () => {
  assert.equal(limiterKey("203.0.113.7"), "203.0.113.7");
  assert.equal(limiterKey("::ffff:203.0.113.7"), "::ffff:203.0.113.7");
  const same = ["2001:db8:1:2::1", "2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:0DB8:1:2:0:0:0:9", "2001:db8:1:2::"];
  assert.deepEqual([...new Set(same.map(limiterKey))], ["2001:db8:1:2"]);
  assert.equal(limiterKey("2001:db8::1"), limiterKey("2001:db8::ffff"), "a /64 whose prefix ends in zero groups still collapses");
  assert.notEqual(limiterKey("2001:db8:1:2::1"), limiterKey("2001:db8:1:3::1"));
  assert.equal(limiterKey("::1"), "0:0:0:0");

  api.scrape = { data: { price: "1.00" } };
  const env = makeEnv();
  for (const ip of ["2001:db8:1:2::1", "2001:db8:1:2:ffff::7", "198.51.100.9"]) {
    await price({ url: BOOK, selector: ".p" }, env, { headers: { "cf-connecting-ip": ip } });
  }
  assert.deepEqual(env.limits, [{ key: "2001:db8:1:2" }, { key: "2001:db8:1:2" }, { key: "198.51.100.9" }]);
});

test("rate limit: 429 with a message, no API call", async () => {
  const env = makeEnv({ LIMITER: { limit: async () => ({ success: false }) } });
  const { res, json } = await price({ url: BOOK }, env);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), "60");
  assert.equal(json.outcome, "rate_limited");
  assert.match(json.message, /5 per minute/);
  assert.deepEqual(calls, []);
  assert.equal(env.points[0].blobs[1], "rate_limited");
});

test("credit guard: refuses below 100 credits with the run-it-yourself commands, no scrape", async () => {
  api.summary = summary({ used: 1000 - 99.999999, elapsed: 1 });
  const { res, json, env } = await price({ url: BOOK });
  assert.equal(res.status, 503);
  assert.equal(json.outcome, "no_credits");
  assert.equal(json.message, "The demo has used its credits for this month. Run it yourself with a free key.");
  assert.ok(json.commands.some((c) => c.includes("git clone")) && json.commands.some((c) => c.includes("node track.mjs")));
  assert.equal(scrapes().length, 0);
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), `Bearer ${KEY}`);
  assert.equal(env.points[0].blobs[1], "no_credits");
});

test("credit guard: exactly 100 passes, unlimited passes, and the summary is cached for the next request", async () => {
  api.summary = summary({ used: 900, elapsed: 1 });
  api.scrape = { data: { price: "1.00" } };
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found");
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found");
  assert.equal(calls.filter((c) => c.path === "/v1/usage/summary").length, 1);
  assert.equal(scrapes().length, 2);

  cacheStore.clear();
  calls = [];
  api.summary = { allowance: { unlimited: true, limit_micro: 0, remaining_micro: 0 } };
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found");
});

test("credit guard fails closed: an unreadable or malformed usage summary stops the check, and is not cached", async () => {
  const broken = [
    () => new Response("nope", { status: 500 }),
    () => problem(403, "ERR::AUTH::INSUFFICIENT_SCOPE", "Missing scope"), // a key without the read scope
    () => Response.json({}), // no allowance counter
    () => Response.json({ allowance: null }),
    () => new Response("<html>", { status: 200 }),
    () => Response.json(summary({}).allowance), // not wrapped
    () => { const s = summary(); s.allowance.remaining_micro = "lots"; return Response.json(s); },
    () => { const s = summary(); delete s.allowance.remaining_micro; return Response.json(s); },
    () => { const s = summary(); s.allowance.remaining_micro = -1; return Response.json(s); },
    () => { const s = summary(); s.allowance.limit_micro = 0; return Response.json(s); },
    () => { const s = summary(); s.allowance.window_start = "yesterday-ish"; return Response.json(s); },
    () => { const s = summary(); s.allowance.resets_at = s.allowance.window_start; return Response.json(s); },
  ];
  for (const [i, make] of broken.entries()) {
    api.summary = make();
    const { res, json, env } = await price({ url: BOOK, selector: ".p" });
    assert.equal(res.status, 503, `case ${i}`);
    assert.equal(json.outcome, "error", `case ${i}`);
    assert.match(json.message, /can't check its credit balance/, `case ${i}`);
    assert.equal(env.points[0].blobs[1], "error");
  }
  assert.equal(scrapes().length, 0);

  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  assert.equal((await price({ url: BOOK, selector: ".p" })).res.status, 503);

  // a failure is not cached: the next request reads the summary again and goes through once it is healthy
  globalThis.fetch = stubFetch();
  api.summary = summary();
  api.scrape = { data: { price: "1.00" } };
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found");
});

test("credit guard paces the spend: at most 5% of the monthly limit ahead of an even spend", async () => {
  api.scrape = { data: { price: "1.00" } };
  const run = async (opts) => {
    cacheStore.clear();
    api.summary = summary(opts);
    return price({ url: BOOK, selector: ".p" });
  };
  // halfway through the month: 500 credits even, 550 allowed
  assert.equal((await run({ used: 540, elapsed: 0.5 })).json.outcome, "found");
  const ahead = await run({ used: 560, elapsed: 0.5 });
  assert.equal(ahead.res.status, 503);
  assert.equal(ahead.json.outcome, "no_credits");
  assert.equal(ahead.json.message, "Today's share of the demo's credits is used up. Try again tomorrow, or track it yourself with a free key.");
  assert.ok(ahead.json.commands.some((c) => c.includes("node track.mjs")));
  assert.equal(ahead.env.points[0].blobs[1], "no_credits");
  assert.equal(scrapes().length, 1, "only the first went to /v1/scrape");
  // the first day of the month: only the 5% head start (50 credits)
  assert.equal((await run({ used: 40, elapsed: 0 })).json.outcome, "found");
  assert.equal((await run({ used: 60, elapsed: 0 })).res.status, 503);
  // late in the month there is room again
  assert.equal((await run({ used: 900, elapsed: 0.99 })).json.outcome, "found");
  // the pace is worked out per request from the cached numbers, not cached itself
  cacheStore.clear();
  api.summary = summary({ used: 540, elapsed: 0.5 });
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found");
  api.summary = summary({ used: 999, elapsed: 0.5 });
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found", "still served from the cached summary");
});

test("turnstile: off unless both TURNSTILE_SITE_KEY and TURNSTILE_SECRET are set; no widget, no siteverify, no extra CSP", async () => {
  api.scrape = { data: { price: "1.00" } };
  const html = await (await worker.fetch(new Request("https://x.test/"), makeEnv(), ctx)).text();
  assert.ok(!html.includes('<div class="cf-turnstile"') && !html.includes("challenges.cloudflare.com"));
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found");
  assert.ok(!calls.some((c) => c.path === "/turnstile/v0/siteverify"));
});

test("turnstile: the widget and CSP appear, and a verified token is required before any credit is spent", async () => {
  const env = () => makeEnv({ TURNSTILE_SITE_KEY: "0xSITE", TURNSTILE_SECRET: "0xSECRET" });
  const res = await worker.fetch(new Request("https://x.test/"), env(), ctx);
  const html = await res.text();
  assert.ok(html.includes('<div class="cf-turnstile" data-sitekey="0xSITE"'));
  assert.ok(html.includes('src="https://challenges.cloudflare.com/turnstile/v0/api.js"'));
  assert.ok(!html.includes("0xSECRET"));
  const csp = res.headers.get("content-security-policy");
  assert.match(csp, /script-src 'nonce-[^']+' https:\/\/static\.cloudflareinsights\.com https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /frame-src https:\/\/challenges\.cloudflare\.com/);

  api.scrape = { data: { price: "1.00" } };
  const body = { url: BOOK, selector: ".p" };
  // no token, a non-string, an oversize one: refused without asking Cloudflare, without the summary, without a scrape
  for (const turnstile of [undefined, 7, "", "x".repeat(2049)]) {
    const r = await price({ ...body, turnstile }, env());
    assert.equal(r.res.status, 403);
    assert.equal(r.json.outcome, "invalid");
    assert.match(r.json.message, /Verification failed/);
  }
  assert.deepEqual(calls, []);
  // Cloudflare says no, answers badly, or can't be reached
  for (const answer of [{ success: false, "error-codes": ["invalid-input-response"] }, new Response("oops", { status: 500 }), new Response("<html>")]) {
    api.turnstile = answer instanceof Response ? answer.clone() : answer;
    assert.equal((await price({ ...body, turnstile: "tok" }, env())).res.status, 403);
  }
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  assert.equal((await price({ ...body, turnstile: "tok" }, env())).res.status, 403);
  globalThis.fetch = stubFetch();
  assert.equal(calls.filter((c) => c.path !== "/turnstile/v0/siteverify").length, 0, "no summary read and no scrape for any of those");

  // a good token goes through, and Cloudflare is asked with the secret, the token and the visitor's raw IP
  calls = [];
  api.turnstile = { success: true };
  const ok = await price({ ...body, turnstile: "good-token" }, env());
  assert.equal(ok.json.outcome, "found");
  const [verify] = calls;
  assert.equal(verify.url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  assert.deepEqual(verify.form, { secret: "0xSECRET", response: "good-token", remoteip: "203.0.113.7" });
  assert.equal(scrapes().length, 1);
  // bad input never reaches Cloudflare
  calls = [];
  assert.equal((await price({ url: "http://localhost/", turnstile: "good-token" }, env())).res.status, 400);
  assert.deepEqual(calls, []);
});

test("turnstile: only one of the two settings is a misconfiguration, not 'off'", async () => {
  for (const half of [{ TURNSTILE_SECRET: "0xSECRET" }, { TURNSTILE_SITE_KEY: "0xSITE" }]) {
    const { res, json } = await price({ url: BOOK, selector: ".p" }, makeEnv(half));
    assert.equal(res.status, 503);
    assert.match(json.message, /not configured/);
  }
  assert.deepEqual(calls, []);
  const html = await (await worker.fetch(new Request("https://x.test/"), makeEnv({ TURNSTILE_SITE_KEY: "0xSITE" }), ctx)).text();
  assert.ok(!html.includes('<div class="cf-turnstile"'));
});

test("wrangler.jsonc: no workers.dev URL and no preview URLs", () => {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, ""));
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
});

test("SDK errors become friendly messages and never leak the key", async () => {
  const cases = [
    [problem(401, "ERR::AUTH::INVALID_KEY", "Invalid key"), 503, "error", /not working/],
    [problem(402, "ERR::LIMIT::QUOTA_EXCEEDED", "Quota"), 503, "no_credits", /used its credits/],
    [problem(400, "ERR::SECURITY::SSRF_BLOCKED", "Blocked"), 400, "invalid", /public page/],
    [problem(400, "ERR::EXTRACT::INVALID_RULES", "Bad rules"), 400, "invalid", /selector is not valid/],
    [problem(502, "ERR::UPSTREAM::CHALLENGE", "Challenge"), 200, "blocked", /^Blocked\/unavailable/],
    [problem(429, "ERR::LIMIT::RATE_LIMITED", "Slow"), 503, "error", /busy/],
    [problem(500, "ERR::INTERNAL::ERROR", "Oops"), 502, "error", /Something went wrong/],
  ];
  for (const [response, status, outcome, message] of cases) {
    api.scrape = response.clone();
    const { res, json, env } = await price({ url: SHOE });
    assert.equal(res.status, status, outcome);
    assert.equal(json.outcome, outcome);
    assert.match(json.message, message);
    assert.equal(env.points[0].blobs[1], outcome);
  }
});

test("a dropped connection to Spicrawl is an error, not a crash", async () => {
  globalThis.fetch = async (url) => {
    if (new URL(url).pathname === "/v1/usage/summary") return Response.json({ allowance: { unlimited: true } });
    throw new TypeError("fetch failed");
  };
  const { res, json } = await price({ url: SHOE });
  assert.equal(res.status, 504);
  assert.equal(json.outcome, "error");
});

test("works without the optional bindings and refuses to run without a key", async () => {
  api.scrape = { data: { price: "2.50" } };
  const bare = { SPICRAWL_API_KEY: KEY };
  assert.equal((await price({ url: BOOK, selector: ".p" }, bare)).json.outcome, "found");
  const { res, json } = await price({ url: BOOK }, makeEnv({ SPICRAWL_API_KEY: undefined }));
  assert.equal(res.status, 503);
  assert.equal(json.outcome, "error");
});

test("routing: wrong method and unknown path", async () => {
  const get = await worker.fetch(new Request("https://x.test/api/price"), makeEnv(), ctx);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");
  const post = await worker.fetch(new Request("https://x.test/", { method: "POST", body: "{}" }), makeEnv(), ctx);
  assert.equal(post.status, 405);
  assert.equal((await worker.fetch(new Request("https://x.test/nope"), makeEnv(), ctx)).status, 404);
});
