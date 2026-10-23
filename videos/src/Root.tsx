import { useState } from "react";
import { Composition, continueRender, delayRender, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import { Film } from "./price-tracker/Film";
import { DURATION, FPS } from "./price-tracker/cues";

// Fonts come from public/fonts (BRAND.md "Workspace"). Inter and JetBrains Mono are variable fonts.
const fonts = [
  { family: "Inter Variable", url: staticFile("fonts/inter-latin-wght-normal.woff2"), weight: "100 900" },
  { family: "JetBrains Mono Variable", url: staticFile("fonts/jetbrains-mono-latin-wght-normal.woff2"), weight: "100 800" },
  { family: "Righteous", url: staticFile("fonts/righteous-latin-400-normal.woff2"), weight: "400" },
];

export function Root() {
  const [handle] = useState(() => delayRender("fonts"));
  useState(() => {
    Promise.all(fonts.map((f) => loadFont(f))).then(() => continueRender(handle));
  });
  return <Composition id="PriceTracker" component={Film} durationInFrames={Math.round(DURATION * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ debug: false }} />;
}
