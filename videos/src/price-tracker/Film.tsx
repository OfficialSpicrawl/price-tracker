import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, F, RADIUS } from "./tokens";
import { DURATION, captions, cue, scene } from "./cues"; // eslint-disable-line
import { alerts3, credits1, noSelectorsJson, productsJson, run1, run3, runAllbirds } from "./data";
import { AlertLine, CodeLine, PlainLine, PromptLine, Section, Tag, Window, ramp, swapStyle } from "./parts";
import { useTime } from "../kit/time";
import { TargetLog } from "../kit/debug";

const CMD = "node track.mjs";
const within = (t: number, a: number, z: number) => t >= a && t < z;
/** A line is on screen from `at` (a reserved slot before that, so nothing re-centres). */
const shown = (t: number, at: number) => t >= at;

function Caption({ t }: { t: number }) {
  return (
    <>
      {captions.map((c) => (
        <div
          key={c.text}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 78,
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: F.ui,
            fontWeight: 600,
            fontSize: 62,
            letterSpacing: "-0.01em",
            color: C.fg,
            ...swapStyle(t, c.start + 0.05, c.end),
          }}
        >
          {c.text}
        </div>
      ))}
    </>
  );
}

/** Scene 1a: products.json, lines revealed top to bottom. */
function ProductsFile({ t }: { t: number }) {
  const [a, z] = cue.fileLines;
  return (
    <Window title="products.json" width={1640}>
      {productsJson.map((line, i) => (
        <CodeLine key={i} line={line} hidden={t < a + ((z - a) * i) / productsJson.length} />
      ))}
    </Window>
  );
}

/** Scene 1b: `node track.mjs` and its table, then an idle prompt. */
function RunOne({ t }: { t: number }) {
  const out = shown(t, cue.out1);
  return (
    <Window title="terminal" width={1000} zoom={1.5}>
      <PromptLine t={t} typeAt={cue.type1} cmd={CMD} done={t >= cue.run1} />
      <PlainLine text="" />
      {run1.map((line, i) => (
        <CodeLine key={i} line={line} hidden={!out} />
      ))}
      <PlainLine text={credits1} tone="muted" hidden={!out} />
      {out ? <PromptLine t={t} typeAt={Infinity} cmd="" /> : <PlainLine text="" />}
    </Window>
  );
}

/** Scene 2: a products.json with no selectors, and a real autoparse run on a Shopify store. */
function Autoparse({ t }: { t: number }) {
  const [a, z] = cue.file2;
  const out = shown(t, cue.out2);
  return (
    <Window title="products.json" width={1200} zoom={1.15}>
      {noSelectorsJson.map((line, i) => (
        <CodeLine key={i} line={line} hidden={t < a + ((z - a) * i) / noSelectorsJson.length} />
      ))}
      <Section label="terminal">
        <PromptLine t={t} typeAt={cue.type2} cmd={CMD} done={t >= cue.run2} />
        <PlainLine text="" />
        {runAllbirds.map((line, i) => (
          <CodeLine key={i} line={line} hidden={!out} />
        ))}
        {out ? <PromptLine t={t} typeAt={Infinity} cmd="" /> : <PlainLine text="" />}
      </Section>
    </Window>
  );
}

/** Scene 3a: an illustrative next run. Tagged "example". */
function NextRun({ t }: { t: number }) {
  const out = shown(t, cue.out3);
  return (
    <Window title="terminal" width={1340} zoom={1.2} tag={<Tag>example</Tag>}>
      <PromptLine t={t} typeAt={cue.type3} cmd={CMD} done={t >= cue.run3} />
      <PlainLine text="" />
      {run3.map((line, i) => (
        <CodeLine key={i} line={line} hidden={!out} />
      ))}
      {alerts3.map((a) => (
        <AlertLine key={a} text={a} hidden={!out} />
      ))}
      {out ? <PromptLine t={t} typeAt={Infinity} cmd="" /> : <PlainLine text="" />}
    </Window>
  );
}

/** Scene 3b: the chat message (the tool posts these lines to a Discord or Slack webhook). A plain card, no app chrome. */
function AlertCard({ t }: { t: number }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 215, height: 820, display: "flex", alignItems: "center", justifyContent: "center", ...swapStyle(t, cue.card, 99) }}>
      <div style={{ width: 1340, boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS, padding: "52px 72px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: F.ui, fontWeight: 600, fontSize: 26, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>Price alert</span>
          <Tag>example</Tag>
        </div>
        <div style={{ fontFamily: F.ui, fontWeight: 600, fontSize: 68, letterSpacing: "-0.015em", color: C.fg, marginTop: 40 }}>A Light in the Attic</div>
        <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 124, letterSpacing: "-0.03em", color: "#FFFFFF", marginTop: 18, whiteSpace: "pre" }}>
          <span style={{ color: C.muted, fontWeight: 400 }}>£51.77</span>
          {" -> "}
          £44.99
        </div>
        <div style={{ fontFamily: F.ui, fontSize: 38, color: C.muted, marginTop: 34 }}>£44.99 is at or below your target £45.00</div>
      </div>
    </div>
  );
}

function EndCard({ t }: { t: number }) {
  const row = (at: number, extra = 0) => swapStyle(t, at, 99);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 215, height: 820, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={row(cue.mark)}>
        <Img src={staticFile("brand/mark-dark.svg")} style={{ width: 250, display: "block" }} />
      </div>
      <div style={{ ...row(cue.title), fontFamily: F.ui, fontWeight: 700, fontSize: 108, letterSpacing: "-0.02em", color: C.fg, marginTop: 38 }}>Price tracker</div>
      <div style={{ ...row(cue.url1), fontFamily: F.mono, fontSize: 36, color: C.fg, marginTop: 44 }}>github.com/OfficialSpicrawl/price-tracker</div>
      <div style={{ ...row(cue.url2), fontFamily: F.mono, fontSize: 36, color: C.muted, marginTop: 14 }}>price-tracker.spicrawl.com</div>
    </div>
  );
}

export function Film({ debug = false }: { debug?: boolean }) {
  const t = useTime();
  return (
    <AbsoluteFill style={{ background: C.ground, color: C.fg }}>
      <Caption t={t} />
      {within(t, 0, cue.cut1) && <ProductsFile t={t} />}
      {within(t, cue.cut1, scene.track.end) && <RunOne t={t} />}
      {within(t, scene.autoparse.start, scene.autoparse.end) && <Autoparse t={t} />}
      {within(t, scene.alert.start, cue.card) && <NextRun t={t} />}
      {within(t, cue.card, scene.alert.end) && <AlertCard t={t} />}
      {within(t, scene.end.start, DURATION + 1) && <EndCard t={t} />}
      {debug && <TargetLog />}
    </AbsoluteFill>
  );
}
