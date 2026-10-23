import { test } from "node:test";
import assert from "node:assert/strict";
import { Spicrawl } from "@spicrawl/sdk";
import { track, notify, parsePrice, findProduct, request } from "./track.mjs";

// A stand-in for fetch that answers POST /v1/scrape the way the API does: the JSON envelope in the
// body, billing and engine info in X-* headers (the SDK reads both). `pages` maps a product URL to
// envelope fields to override, or to { problem } for an error response.
function stubApi(pages) {
  const requests = [];
  const fetch = async (url, init) => {
    assert.equal(url, "https://api.spicrawl.com/v1/scrape");
    const body = JSON.parse(init.body);
    requests.push(body);
    const page = pages[body.url];
    if (page.problem) {
      const headers = { "content-type": "application/problem+json" };
      return new Response(JSON.stringify(page.problem), { status: page.problem.status, headers });
    }
    const envelope = {
      url: body.url,
      final_url: body.url,
      status: 200,
      content: "",
      headers: {},
      truncated: false,
      credits: 1,
      engine: "fetch",
      proxy_source: "pool",
      warnings: [],
      ...page,
    };
    const headers = {
      "content-type": "application/json",
      "x-engine": envelope.engine,
      "x-credits-charged": String(envelope.credits),
      "x-credits-remaining": "990",
      "x-target-status": String(envelope.status),
    };
    return new Response(JSON.stringify(envelope), { status: 200, headers });
  };
  const client = new Spicrawl({ apiKey: "spicrawl_test_stub", fetch, maxRetries: 0 });
  return { client, requests };
}

// What autoparse puts in envelope.data is not documented; the container keys here are a guess,
// which is why findProduct walks the whole tree.
const jsonLd = (price, availability = "https://schema.org/InStock") => ({
  jsonld: [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Kettle",
      offers: { "@type": "Offer", price: String(price), priceCurrency: "USD", availability },
    },
  ],
});

const URL_A = "https://shop.example/kettle";

test("autoparse: reads a JSON-LD Product and records a baseline without alerting", async () => {
  const { client, requests } = stubApi({ [URL_A]: { data: jsonLd("19.99") } });
  const result = await track({ client, products: [{ url: URL_A, name: "Kettle" }] });

  assert.deepEqual(requests[0], { url: URL_A, mode: "auto", cache: false, autoparse: true, response_format: "json" });
  assert.deepEqual(result.alerts, []);
  assert.equal(result.credits, 1);
  assert.equal(result.remaining, 990);
  const saved = result.state[URL_A];
  assert.deepEqual([saved.price, saved.currency, saved.inStock, saved.lowest], [19.99, "USD", true, 19.99]);
  assert.deepEqual([result.rows[0].price, result.rows[0].change, result.rows[0].stock], ["$19.99", "new", "in stock"]);
});

test("selectors: sends extract, parses the price text, reports selectors that matched nothing", async () => {
  const urlB = "https://shop.example/toaster";
  const { client, requests } = stubApi({
    [URL_A]: { data: { price: "£51.77", stock: "In stock (22 available)" }, empty_fields: [] },
    [urlB]: { data: { price: "1.299,00 €" }, empty_fields: [".stock"] },
  });
  const products = [
    { url: URL_A, price: ".price_color", stock: ".availability" },
    { url: urlB, price: ".price", stock: ".stock" },
  ];
  const { state, rows } = await track({ client, products });

  assert.deepEqual(requests[0].extract, { price: ".price_color", stock: ".availability" });
  assert.equal(requests[0].autoparse, undefined);
  assert.equal(requests[0].mode, "auto");
  assert.deepEqual([state[URL_A].price, state[URL_A].currency, state[URL_A].inStock], [51.77, "GBP", true]);
  assert.deepEqual([state[urlB].price, state[urlB].currency, state[urlB].inStock], [1299, "EUR", null]);
  assert.match(rows[1].note, /\.stock/);
});

test("price drop and target: alerts once, posts to Discord and Slack, stays quiet on the next run", async () => {
  const product = { url: URL_A, name: "Kettle", target: 50 };
  const before = { [URL_A]: { price: 60, currency: "USD", inStock: true, lastChecked: "2026-10-01T00:00:00Z", lowest: 55 } };
  const { client } = stubApi({ [URL_A]: { data: jsonLd("45.00") } });

  const first = await track({ client, products: [product], state: before });
  assert.equal(first.alerts.length, 2);
  assert.match(first.alerts[0], /price dropped \$60\.00 -> \$45\.00/);
  assert.match(first.alerts[1], /at or below your target \$50\.00/);
  assert.equal(first.rows[0].change, "-15.00 (-25.0%)");
  assert.equal(first.state[URL_A].lowest, 45);

  const posts = [];
  const env = { DISCORD_WEBHOOK_URL: "https://discord.test/hook", SLACK_WEBHOOK_URL: "https://slack.test/hook" };
  const fetch = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body), type: init.headers["content-type"] });
    return new Response(null, { status: 204 });
  };
  await notify(first.alerts, { env, fetch });
  const text = first.alerts.join("\n");
  assert.deepEqual(posts.map((p) => [p.url, p.body]), [
    ["https://discord.test/hook", { content: text }],
    ["https://slack.test/hook", { text }],
  ]);
  assert.equal(posts[0].type, "application/json");

  const second = await track({ client, products: [product], state: first.state });
  assert.deepEqual(second.alerts, []);
});

test("back in stock: alerts only on the out-of-stock to in-stock transition", async () => {
  const product = { url: URL_A, name: "Kettle" };
  const soldOut = { [URL_A]: { price: 19.99, currency: "USD", inStock: false, lastChecked: "x", lowest: 19.99 } };
  const { client } = stubApi({ [URL_A]: { data: jsonLd("19.99") } });

  const back = await track({ client, products: [product], state: soldOut });
  assert.equal(back.alerts.length, 1);
  assert.match(back.alerts[0], /back in stock/);
  assert.equal(back.state[URL_A].inStock, true);

  const again = await track({ client, products: [product], state: back.state });
  assert.deepEqual(again.alerts, []);
});

test("blocked: a target status of 403 is reported and the saved state is left alone", async () => {
  const before = { [URL_A]: { price: 19.99, currency: "USD", inStock: true, lastChecked: "x", lowest: 19.99 } };
  const { client } = stubApi({ [URL_A]: { status: 403, credits: 0, content: "Access denied", data: {} } });
  const result = await track({ client, products: [{ url: URL_A, name: "Kettle", target: 50 }], state: before });

  assert.deepEqual(result.alerts, []);
  assert.deepEqual(result.state, before);
  assert.equal(result.credits, 0);
  assert.match(result.rows[0].note, /HTTP 403/);
  assert.equal(result.fatal, null);
});

test("out of credits: the run stops with the SDK error instead of retrying every product", async () => {
  const problem = {
    type: "about:blank",
    title: "Payment Required",
    status: 402,
    code: "ERR::LIMIT::QUOTA_EXCEEDED",
    detail: "Monthly credit allowance used up",
  };
  const { client, requests } = stubApi({ [URL_A]: { problem }, "https://shop.example/other": { problem } });
  const products = [{ url: URL_A }, { url: "https://shop.example/other" }];
  const result = await track({ client, products });

  assert.equal(requests.length, 1);
  assert.equal(result.fatal.constructor.name, "InsufficientCreditsError");
  assert.equal(result.fatal.code, "ERR::LIMIT::QUOTA_EXCEEDED");
  assert.match(result.rows[0].note, /credits are used up/);
});

test("parsePrice and findProduct handle other price formats and OpenGraph keys", () => {
  const cases = [["£51.77", 51.77], ["$1,299.00", 1299], ["1.299,00 €", 1299], ["1 299,00 €", 1299], ["49,99", 49.99]];
  for (const [text, want] of cases) assert.equal(parsePrice(text), want, text);
  assert.equal(parsePrice("Call us"), null);

  const og = { opengraph: { "product:price:amount": "1.299,00", "product:price:currency": "eur", "product:availability": "oos" } };
  assert.deepEqual(findProduct(og), { price: 1299, currency: "EUR", inStock: false });
  // The live autoparse shape (captured from a Shopify product page): og: prefix stripped, under open_graph.
  const live = { meta: { title: "Tree Runner" }, open_graph: { type: "product", "price:amount": "100.00", "price:currency": "USD" } };
  assert.deepEqual(findProduct(live), { price: 100, currency: "USD", inStock: null });
  assert.deepEqual(findProduct({ unrelated: { price: "5" } }), { price: null, currency: null, inStock: null });
});

test("request: the CLI escalates with mode auto; { cheap: true } (the public demo) is a plain fetch capped at 1 credit", () => {
  const p = { url: URL_A };
  assert.deepEqual(request(p), { url: URL_A, mode: "auto", cache: false, autoparse: true });
  assert.deepEqual(request(p, { cheap: true }), { url: URL_A, max_cost: 1, cache: false, autoparse: true });
  const sel = { url: URL_A, price: ".p" };
  assert.deepEqual(request(sel), { url: URL_A, mode: "auto", cache: false, extract: { price: ".p" } });
  assert.deepEqual(request(sel, { cheap: true }), { url: URL_A, max_cost: 1, cache: false, extract: { price: ".p" } });
});
