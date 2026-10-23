// The demo page: one HTML string, inline CSS and a small inline script. No framework, no build.
// Keep backticks and dollar-brace sequences out of CSS/JS below; they sit inside template literals.
const REPO = "https://github.com/OfficialSpicrawl/price-tracker";
const KEY_URL = "https://app.spicrawl.com";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&family=Righteous&display=swap";

const CSS = `
:root {
  --ground: #16181B; --card: #1E2124; --border: #2E3135; --text: #F9F9F9; --muted: #A9ADB2;
  --radius: 10px;
  --ui: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--ground); color: var(--text); font: 400 16px/1.55 var(--ui); }
a { color: var(--text); text-underline-offset: 3px; }
a:hover { color: var(--muted); }
:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
.wrap { max-width: 720px; margin: 0 auto; padding: 0 16px; }
.skip { position: absolute; left: 16px; top: -48px; background: var(--text); color: var(--ground); padding: 8px 12px; border-radius: var(--radius); z-index: 2; }
.skip:focus { top: 8px; }

.top { border-bottom: 1px solid var(--border); }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px; }
.brand { display: flex; align-items: baseline; gap: 10px; text-decoration: none; font-weight: 500; }
.mark { font-family: "Righteous", var(--ui); font-size: 22px; letter-spacing: 0.01em; font-weight: 400; }
.sep { color: var(--muted); }
.gh { font-size: 14px; color: var(--muted); padding: 8px 0; }

h1 { font-size: clamp(26px, 6vw, 36px); line-height: 1.15; letter-spacing: -0.02em; margin: 40px 0 12px; font-weight: 600; }
h2 { font-size: 20px; margin: 0 0 8px; font-weight: 600; letter-spacing: -0.01em; }
p { margin: 0 0 12px; }
.lead { color: var(--muted); margin-bottom: 24px; }
.muted { color: var(--muted); }
.mono, code, pre { font-family: var(--mono); }

.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; }
label { display: block; font-size: 14px; font-weight: 500; margin: 0 0 6px; }
input[type=url], input[type=text] {
  width: 100%; min-height: 44px; padding: 10px 12px; font: 400 16px var(--ui); color: var(--text);
  background: var(--ground); border: 1px solid var(--border); border-radius: var(--radius);
}
input::placeholder { color: var(--muted); opacity: 0.8; }
input:focus-visible { border-color: var(--text); outline-offset: 0; }
.examples { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0 4px; font-size: 14px; }
.chip {
  min-height: 36px; padding: 6px 12px; border-radius: var(--radius); background: transparent; color: var(--text);
  border: 1px solid var(--border); font: 400 14px var(--mono); cursor: pointer;
}
.chip:hover { border-color: var(--muted); }
details { margin: 16px 0; }
summary { cursor: pointer; font-size: 14px; font-weight: 500; padding: 6px 0; }
details > div { padding-top: 8px; }
.hint { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
.primary {
  width: 100%; min-height: 48px; padding: 12px 20px; border: 0; border-radius: var(--radius);
  background: var(--text); color: var(--ground); font: 600 16px var(--ui); cursor: pointer;
}
.primary:hover { background: #E4E5E7; }
.primary[aria-disabled=true] { cursor: progress; opacity: 0.7; }
.primary:focus-visible { outline-offset: 3px; }
.cf-turnstile { margin: 0 0 16px; }
.fine { font-size: 13px; color: var(--muted); margin: 12px 0 0; }

.eyebrow { font: 500 12px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; }
.title { font-size: 18px; font-weight: 600; margin: 0 0 4px; overflow-wrap: anywhere; }
.price { font: 700 clamp(40px, 12vw, 64px)/1.1 var(--mono); letter-spacing: -0.03em; margin: 12px 0 16px; overflow-wrap: anywhere; }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin: 0; padding-top: 16px; border-top: 1px solid var(--border); }
.facts dt { font-size: 12px; color: var(--muted); }
.facts dd { margin: 2px 0 0; font: 500 15px var(--mono); }
.loading::after { content: ""; display: inline-block; width: 8px; height: 8px; margin-left: 8px; border-radius: 50%; background: var(--text); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.2; } }

pre { margin: 0 0 12px; padding: 14px; background: var(--ground); border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; line-height: 1.6; overflow-x: auto; }
code { font-size: 0.92em; }
.links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
.btn { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 18px; border-radius: var(--radius); border: 1px solid var(--border); text-decoration: none; font-weight: 500; }
.btn:hover { border-color: var(--muted); color: var(--text); }
.btn.solid { background: var(--text); color: var(--ground); border-color: var(--text); }
.btn.solid:hover { background: #E4E5E7; color: var(--ground); }
footer { padding: 16px 0 40px; font-size: 13px; color: var(--muted); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
`;

const SCRIPT = `
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var form = $("f"), url = $("url"), sel = $("sel"), adv = $("adv"), go = $("go"), out = $("out");
  var busy = false;
  var LABELS = { found: "Result", not_found: "No price found", blocked: "Blocked/unavailable", rate_limited: "Slow down",
    no_credits: "Demo out of credits", invalid: "Check the input", error: "Something went wrong" };

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function money(p, c) {
    try { return new Intl.NumberFormat("en", c ? { style: "currency", currency: c } : { minimumFractionDigits: 2 }).format(p); }
    catch (e) { return (c ? c + " " : "") + Number(p).toFixed(2); }
  }
  function fact(dl, name, value) {
    var d = el("div");
    d.appendChild(el("dt", null, name));
    d.appendChild(el("dd", null, value));
    dl.appendChild(d);
  }

  function render(d) {
    var card = el("article", "card");
    card.appendChild(el("p", "eyebrow", LABELS[d.outcome] || LABELS.error));
    if (d.outcome === "found") {
      card.appendChild(el("h2", "title", d.title || d.host));
      if (d.title) card.appendChild(el("p", "muted", d.host));
      card.appendChild(el("p", "price", money(d.price, d.currency)));
    } else {
      card.appendChild(el("p", null, d.message || "Try again in a moment."));
    }
    if (d.commands) card.appendChild(el("pre", null, d.commands.join("\\n")));
    if (d.outcome === "not_found") adv.open = true;
    if (d.credits != null) {
      var dl = el("dl", "facts");
      if (d.outcome === "found" || d.inStock != null) fact(dl, "Stock", d.inStock === true ? "In stock" : d.inStock === false ? "Out of stock" : "Unknown");
      fact(dl, "Credits used", String(d.credits));
      fact(dl, "Engine", d.engine || "n/a");
      card.appendChild(dl);
    }
    out.replaceChildren(card);
    out.scrollIntoView({ block: "nearest" });
  }

  document.querySelectorAll("[data-url]").forEach(function (b) {
    b.addEventListener("click", function () {
      url.value = b.dataset.url;
      sel.value = b.dataset.selector || "";
      adv.open = sel.value !== "";
      go.focus();
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    var ts = form.elements["cf-turnstile-response"]; // added by the Turnstile widget, once it has loaded; absent when it is off
    busy = true;
    go.setAttribute("aria-disabled", "true");
    go.textContent = "Checking...";
    out.setAttribute("aria-busy", "true");
    out.replaceChildren(el("p", "muted loading", "Fetching the page with Spicrawl. This can take up to 45 seconds"));
    fetch("/api/price", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: url.value.trim(), selector: sel.value.trim() || undefined, turnstile: ts ? ts.value : undefined })
    })
      .then(function (r) { return r.json(); })
      .catch(function () { return { outcome: "error", message: "Could not reach the demo. Check your connection and try again." }; })
      .then(function (d) {
        busy = false;
        go.removeAttribute("aria-disabled");
        go.textContent = "Check price";
        out.removeAttribute("aria-busy");
        if (ts && window.turnstile) window.turnstile.reset(); // a token works once; ts exists only when the widget is on
        render(d);
      });
  });
})();
`;

const EXAMPLES = [
  {
    label: "books.toscrape.com",
    url: "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    selector: ".product_main .price_color",
  },
  { label: "allbirds.com", url: "https://www.allbirds.com/products/mens-tree-runners", selector: "" },
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PRODUCTS_JSON = `[
  {
    "name": "A Light in the Attic",
    "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    "target": 45,
    "price": ".product_main .price_color"
  }
]`;

// beaconToken: Cloudflare Web Analytics token; empty means no analytics script.
// nonce: the per-request CSP nonce for the inline script. turnstileSiteKey: set to show the Turnstile widget.
export function page({ beaconToken = "", nonce = "", turnstileSiteKey = "" } = {}) {
  const beacon = /^[\w-]+$/.test(beaconToken)
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${beaconToken}"}'></script>`
    : "";
  const turnstile = turnstileSiteKey
    ? `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";
  const widget = turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${esc(turnstileSiteKey)}" data-theme="dark"></div>` : "";
  const examples = EXAMPLES.map(
    (x) => `<button type="button" class="chip" data-url="${esc(x.url)}" data-selector="${esc(x.selector)}">${esc(x.label)}</button>`,
  ).join("\n        ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Price tracker · Spicrawl</title>
<meta name="description" content="Paste a product URL and see its price, currency and stock, read live with the Spicrawl web scraping API.">
<meta name="color-scheme" content="dark">
<meta property="og:title" content="Spicrawl price tracker">
<meta property="og:description" content="Check any product's price and stock with the Spicrawl API. Open source.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2316181B'/%3E%3Ccircle cx='16' cy='16' r='7' fill='%23F9F9F9'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${CSS}</style>
${beacon}
${turnstile}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap bar">
    <a class="brand" href="https://spicrawl.com"><span class="mark">Spicrawl</span><span class="sep" aria-hidden="true">·</span><span>Price tracker</span></a>
    <a class="gh" href="${REPO}">GitHub</a>
  </div>
</header>
<main id="main" class="wrap">
  <h1>Check a product price</h1>
  <p class="lead">Paste a product page. Spicrawl fetches it and reads the price, currency and stock, with the open-source tracker's own parser.</p>

  <form id="f" class="card">
    <label for="url">Product URL</label>
    <input id="url" name="url" type="url" required maxlength="2048" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://shop.example/product">
    <div class="examples">
      <span class="muted">Try an example:</span>
        ${examples}
    </div>
    <details id="adv">
      <summary>Advanced</summary>
      <div>
        <label for="sel">CSS selector for the price (optional)</label>
        <input id="sel" name="selector" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder=".product .price">
        <p class="hint">For pages without structured data. Spicrawl extracts just that element, for example <code>.price_color</code>.</p>
      </div>
    </details>
    ${widget}
    <button id="go" class="primary" type="submit">Check price</button>
    <p class="fine">Each check uses at most 1 credit from a shared demo key and fetches the page without a browser, so JavaScript-heavy or bot-protected shops may come back blocked. Limit: 5 checks per minute.</p>
  </form>

  <div id="out" role="status" aria-live="polite"></div>

  <section class="card" aria-labelledby="own">
    <h2 id="own">Track it yourself</h2>
    <p class="muted">The demo runs the tracker's own parser. Run the full tool on your machine or on a schedule.</p>
    <pre tabindex="0"><code>git clone ${REPO}
cd price-tracker
npm install
export SPICRAWL_API_KEY=spicrawl_live_...</code></pre>
    <p>Describe what to watch in <code>products.json</code>:</p>
    <pre tabindex="0"><code>${esc(PRODUCTS_JSON)}</code></pre>
    <pre tabindex="0"><code>node track.mjs</code></pre>
    <p>Set <code>DISCORD_WEBHOOK_URL</code> (or <code>SLACK_WEBHOOK_URL</code>) and it posts an alert when a price drops, reaches your target, or an item is back in stock.</p>
    <div class="links">
      <a class="btn solid" href="${KEY_URL}">Get a free API key</a>
      <a class="btn" href="${REPO}">View on GitHub</a>
    </div>
  </section>
</main>
<footer class="wrap">Built on the <a href="https://docs.spicrawl.com">Spicrawl API</a>. Prices are read from the page as it is right now.</footer>
<script nonce="${esc(nonce)}">${SCRIPT}</script>
</body>
</html>
`;
}
