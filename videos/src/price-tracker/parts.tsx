import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate } from "remotion";
import { C, CELL, F, FONT, LINE, RADIUS } from "./tokens";
import type { Line, Tone } from "./data";
import { TYPE_CPS } from "./cues";

export const ease = Easing.bezier(0.22, 1, 0.36, 1);
/** 0..1 between a and b seconds, eased. */
export const ramp = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** Blur-swap in/out for one beat: in over [a, a+0.4], out over [z-0.18, z]. */
export function swapStyle(t: number, a: number, z: number): CSSProperties {
  const i = ramp(t, a, a + 0.4);
  const o = ramp(t, z - 0.18, z);
  const v = i * (1 - o);
  return {
    opacity: v,
    filter: `blur(${(1 - i) * 14 + o * 10}px)`,
    translate: `0 ${(1 - i) * 22 - o * 8}px`,
    visibility: v <= 0.001 ? "hidden" : "visible",
  };
}

const TONE: Record<Tone, { color: string; weight?: number }> = {
  keyword: { color: C.keyword },
  string: { color: C.string },
  number: { color: C.number },
  flag: { color: C.flag },
  comment: { color: C.comment },
  fg: { color: C.fg },
  muted: { color: C.muted },
  bright: { color: "#FFFFFF", weight: 700 },
};

const mono: CSSProperties = {
  fontFamily: F.mono,
  fontSize: FONT,
  lineHeight: `${LINE}px`,
  height: LINE,
  whiteSpace: "pre",
  fontVariantLigatures: "none",
  fontWeight: 400,
  color: C.fg,
};

export function CodeLine({ line, hidden }: { line: Line; hidden?: boolean }) {
  return (
    <div style={{ ...mono, visibility: hidden ? "hidden" : "visible" }}>
      {line.map(([text, tone], i) => (
        <span key={i} style={{ color: TONE[tone].color, fontWeight: TONE[tone].weight }}>
          {text}
        </span>
      ))}
    </div>
  );
}

export function PlainLine({ text, tone = "fg", bold, hidden }: { text: string; tone?: Tone; bold?: boolean; hidden?: boolean }) {
  return (
    <div style={{ ...mono, visibility: hidden ? "hidden" : "visible", color: TONE[tone].color, fontWeight: bold ? 700 : 400 }}>{text || " "}</div>
  );
}

/** ALERT in the brightest weight, the rest of the sentence at foreground. */
export function AlertLine({ text, hidden }: { text: string; hidden?: boolean }) {
  return (
    <div style={{ ...mono, visibility: hidden ? "hidden" : "visible" }}>
      <span style={{ color: "#FFFFFF", fontWeight: 700 }}>ALERT</span>
      <span style={{ color: C.string }}>{text.slice(5)}</span>
    </div>
  );
}

export const Caret = ({ on }: { on: boolean }) => (
  <span style={{ display: "inline-block", width: CELL, height: FONT * 1.1, background: C.fg, verticalAlign: "text-bottom", opacity: on ? 1 : 0 }} />
);

/** Shell prompt line: `$ ` + the command typed so far + a caret (solid while typing, blinking when idle). */
export function PromptLine({ t, typeAt, cmd, done, hidden }: { t: number; typeAt: number; cmd: string; done?: boolean; hidden?: boolean }) {
  const n = Math.max(0, Math.min(cmd.length, Math.floor((t - typeAt) * TYPE_CPS)));
  const typing = t >= typeAt && n < cmd.length;
  const blink = Math.floor(t * 1.9) % 2 === 0;
  return (
    <div style={{ ...mono, visibility: hidden ? "hidden" : "visible" }}>
      <span style={{ color: C.fg, fontWeight: 700 }}>$ </span>
      <span>{cmd.slice(0, n)}</span>
      {!done && <Caret on={typing || blink} />}
    </div>
  );
}

/** The product's tag: a small outlined "example" label so illustrative output is never mistaken for real. */
export const Tag = ({ children = "example" }: { children?: ReactNode }) => (
  <span
    style={{
      fontFamily: F.mono,
      fontSize: 20,
      letterSpacing: "0.04em",
      color: C.muted,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: "3px 12px",
      lineHeight: "22px",
    }}
  >
    {children}
  </span>
);

const HEADER_H = 52;
/** Content zone under the caption band (measured: caption centre y=118). */
export const ZONE_TOP = 215;
export const ZONE_H = 820;
export const PAD = 30;

/** HeroTerminal's TerminalFrame: card ground, 1px border, a header strip (background at 40% over the card). */
export function Window({ title, width, zoom = 1, tag, children }: { title: string; width: number; zoom?: number; tag?: ReactNode; children: ReactNode }) {
  // The wrapper centres the (auto-height) window in the content zone under the caption band.
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: ZONE_TOP, height: ZONE_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width,
          scale: String(zoom),
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: RADIUS,
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            height: HEADER_H,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            background: "#1B1D20",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: "0.03em", color: C.muted }}>{title}</span>
          {tag}
        </div>
        <div style={{ padding: `${PAD}px 40px` }}>{children}</div>
      </div>
    </div>
  );
}

/** A labelled section inside a window (products.json / terminal), separated by the border colour. */
export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ margin: `${PAD}px -40px -${PAD}px`, borderTop: `1px solid ${C.border}` }}>
      <div style={{ height: 40, display: "flex", alignItems: "center", padding: "0 24px", background: "#1B1D20", borderBottom: `1px solid ${C.border}`, fontFamily: F.mono, fontSize: 18, letterSpacing: "0.03em", color: C.muted }}>
        {label}
      </div>
      <div style={{ padding: `${PAD * 0.7}px 40px` }}>{children}</div>
    </div>
  );
}
