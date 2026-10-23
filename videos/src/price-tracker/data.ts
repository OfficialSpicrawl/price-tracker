// What the film shows, taken from the tool itself. Wording and layout come from ../track.mjs
// (printTable, changeText, the two ALERT lines); products.json and the real outputs come from the brief.

export type Tone = "keyword" | "string" | "number" | "flag" | "comment" | "fg" | "muted" | "bright";
export type Seg = readonly [text: string, tone: Tone];
export type Line = readonly Seg[];

const j = (s: string, tone: Tone = "comment"): Seg => [s, tone];

// ---- products.json (../products.json, verbatim) ----------------------------------------------
const product = (name: string, url: string, target?: number): Line[] => [
  [j("  {")],
  [j("    "), j('"name"', "keyword"), j(": "), j(`"${name}"`, "string"), j(",")],
  [j("    "), j('"url"', "keyword"), j(": "), j(`"${url}"`, "string"), j(",")],
  ...(target === undefined ? [] : [[j("    "), j('"target"', "keyword"), j(": "), j(String(target), "bright"), j(",")] as Line]),
  [j("    "), j('"price"', "keyword"), j(": "), j('".product_main .price_color"', "flag"), j(",")],
  [j("    "), j('"stock"', "keyword"), j(": "), j('".product_main .availability"', "flag")],
];

const withEnd = (lines: Line[], end: string): Line[] => [...lines, [j(end)]];

export const productsJson: Line[] = [
  [j("[")],
  ...withEnd(product("A Light in the Attic", "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html", 45), "  },"),
  ...withEnd(product("Tipping the Velvet", "https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html"), "  }"),
  [j("]")],
];

// Scene 2: the same shape with NO price/stock selectors (the tool then uses autoparse).
export const noSelectorsJson: Line[] = [
  [j("[")],
  [j("  {")],
  [j("    "), j('"name"', "keyword"), j(": "), j('"Allbirds Tree Runner"', "string"), j(",")],
  [j("    "), j('"url"', "keyword"), j(": "), j('"https://www.allbirds.com/products/mens-tree-runners"', "string")],
  [j("  }")],
  [j("]")],
];

// ---- track.mjs printTable, ported 1:1 --------------------------------------------------------
type Row = { name: string; price: string; change: string; stock: string; note: string };
const COLS = ["name", "price", "change", "stock", "note"] as const;

export function table(rows: Row[]): Line[] {
  const width = COLS.map((c) => Math.max(c.length, ...rows.map((r) => r[c].length)));
  const cells = (r: Record<string, string>, header: boolean): Line => {
    const segs: Seg[] = [];
    COLS.forEach((c, i) => {
      const text = i === COLS.length - 1 ? r[c] : r[c].padEnd(width[i]) + "  ";
      const changed = c === "change" && r[c] !== "new" && r[c] !== "=";
      const tone: Tone = header ? "flag" : changed ? "bright" : c === "name" || c === "price" ? "fg" : "string";
      if (text) segs.push([text, tone]);
    });
    return segs;
  };
  const head = Object.fromEntries(COLS.map((c) => [c, c.toUpperCase()]));
  return [cells(head, true), ...rows.map((r) => cells(r, false))];
}

// changeText from track.mjs: sign, absolute difference, percent of the previous price.
export function changeText(prev: number, price: number) {
  const d = price - prev;
  if (d === 0) return "=";
  const sign = d > 0 ? "+" : "-";
  return `${sign}${Math.abs(d).toFixed(2)} (${sign}${Math.abs((d / prev) * 100).toFixed(1)}%)`;
}

// Run 1: README / brief output, captured 2026-10-23.
export const run1 = table([
  { name: "A Light in the Attic", price: "£51.77", change: "new", stock: "in stock", note: "" },
  { name: "Tipping the Velvet", price: "£53.74", change: "new", stock: "in stock", note: "" },
]);
export const credits1 = "Credits used: 2 (976 left this month)";

// Autoparse run on a Shopify store (real, captured 2026-10-23).
export const runAllbirds = table([{ name: "Allbirds Tree Runner", price: "$100.00", change: "new", stock: "?", note: "" }]);

// Illustrative next run (labelled "example" on screen): the first book drops to £44.99.
export const run3 = table([
  { name: "A Light in the Attic", price: "£44.99", change: changeText(51.77, 44.99), stock: "in stock", note: "" },
  { name: "Tipping the Velvet", price: "£53.74", change: changeText(53.74, 53.74), stock: "in stock", note: "" },
]);
const URL1 = "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html";
// track.mjs: `ALERT ${name}: price dropped ${old} -> ${new} ${url}` and `... is at or below your target ${t} ${url}`
// (a drop from £51.77 to £44.99 fires both). Cut to 74 columns with an ellipsis so they fit the frame.
const COLUMNS = 74;
const cut = (s: string) => (s.length > COLUMNS ? s.slice(0, COLUMNS - 1) + "…" : s);
export const alerts3: string[] = [
  cut(`ALERT A Light in the Attic: price dropped £51.77 -> £44.99 ${URL1}`),
  cut(`ALERT A Light in the Attic: £44.99 is at or below your target £45.00 ${URL1}`),
];
