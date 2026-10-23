// The beat sheet as data. Seconds on a 30 fps clock; scene code never holds a frame number.
// Narration clip lengths are MEASURED from public/audio/n*.wav (scripts/narration.sh prints them).
export const FPS = 30;

export const clip = { n1: 2.15, n2: 2.725, n3: 2.35, n4: 3.2 } as const; // seconds, Kokoro af_heart
const LEAD = 0.25; // narration starts this long after its scene

export const scene = {
  track: { start: 0, end: 6.6 },
  autoparse: { start: 6.6, end: 10.8 },
  alert: { start: 10.8, end: 15.4 },
  end: { start: 15.4, end: 19.1 },
} as const;

export const DURATION = scene.end.end;

export const narration = {
  n1: scene.track.start + LEAD,
  n2: scene.autoparse.start + LEAD,
  n3: scene.alert.start + LEAD,
  n4: scene.end.start + LEAD,
} as const;

export const captions = [
  { text: "Track prices on any shop.", ...scene.track },
  { text: "No selectors needed for most stores.", ...scene.autoparse },
  { text: "Get an alert when the price drops.", ...scene.alert },
  { text: "Free and open source. Built on Spicrawl.", ...scene.end },
] as const;

export const cue = {
  // scene 1: products.json, then `node track.mjs`
  fileLines: [0.0, 0.8], // line-by-line reveal window
  cut1: 2.6, // file view -> terminal
  type1: 2.8,
  run1: 4.25, // Enter
  out1: 4.6, // the table prints
  // scene 2: no selectors, then run
  file2: [6.6, 7.1],
  type2: 7.5,
  run2: 8.95,
  out2: 9.3,
  // scene 3: next run (example), then the chat message
  type3: 11.15,
  run3: 12.1,
  out3: 12.45,
  card: 14.25,
  // end card
  mark: 15.4,
  title: 15.7,
  url1: 16.05,
  url2: 16.3,
} as const;

export const TYPE_CPS = 12; // characters per second while typing
