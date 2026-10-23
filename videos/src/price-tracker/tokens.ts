// Spicrawl's own theme (webora-ui/landing/src/styles/globals.css `.spicrawl-theme`), all hex so
// anything that animates can interpolate. White is the only accent; code steps are luminance.
export const C = {
  ground: "#16181B",
  card: "#1E2124",
  elevated: "#26292D",
  border: "#2E3135",
  fg: "#F9F9F9",
  accent: "#FAFAFA",
  muted: "#A9ADB2",
  // code luminance steps: keyword brightest, then string, number, flag, comment
  keyword: "#FAFAFA",
  string: "#D3D6D9",
  number: "#AEB2B7",
  flag: "#9A9EA3",
  comment: "#8A8E94",
} as const;

export const F = {
  ui: '"Inter Variable", Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace',
  wordmark: "Righteous, Inter, sans-serif",
} as const;

export const RADIUS = 10;
// measured against the rendered frames: one monospace cell at FONT px
export const FONT = 28;
export const LINE = 44;
export const CELL = FONT * 0.6;
