import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, { parseTarget } from "../src/worker.mjs";

const KEY = "spicrawl_live_SECRET_KEY_123";
const BOOK = "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html";
const SHOE = "https://www.allbirds.com/products/mens-tree-runners";

const realFetch = globalThis.fetch;
const realCaches = globalThis.caches;
const realConsoleError = console.error;
let calls; // every request the Worker made to api.spicrawl.com
let api; // per-test overrides: { summary, scrape }
let cacheStore;

// A stand-in for api.spicrawl.com: GET /v1/usage/summary and POST /v1/scrape.
function stubFetch() {
  return async (url, init = {}) => {
    const path = new URL(url).pathname;
    calls.push({ url: String(url), path, init, body: init.body ? JSON.parse(init.body) : null });
    if (path === "/v1/usage/summary") {
      const s = api.summary ?? { allowance: { unlimited: false, remaining_micro: 500e6 } };
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

async function price(body, env = makeEnv(), { raw = false, type = "application/json", headers = {} } = {}) {
  const req = new Request("https://price-tracker.spicrawl.com/api/price", {
    method: "POST",
    headers: { "content-type": type, "cf-connecting-ip": "203.0.113.7", ...headers },
    body: raw ? body : JSON.stringify(body),
  });
  const res = await worker.fetch(req, env, ctx);
  const text = await res.text();
  assert.ok(!text.includes(KEY), "the API key must never appear in a response");
  return { res, json: JSON.parse(text), env };
}

const scrapes = () => calls.filter((c) => c.path === "/v1/scrape");

test("GET / serves the page: form, examples, track-it-yourself block, links, no beacon by default", async () => {
  const res = await worker.fetch(new Request("https://price-tracker.spicrawl.com/"), makeEnv(), ctx);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  for (const needle of [
    "Check price",
    "Advanced",
    BOOK,
    SHOE,
    "git clone https://github.com/OfficialSpicrawl/price-tracker",
    "npm install",
    "node track.mjs",
    "DISCORD_WEBHOOK_URL",
    "products.json",
    "https://app.spicrawl.com",
    "https://github.com/OfficialSpicrawl/price-tracker",
    "family=Righteous",
    "JetBrains+Mono",
    "prefers-reduced-motion",
    "#16181B",
  ]) {
    assert.ok(html.includes(needle), `page should contain ${needle}`);
  }
  assert.ok(!html.includes("cloudflareinsights"));
  assert.ok(!html.includes(KEY));
});

test("GET / adds the Web Analytics beacon only for a clean token", async () => {
  const withToken = await (await worker.fetch(new Request("https://x.test/"), makeEnv({ BEACON_TOKEN: "abc123" }), ctx)).text();
  assert.ok(withToken.includes(`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "abc123"}'></script>`));
  const injected = await (await worker.fetch(new Request("https://x.test/"), makeEnv({ BEACON_TOKEN: `x'"><script>` }), ctx)).text();
  assert.ok(!injected.includes("cloudflareinsights"));
});

test("autoparse: reads price, currency, stock and title from the OpenGraph shape; same call as the CLI", async () => {
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
    engine: "fetch",
    status: 200,
    title: "Men's Tree Runners",
    price: 100,
    currency: "USD",
    inStock: true,
  });
  const [scrape] = scrapes();
  assert.deepEqual(scrape.body, { url: SHOE, mode: "auto", cache: false, autoparse: true, response_format: "json" });
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
  assert.deepEqual(scrapes()[0].body, { url: BOOK, mode: "auto", cache: false, extract: { price: ".product_main .price_color" }, response_format: "json" });
  assert.deepEqual([json.outcome, json.price, json.currency, json.inStock, json.title], ["found", 51.77, "GBP", null, ""]);
});

test("no price found: says so, suggests the selector, still reports credits and engine", async () => {
  api.scrape = { credits: 3, engine: "obscura", data: { meta: { title: "Home" } } };
  const { res, json, env } = await price({ url: SHOE });
  assert.equal(res.status, 200);
  assert.equal(json.outcome, "not_found");
  assert.equal(json.price, null);
  assert.match(json.message, /No price found/);
  assert.match(json.message, /selector/);
  assert.deepEqual([json.credits, json.engine], [3, "obscura"]);
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

test("accepts public hosts, including ones that merely contain private-looking text", () => {
  for (const url of ["https://www.allbirds.com/products/x?a=1#b", "http://localhost.example.com/", "https://local.example.org/", "https://10.example.com/"]) {
    assert.ok(parseTarget(url).url, url);
  }
  assert.equal(parseTarget("https://Shop.Example.com./p").host, "shop.example.com");
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
  api.summary = { allowance: { unlimited: false, remaining_micro: 99_999_999 } };
  const { res, json, env } = await price({ url: BOOK });
  assert.equal(res.status, 503);
  assert.equal(json.outcome, "no_credits");
  assert.equal(json.message, "The demo has used its credits for this month — run it yourself with a free key.");
  assert.ok(json.commands.some((c) => c.includes("git clone")) && json.commands.some((c) => c.includes("node track.mjs")));
  assert.equal(scrapes().length, 0);
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), `Bearer ${KEY}`);
  assert.equal(env.points[0].blobs[1], "no_credits");
});

test("credit guard: exactly 100 passes, unlimited passes, and the summary is cached for the next request", async () => {
  api.summary = { allowance: { unlimited: false, remaining_micro: 100e6 } };
  api.scrape = { data: { price: "1.00" } };
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found");
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found");
  assert.equal(calls.filter((c) => c.path === "/v1/usage/summary").length, 1);
  assert.equal(scrapes().length, 2);

  cacheStore.clear();
  calls = [];
  api.summary = { allowance: { unlimited: true, remaining_micro: 0 } };
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found");
});

test("credit guard: if the usage summary cannot be read, the check goes ahead and the API enforces its own limit", async () => {
  api.summary = new Response("nope", { status: 500 });
  api.scrape = { data: { price: "1.00" } };
  assert.equal((await price({ url: BOOK, selector: ".p" })).json.outcome, "found");
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
