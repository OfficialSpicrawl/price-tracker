// The demo page: one HTML string, inline CSS and one inline script. No framework, no build step.
// Design notes are in ../DESIGN.md. Keep backticks and dollar-brace sequences out of CSS/JS below; they sit inside template literals.
// The ASCII pieces (a sparkline and a terminal) are from ascii.rest (MIT): see ../vendor/ and the footer credit.
import { ASCII_JS } from "./vendor/ascii.gen.mjs";
import * as sparklinePiece from "../vendor/pieces/sparkline.js";
import * as terminalPiece from "../vendor/pieces/terminal.js";
const { priceAt } = terminalPiece;

const SITE = "https://price-tracker.spicrawl.com";
const REPO = "https://github.com/OfficialSpicrawl/price-tracker";
const KEY_URL = "https://app.spicrawl.com";
const DOCS_URL = "https://docs.spicrawl.com";
const SDK_URL = "https://github.com/OfficialSpicrawl/sdk";
const OG_IMAGE = `${SITE}/og.png`; // the Worker redirects it to launch/social-preview.png in the repo

// Geist and Geist Mono (OFL, vercel/geist-font), self-hosted as woff2 subsets (served by the Worker, see vendor/build.mjs);
// Righteous only for the Spicrawl wordmark, subset to its eight letters.
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const FONT_FACES = `
@font-face { font-family: "Geist"; font-weight: 100 900; font-display: swap; src: url(/fonts/geist.woff2) format("woff2"); unicode-range: ${LATIN}; }
@font-face { font-family: "Geist Mono"; font-weight: 100 900; font-display: swap; src: url(/fonts/geist-mono.woff2) format("woff2"); unicode-range: ${LATIN}; }
@font-face { font-family: "Geist Mono"; font-weight: 100 900; font-display: swap; src: url(/fonts/geist-mono-symbols.woff2) format("woff2"); unicode-range: U+2000-2001, U+2004-2008, U+200A, U+23B8-23BD, U+2500-259F; }
@font-face { font-family: "Righteous"; font-weight: 400; font-display: swap; src: url(/fonts/wordmark.woff2) format("woff2"); unicode-range: U+53, U+61, U+63, U+69, U+6c, U+70, U+72, U+77; }`;
const FONT_PRELOAD = `<link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/geist-mono.woff2" as="font" type="font/woff2" crossorigin>`;

const TITLE = "Price tracker by Spicrawl: get alerted when a price drops";
const DESCRIPTION =
  "Open-source price and stock tracker. Get a Discord or Slack alert on a price drop, a target price or a restock, from a terminal, GitHub Actions or an agent skill.";

const CSS = `${FONT_FACES}
:root {
  --ground: #16181B; --card: #1E2124; --line: #2E3135; --ctl: #6B7076;
  --ink: #F9F9F9; --muted: #A9ADB2; --dim: #8A8E94;
  --r: 10px; --col: 576px; --gut: 16px; --ease: cubic-bezier(0.165, 0.84, 0.44, 1);
  --ui: "Geist", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color-scheme: dark;
}
@media (min-width: 640px) { :root { --gut: 24px; } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body { margin: 0; background: var(--ground); color: var(--ink); font: 400 16px/1.5 var(--ui); -webkit-font-smoothing: antialiased; }
::selection { background: var(--ink); color: var(--ground); }
a { color: inherit; text-underline-offset: 3px; }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.wrap { max-width: calc(1120px + 2 * var(--gut)); margin: 0 auto; padding: 0 var(--gut); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.skip { position: absolute; left: var(--gut); top: -56px; background: var(--ink); color: var(--ground); padding: 10px 14px; border-radius: var(--r); z-index: 5; font-weight: 600; }
.skip:focus { top: 8px; }
.mono, code, pre { font-family: var(--mono); }
h1, p, pre, figure { margin: 0; }
h1 { font-size: clamp(40px, 7vw, 72px); line-height: 1.05; letter-spacing: -0.03em; font-weight: 600; text-wrap: balance; }
.sub { font-size: clamp(17px, 2vw, 20px); color: var(--muted); }
.tiny { font: 400 13px/1.4 var(--mono); color: var(--muted); }

/* one treatment for primary targets: the label ticks up and a copy rolls in */
.lab { display: inline-grid; overflow: clip; padding-block: 0.12em; margin-block: -0.12em; }
.lab > span { grid-area: 1 / 1; transition: translate 0.35s var(--ease); }
.lab > span + span { translate: 0 120%; }
.roll .arr { transition: translate 0.35s var(--ease); flex: none; }
@media (hover: hover) {
  .roll:hover .lab > span { translate: 0 -120%; }
  .roll:hover .lab > span + span { translate: 0 0; }
  .roll:hover .arr { translate: 4px 0; }
}
.roll:focus-visible .lab > span { translate: 0 -120%; }
.roll:focus-visible .lab > span + span { translate: 0 0; }
.roll:active { transform: translateY(1px); }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 22px; border-radius: var(--r); border: 1px solid var(--ctl); background: transparent; color: var(--ink); text-decoration: none; font: 500 16px/1.2 var(--ui); cursor: pointer; transition: background-color 0.2s, border-color 0.2s; }
.btn:hover { border-color: var(--ink); }
.btn.solid { background: var(--ink); color: var(--ground); border-color: var(--ink); font-weight: 600; }
.btn.solid:hover { background: transparent; color: var(--ink); border-color: var(--ink); }
.btn.sm { min-height: 36px; padding: 0 12px; font: 500 13px/1.2 var(--mono); }
.btn[aria-disabled=true] { cursor: progress; opacity: 0.7; }
.arr { width: 16px; height: 16px; }

/* top bar */
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 72px; }
.brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 500; min-height: 44px; }
.brand { padding: 0 8px; margin-left: -8px; border-radius: 8px; }
.brand:hover { text-decoration: underline; text-underline-offset: 5px; }
.mark { font-family: "Righteous", var(--ui); font-size: 22px; letter-spacing: 0.01em; font-weight: 400; }
.brand .name, .brand .sep { display: none; color: var(--muted); }
@media (min-width: 420px) { .brand .name, .brand .sep { display: inline; } }
.gh { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border: 1px solid var(--ctl); border-radius: var(--r); text-decoration: none; font: 500 14px/1 var(--ui); color: var(--ink); transition: border-color 0.2s; }
.gh:hover { background: var(--ink); color: var(--ground); border-color: var(--ink); }
.gh:hover .count { border-left-color: var(--ctl); }
.gh svg { width: 18px; height: 18px; fill: currentColor; flex: none; }
.gh .full { display: none; }
@media (min-width: 560px) { .gh .full { display: inline; } .gh .short { display: none; } }
.gh .count { display: inline-flex; align-items: center; gap: 5px; padding-left: 10px; margin-left: 2px; border-left: 1px solid var(--line); font: 500 13px var(--mono); font-variant-numeric: tabular-nums; }
.gh .count svg { width: 14px; height: 14px; }

/* hero: one centered column, the command is the star */
.hero { display: grid; justify-items: center; gap: 24px; text-align: center; padding: 48px 0 0; }
@media (min-width: 720px) { .hero { padding-top: 72px; gap: 24px; } }
.install { width: 100%; max-width: var(--col); margin-top: 12px; text-align: left; background: var(--card); border: 1px solid var(--line); border-radius: var(--r); overflow: clip; }
.tabs { display: flex; border-bottom: 1px solid var(--line); }
.tabs button { min-height: 44px; padding: 0 18px; background: transparent; border: 0; color: var(--muted); font: 500 13px var(--mono); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tabs button:hover { color: var(--ink); }
.tabs button[aria-selected=true] { color: var(--ink); border-bottom-color: var(--ink); }
.tabs button[aria-selected=true]:hover { background: rgba(255, 255, 255, 0.05); }
.tabs button:focus-visible { outline-offset: -4px; }
.panel { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; align-items: center; padding: 14px 16px; }
.panel[hidden] { display: none; }
.cmd { padding-right: 8px; font-size: 15px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; min-height: calc(var(--n, 1) * 1.7em); }
.caret { display: inline-block; width: 0.55em; height: 1.05em; margin-left: 2px; vertical-align: -0.2em; background: var(--ink); animation: caret 0.526s steps(1) infinite; } /* 1.9 Hz */
.cmd .p { color: var(--dim); user-select: none; }
.cta { display: grid; justify-items: center; gap: 10px; margin-top: 8px; }

/* the example: ASCII pieces from ascii.rest. Font size follows the box so the pieces fit down to 360px. */
.stage { display: grid; justify-items: center; gap: 12px; padding: 56px 0 0; }
@media (min-width: 720px) { .stage { padding-top: 64px; } }
.cap { font: 400 14px/1.4 var(--mono); color: var(--muted); }
.art { width: min(100%, var(--col)); container-type: inline-size; }
.term { margin: 0; min-width: 0; padding: 16px 18px 18px; border: 1px solid var(--ctl); border-radius: var(--r); display: grid; gap: 14px; }
.term legend { padding: 0 8px; margin-left: -4px; font: 500 13px var(--mono); color: var(--muted); }
/* 52 columns of 0.6em fill the box; the pieces sit on their own layer so block glyphs render in grayscale (no colour seams) */
.term pre { letter-spacing: 0; font-kerning: none; font: 500 min(17.2px, calc((100cqw - 38px) / 31.2)) / 1.15 var(--mono); color: #D3D6D9; white-space: pre; text-rendering: geometricPrecision; transform: translateZ(0); }

/* live check: one input is the star */
.try { max-width: var(--col); margin: 0 auto; padding: 88px 0 0; }
h2 { margin: 0; font: 600 20px/1.3 var(--ui); letter-spacing: -0.01em; }
.check { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.state { display: flex; align-items: center; gap: 10px; font: 500 13px var(--mono); color: var(--muted); min-height: 36px; }
.bot { width: 34px; height: 34px; flex: none; overflow: visible; }
.bot .head { fill: #26292D; stroke: var(--ink); stroke-width: 1.5; }
.bot .eye { fill: var(--ink); transform-box: fill-box; transform-origin: center; animation: blink 4.6s infinite; }
.bot .ear { fill: var(--muted); }
.bot .ant { stroke: var(--muted); stroke-width: 1.5; }
.bot .led { fill: var(--ink); }
.bot .eyes { animation: glance 9s infinite var(--ease); }
.check[data-s=working] .bot .body { animation: hop 0.6s var(--ease) infinite alternate; }
.check[data-s=working] .bot .eyes { animation: scan 0.7s ease-in-out infinite alternate; }
.check[data-s=working] .bot .eye { animation: none; }
.check[data-s=working] .bot .led { animation: led 0.5s steps(1) infinite; }
.check[data-s=asleep] .bot .eye { animation: none; scale: 1 0.12; }
.check[data-s=asleep] .bot .eyes { animation: none; }
.check[data-s=asleep] .bot .led { fill: var(--dim); }
.row { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 640px) { .row { grid-template-columns: minmax(0, 1fr) auto; } }
input[type=url], input[type=text] { width: 100%; min-height: 52px; padding: 10px 16px; font: 400 16px var(--ui); color: var(--ink); background: var(--card); border: 1px solid var(--ctl); border-radius: var(--r); }
input::placeholder { color: var(--muted); opacity: 0.85; }
input:focus-visible { border-color: var(--ink); outline-offset: 0; }
.row .btn { min-height: 52px; }
.opts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.chipb { min-height: 44px; padding: 0 12px; border-radius: var(--r); background: transparent; color: var(--ink); border: 1px solid var(--ctl); font: 400 13px var(--mono); cursor: pointer; transition: border-color 0.2s; }
@media (hover: hover) { .chipb:hover { background: var(--ink); color: var(--ground); border-color: var(--ink); } }
.tbtn { min-height: 44px; padding: 0 4px; margin-left: auto; background: none; border: 0; color: var(--muted); font: 500 13px var(--mono); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.tbtn:hover { color: var(--ink); }
.tbtn .lab { padding-block: 0.2em; }
.tbtn .lab > span { text-decoration: underline; text-underline-offset: 3px; }
.sel[hidden] { display: none; }
.cf-turnstile { margin: 0; }
#out:empty { display: none; }
.result { display: grid; gap: 6px; padding-top: 24px; border-top: 1px solid var(--line); }
.host { font: 400 13px var(--mono); color: var(--muted); overflow-wrap: anywhere; }
.price { font: 600 clamp(48px, 12vw, 72px)/1.05 var(--mono); letter-spacing: -0.04em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.meta { font: 400 13px var(--mono); color: var(--muted); }
.note { color: var(--muted); }
.track { position: relative; margin-top: 12px; }
.track pre { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; padding: 16px; padding-right: 88px; background: var(--card); border: 1px solid var(--line); border-radius: var(--r); font-size: 12.5px; line-height: 1.6; overflow-x: auto; color: #D3D6D9; }
.track .btn { position: absolute; top: 8px; right: 8px; }
.cmdlist { padding: 14px 16px; background: var(--card); border: 1px solid var(--line); border-radius: var(--r); font-size: 12.5px; line-height: 1.6; overflow-x: auto; color: #D3D6D9; }

/* close */
.close { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 16px; padding: 88px 0 0; text-align: center; }
.close h2 { flex: 0 0 100%; font-size: clamp(24px, 4vw, 32px); }
footer { margin-top: 96px; border-top: 1px solid var(--line); padding: 20px 0 40px; font: 400 13px var(--mono); color: var(--muted); }
footer .wrap { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 24px; }
footer a { display: inline-flex; min-height: 32px; align-items: center; }
footer a:hover { color: var(--ink); }

@keyframes caret { 50% { opacity: 0; } }
@media (max-width: 639px) { .btn.sm, .gh { min-height: 44px; } footer a { min-height: 44px; } }
@keyframes blink { 0%, 90%, 100% { scale: 1 1; } 94% { scale: 1 0.1; } }
@keyframes glance { 0%, 28% { translate: 0 0; } 34%, 52% { translate: -2.5px 0; } 58%, 78% { translate: 2.5px 0; } 84%, 100% { translate: 0 0; } }
@keyframes scan { from { translate: -3px 0; } to { translate: 3px 0; } }
@keyframes hop { from { translate: 0 0; } to { translate: 0 -2px; } }
@keyframes led { 50% { opacity: 0.2; } }
.off, .off * { animation-play-state: paused !important; } /* off screen: nothing animates */

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .lab > span { translate: none !important; }
  .lab > span + span { display: none; }
  .roll:hover .lab > span:first-child, .roll:focus-visible .lab > span:first-child { text-decoration: underline; text-underline-offset: 4px; }
  .roll:hover .arr { translate: none; }
  .caret { display: none; }
  .check[data-s=working] .bot .eyes { translate: -2px 0; }
}
`;

const SCRIPT = `
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var live = $("live");
  function say(t) { live.textContent = ""; setTimeout(function () { live.textContent = t; }, 30); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function labelOf(btn, text) { btn.querySelectorAll(".lab > span").forEach(function (s) { s.textContent = text; }); }
  function rollBtn(cls, text) {
    var b = el("button", cls); b.type = "button";
    var lab = el("span", "lab"); lab.appendChild(el("span", null, text));
    var l2 = el("span", null, text); l2.setAttribute("aria-hidden", "true"); lab.appendChild(l2); b.appendChild(lab);
    return b;
  }

  // ---- copy buttons: data-copy holds the text ------------------------------------------------
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, no) {
      var t = el("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy") ? ok() : no(); } catch (e) { no(e); }
      document.body.removeChild(t);
    });
  }
  function wireCopy(btn) {
    btn.addEventListener("click", function () {
      copyText(btn.dataset.copy).then(function () {
        labelOf(btn, "Copied"); say("Copied to the clipboard");
      }, function () { labelOf(btn, "Press Ctrl+C"); });
      setTimeout(function () { labelOf(btn, "Copy"); }, 1800);
    });
  }
  document.querySelectorAll("[data-copy]").forEach(wireCopy);

  // ---- install tabs ---------------------------------------------------------------------------
  var tabs = Array.prototype.slice.call(document.querySelectorAll("[role=tab]"));
  function pick(t) {
    tabs.forEach(function (x) {
      var on = x === t;
      x.setAttribute("aria-selected", on ? "true" : "false");
      x.tabIndex = on ? 0 : -1;
      $(x.getAttribute("aria-controls")).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { pick(t); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (e.key === "Home") d = -i; if (e.key === "End") d = tabs.length - 1 - i;
      if (!d) return;
      e.preventDefault();
      var n = tabs[(i + d + tabs.length) % tabs.length]; pick(n); n.focus();
    });
  });

  // ---- the command block types itself, like a terminal -----------------------------------------
  // The page ships the full text (and the same text for screen readers); with reduced motion that is what stays.
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Types once, as the page loads, and then rests with a blinking caret. A tab switch shows its command at once.
  var typing = false;
  document.querySelectorAll("[data-type]").forEach(function (code) {
    if (reduced || code.closest(".panel").hidden) return;
    var full = code.dataset.full, i = 0, caret = el("i", "caret");
    function paint() { code.textContent = full.slice(0, i); code.appendChild(caret); }
    function step() {
      if (i >= full.length) { startExample(); return; }
      i++; paint(); setTimeout(step, 22 + Math.random() * 38);
    }
    paint(); setTimeout(step, 600);
    typing = true;
  });
  if (!typing) startExample();

  // ---- the example: two ascii.rest pieces ------------------------------------------------------
  // The page ships frame 0 of both as text. Here they start playing; with reduced motion they stay as shipped.
  // One typewriter at a time: the install command types first, then the example plays (when it is on screen).
  var started = false;
  function startExample() {
    if (started || !window.ASCII || reduced) return;
    started = true;
    // One clock: the terminal reports its playhead, and the chart reads the price at that moment, 500 ms a bar.
    var clock = { now: 0, drop: 0 }, W = 29, vals = [];
    for (var j = 0; j < W; j++) (function (j) {
      Object.defineProperty(vals, j, { enumerable: true, get: function () { return ASCII.priceAt(clock.now - (W - 1 - j) * 0.5, clock.drop); } });
    })(j);
    var sp = $("spark");
    ASCII.mount(sp, ASCII.pieces.sparkline, { series: [{ label: "price", values: vals, lo: 40, hi: 60, format: function (v) { return "\\u00a3" + v.toFixed(2); } }], range: false, ago: "earlier" });
    ASCII.mount($("term"), ASCII.pieces.terminal, { from: 0, sync: function (now, drop) { clock.now = now; clock.drop = drop; } });
  }

  // ---- the live check -------------------------------------------------------------------------
  var form = $("f"), url = $("url"), sel = $("sel"), selWrap = $("selwrap"), selBtn = $("selbtn"), go = $("go"), out = $("out");
  var state = $("state");
  var busy = false;
  var LABELS = { found: "Found", not_found: "No price", blocked: "Blocked", rate_limited: "Slow down",
    no_credits: "Asleep", invalid: "Check input", error: "Error" };
  function setState(s, text) { form.dataset.s = s; state.textContent = text; }
  function money(p, c) {
    try { return new Intl.NumberFormat("en", c ? { style: "currency", currency: c } : { minimumFractionDigits: 2 }).format(p); }
    catch (e) { return (c ? c + " " : "") + Number(p).toFixed(2); }
  }
  function snippet(d, u, s) {
    var o = { name: (d.title || d.host || "").slice(0, 40), url: u };
    var t = Math.floor(d.price * 0.9);
    if (t > 0) o.target = t;
    if (s) o.price = s;
    return JSON.stringify([o], null, 2);
  }
  function setSelector(open) {
    selWrap.hidden = !open;
    selBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  selBtn.addEventListener("click", function () { setSelector(selWrap.hidden); if (!selWrap.hidden) sel.focus(); });

  function render(d, asked) {
    var box = el("div", "result");
    if (d.outcome === "found") {
      box.appendChild(el("p", "host", d.title ? d.title + " \\u00b7 " + d.host : d.host));
      box.appendChild(el("p", "price", money(d.price, d.currency)));
      var bits = [];
      if (d.inStock != null) bits.push(d.inStock ? "in stock" : "out of stock");
      if (d.credits != null) bits.push(d.credits + (d.credits === 1 ? " credit" : " credits"));
      if (bits.length) box.appendChild(el("p", "meta", bits.join(" \\u00b7 ")));
      var tr = el("div", "track");
      var pre = el("pre"); pre.tabIndex = 0; var text = snippet(d, asked.url, asked.selector); pre.appendChild(el("code", null, text)); tr.appendChild(pre);
      var cb = rollBtn("btn sm roll", "Copy"); cb.dataset.copy = text; wireCopy(cb); tr.appendChild(cb);
      box.appendChild(tr);
    } else {
      box.appendChild(el("p", "note", d.message || "Try again in a moment."));
      if (d.commands) { var c = el("pre", "cmdlist"); c.tabIndex = 0; c.appendChild(el("code", null, d.commands.join("\\n"))); box.appendChild(c); }
      if (d.outcome === "not_found") setSelector(true);
    }
    out.replaceChildren(box);
  }

  document.querySelectorAll("[data-url]").forEach(function (b) {
    b.addEventListener("click", function () {
      url.value = b.dataset.url;
      sel.value = b.dataset.selector || "";
      setSelector(sel.value !== "");
      go.focus();
    });
  });

  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { form.classList.toggle("off", !es[es.length - 1].isIntersecting); }).observe(form);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    var ts = form.elements["cf-turnstile-response"]; // added by the Turnstile widget, once it has loaded; absent when it is off
    var asked = { url: url.value.trim(), selector: sel.value.trim() };
    busy = true;
    go.setAttribute("aria-disabled", "true");
    labelOf(go, "Checking");
    setState("working", "Checking");
    out.setAttribute("aria-busy", "true");
    out.replaceChildren(el("p", "sr", "Checking the page. This can take up to 45 seconds."));
    fetch("/api/price", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: asked.url, selector: asked.selector || undefined, turnstile: ts ? ts.value : undefined })
    })
      .then(function (r) { return r.json(); })
      .catch(function () { return { outcome: "error", message: "Could not reach the demo. Check your connection and try again." }; })
      .then(function (d) {
        busy = false;
        go.removeAttribute("aria-disabled");
        labelOf(go, "Check price");
        out.removeAttribute("aria-busy");
        if (ts && window.turnstile) window.turnstile.reset(); // a token works once; ts exists only when the widget is on
        setState(d.outcome === "no_credits" ? "asleep" : "idle", LABELS[d.outcome] || LABELS.error);
        render(d, asked);
        out.scrollIntoView({ block: "nearest" });
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

// Starting at 1,000 the count reads 1k, 1.2k, 12k.
export function compact(n) {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)}k`;
}

// Frame 0 of each piece, shipped as text: what a crawler, a no-script visitor and a reduced-motion visitor see.
// The sparkline's frame 0 shows the price after the drop.
const clock = { now: 0, drop: 0 };
const TERM_FRAME = terminalPiece.default({ sync: (now, drop) => Object.assign(clock, { now, drop }) })(0);
const SPARK_STILL = Array.from({ length: 29 }, (_, i) => priceAt(clock.now - (28 - i) * 0.5, clock.drop));
const SPARK_FRAME = sparklinePiece.default({
  series: [{ label: "price", values: SPARK_STILL, lo: 40, hi: 60, format: (v) => `£${v.toFixed(2)}` }],
  range: false,
  ago: "earlier",
})(0);
const ART_LABEL = "Example: a price falls from £59.00 to £44.99, and node track.mjs prints an alert.";

const ARROW = `<svg class="arr" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const MARK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
const STAR = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>`;

// A button or link label that rolls: the second copy is decorative.
const roll = (text) => `<span class="lab"><span>${text}</span><span aria-hidden="true">${text}</span></span>`;

function starButton(stars) {
  const count = stars > 0 ? `<span class="count">${STAR}<span>${compact(stars)}</span><span class="sr"> stars</span></span>` : "";
  return `<a class="gh" href="${REPO}">${MARK}<span class="full">Star on GitHub</span><span class="short">Star<span class="sr"> on GitHub</span></span>${count}</a>`;
}

const BOT = `<svg class="bot" viewBox="0 0 40 40" aria-hidden="true">
          <g class="body">
            <line class="ant" x1="20" y1="9" x2="20" y2="5"/><circle class="led" cx="20" cy="4" r="2"/>
            <rect class="ear" x="1.5" y="17" width="3.5" height="8" rx="1.75"/><rect class="ear" x="35" y="17" width="3.5" height="8" rx="1.75"/>
            <rect class="head" x="6" y="9" width="28" height="23" rx="7"/>
            <g class="eyes"><ellipse class="eye" cx="14.5" cy="20" rx="2.7" ry="3.3"/><ellipse class="eye" cx="25.5" cy="20" rx="2.7" ry="3.3"/></g>
          </g>
        </svg>`;

// The 404: the same look, the bot asleep, a way back. No script.
export function notFound() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found · Price tracker by Spicrawl</title>
<meta name="robots" content="noindex">
<meta name="color-scheme" content="dark">
${FONT_PRELOAD}
<style>${CSS}</style>
</head>
<body>
<header><div class="wrap bar"><a class="brand" href="/"><span class="mark">Spicrawl</span><span class="sep" aria-hidden="true">·</span><span class="name">Price tracker</span></a></div></header>
<main class="wrap">
  <section class="hero check" data-s="asleep" style="min-height:70svh;align-content:center">
    ${BOT.replace("<svg ", '<svg style="width:56px;height:56px" ')}
    <h1>Nothing here.</h1>
    <p class="sub">That page does not exist.</p>
    <a class="btn solid roll" href="/">${roll("Back to the tracker")}${ARROW}</a>
  </section>
</main>
</body>
</html>
`;
}

// stars: the repo's star count (a number) or null. Printed into the HTML so nothing shifts and the browser never calls GitHub.
// beaconToken: Cloudflare Web Analytics token; empty means no analytics script.
// nonce: the per-request CSP nonce for the inline script. turnstileSiteKey: set to show the Turnstile widget.
// analytics: the OpenPanel tag (openpanel.mjs), already built with the nonce; empty means none.
export function page({ beaconToken = "", nonce = "", turnstileSiteKey = "", analytics = "", stars = null } = {}) {
  const beacon = /^[\w-]+$/.test(beaconToken)
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${beaconToken}"}'></script>`
    : "";
  const turnstile = turnstileSiteKey
    ? `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";
  const widget = turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${esc(turnstileSiteKey)}" data-theme="dark"></div>` : "";
  const examples = EXAMPLES.map(
    (x) => `<button type="button" class="chipb" data-url="${esc(x.url)}" data-selector="${esc(x.selector)}">${esc(x.label)}</button>`,
  ).join("\n        ");
  const n = Number.isSafeInteger(stars) && stars > 0 ? stars : 0;
  const star = starButton(n);
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Spicrawl price tracker",
    description: DESCRIPTION,
    url: SITE,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Node.js 18 or later",
    license: "https://www.apache.org/licenses/LICENSE-2.0",
    isAccessibleForFree: true,
    sameAs: [REPO],
  }).replace(/</g, "\\u003c");
  const cliCmd = [`git clone ${REPO}`, "cd price-tracker && npm install", "export SPICRAWL_API_KEY=... && node track.mjs"];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#16181B">
<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Spicrawl">
<meta property="og:url" content="${SITE}/">
<meta property="og:title" content="${esc(TITLE)}">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta property="og:image:alt" content="price-tracker: price and stock alerts for any online store, with the output of node track.mjs">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(TITLE)}">
<meta name="twitter:description" content="${esc(DESCRIPTION)}">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2316181B'/%3E%3Ccircle cx='16' cy='16' r='7' fill='%23F9F9F9'/%3E%3C/svg%3E">
${FONT_PRELOAD}
<style>${CSS}</style>
<script type="application/ld+json">${ld}</script>
${beacon}
${analytics}
${turnstile}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header>
  <div class="wrap bar">
    <a class="brand" href="https://spicrawl.com"><span class="mark">Spicrawl</span><span class="sep" aria-hidden="true">·</span><span class="name">Price tracker</span></a>
    ${star}
  </div>
</header>
<main id="main" class="wrap">
  <section class="hero" aria-labelledby="top-h">
    <h1 id="top-h">Get alerted when a price drops.</h1>
    <p class="sub">Track product pages. Alerts in Discord, Slack or your agent.</p>

    <div class="install">
      <div class="tabs" role="tablist" aria-label="Install with">
        <button type="button" role="tab" class="roll" id="t-agent" aria-selected="true" aria-controls="p-agent">${roll("Agent")}</button>
        <button type="button" role="tab" class="roll" id="t-cli" aria-selected="false" tabindex="-1" aria-controls="p-cli">${roll("CLI")}</button>
      </div>
      <div>
        <div class="panel" role="tabpanel" id="p-agent" aria-labelledby="t-agent">
          <pre class="cmd"><span class="p" aria-hidden="true">$ </span><code data-type data-full="npx skills add OfficialSpicrawl/price-tracker" aria-hidden="true">npx skills add OfficialSpicrawl/price-tracker</code><span class="sr">npx skills add OfficialSpicrawl/price-tracker</span></pre>
          <button type="button" class="btn sm roll" data-copy="npx skills add OfficialSpicrawl/price-tracker">${roll("Copy")}</button>
        </div>
        <div class="panel" role="tabpanel" id="p-cli" aria-labelledby="t-cli" hidden>
          <pre class="cmd" style="--n:3"><code data-type data-full="${esc(cliCmd.join("\n"))}" aria-hidden="true">${esc(cliCmd.join("\n"))}</code><span class="sr">${esc(cliCmd.join("\n"))}</span></pre>
          <button type="button" class="btn sm roll" data-copy="${esc(cliCmd.join("\n"))}">${roll("Copy")}</button>
        </div>
      </div>
    </div>

    <div class="cta">
      <a class="btn solid roll" href="${KEY_URL}">${roll("Try Spicrawl free")}${ARROW}</a>
      <p class="tiny">1,000 credits a month</p>
    </div>
  </section>

  <section class="stage" aria-label="Example">
    <div class="art">
      <fieldset class="term" role="img" aria-label="${esc(ART_LABEL)}">
        <legend>price-tracker</legend>
        <pre id="spark" aria-hidden="true">${esc(SPARK_FRAME)}</pre>
        <pre id="term" aria-hidden="true">${esc(TERM_FRAME)}</pre>
      </fieldset>
    </div>
    <p class="cap">Example data</p>
  </section>

  <section class="try" aria-labelledby="try-h">
    <form id="f" class="check" data-s="idle">
      <h2 id="try-h">Try it on a real page</h2>
      <div class="state" aria-hidden="true">${BOT}<span id="state">Watching</span></div>
      <div class="row">
        <input id="url" name="url" type="url" required maxlength="2048" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://shop.example/product" aria-label="Product URL">
        <button id="go" class="btn solid roll" type="submit">${roll("Check price")}</button>
      </div>
      <div class="opts">
        ${examples}
        <button type="button" class="tbtn roll" id="selbtn" aria-expanded="false" aria-controls="selwrap" title="For pages without structured data, give the CSS selector of the price">${roll("CSS selector")}</button>
      </div>
      <div class="sel" id="selwrap" hidden>
        <input id="sel" name="selector" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder=".product .price" aria-label="CSS selector for the price">
      </div>
      ${widget}
      <div id="out" role="status" aria-live="polite"></div>
    </form>
  </section>

  <section class="close" aria-labelledby="close-h">
    <h2 id="close-h">Start free</h2>
    <a class="btn solid roll" href="${KEY_URL}">${roll("Try Spicrawl free")}${ARROW}</a>
    ${star}
  </section>
</main>
<footer>
  <div class="wrap">
    <a href="${DOCS_URL}">Docs</a>
    <a href="${SDK_URL}">SDK</a>
    <a href="${REPO}/blob/main/SKILL.md">SKILL.md</a>
    <a href="/llms.txt">llms.txt</a>
    <a href="${REPO}/blob/main/LICENSE">Apache-2.0</a>
    <a href="https://ascii.rest">ASCII by ascii.rest</a>
  </div>
</footer>
<p class="sr" id="live" role="status" aria-live="polite"></p>
<script nonce="${esc(nonce)}">${ASCII_JS}
${SCRIPT}</script>
</body>
</html>
`;
}
