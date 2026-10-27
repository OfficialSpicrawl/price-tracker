// Copied from ascii.rest 0.4.0 (https://ascii.rest/terminal/), MIT, (c) 2026 bas3line. See ascii.rest.LICENSE.
// Changes: the session is price-tracker's own output (the real table and ALERT lines of track.mjs, example prices),
// 60 columns by 13 rows, the first (and reduced-motion) frame is the finished alert instead of the middle of a typed command,
// the alert holds for a few seconds before `clear`, and a `sync(now, drop)` option reports the playhead so a second piece can follow it.
export const meta = {
    name: "terminal",
    category: "ui",
    note: "a shell session: typed commands, output, scrolling, clear",
    cols: 60,
    rows: 13,
    fps: 20,
    options: { prompt: "$", title: "price-tracker", sync: null },
};
// Each command: what is typed, seconds before its output, then the output.
// A number in the output is a pause before the next line.
const SESSION = [
    [
        "node track.mjs",
        0.9,
        ["NAME    PRICE   CHANGE", "Widget  £59.00  new", "Credits used: 1 (999 left this month)"],
    ],
    [
        "node track.mjs",
        1.3,
        [
            "NAME    PRICE   CHANGE",
            "Widget  £44.99  -14.01 (-23.7%)",
            0.25,
            "ALERT Widget: price dropped £59.00 -> £44.99",
            "ALERT Widget: £44.99 is at or below your target £45.00",
            "Credits used: 1 (998 left this month)",
            4,
        ],
    ],
    ["clear", 0, null],
];
function mulberry32(a) {
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// The example price at `tau` seconds on the terminal's clock: 59.00 until the second run prints, then it ticks down.
export const priceAt = (tau, drop) => (tau < drop ? 59 : tau < drop + 0.5 ? 56 : tau < drop + 1 ? 52.3 : tau < drop + 1.5 ? 48.1 : 44.99);
export default function terminal({ prompt = meta.options.prompt, title = meta.options.title, sync = meta.options.sync } = {}) {
    const { cols, rows } = meta;
    const inner = cols - 4;
    const view = rows - 2;
    const rand = mulberry32(5);
    const head = prompt + " ";
    // Lay the session out in time once: when each prompt shows, each key lands,
    // and each output line prints. The loop ends the moment clear runs.
    const steps = [];
    let at = 0.2;
    for (const [cmd, wait, out] of SESSION) {
        const s = { cmd, shown: at, keys: [], lines: [] };
        at += 0.5 + rand() * 0.3;
        for (let i = 0; i < cmd.length; i++) {
            s.keys.push(at);
            at += 0.06 + rand() * 0.07 + (cmd[i] === " " ? rand() * 0.12 : 0) + (rand() < 0.04 ? 0.35 : 0);
        }
        s.enter = at + 0.12;
        at = s.enter + wait;
        for (const line of out || []) {
            if (typeof line === "number")
                at += line;
            else
                s.lines.push([(at += 0.035), line]);
        }
        at += 0.05;
        steps.push(s);
    }
    const period = steps[steps.length - 1].enter + 0.1;
    const drop = steps[1].lines[1][0]; // when the second run prints its price row
    // Frame 0 is the finished alert: the second run's last line has just printed.
    const lastRun = steps[steps.length - 2];
    const start = Math.max(lastRun.lines[lastRun.lines.length - 1][0] + 0.2, lastRun.lines[1][0] + 1.7); // and the chart has finished falling
    const cell = (s) => (s.length > inner ? s.slice(0, inner) : s.padEnd(inner));
    return (t) => {
        const now = (((t + start) % period) + period) % period;
        if (typeof sync === "function") sync(now, drop);
        const lines = [];
        let cursor = null; // [line index, column]
        let ref = 0; // the moment the cursor last moved, for the blink
        for (const s of steps) {
            if (s.shown > now)
                break;
            const typed = s.keys.filter((k) => k <= now).length;
            lines.push(head + s.cmd.slice(0, typed));
            ref = typed ? s.keys[typed - 1] : s.shown;
            if (now < s.enter) {
                cursor = [lines.length - 1, head.length + typed];
                break;
            }
            ref = s.enter;
            for (const [k, line] of s.lines) {
                if (k > now)
                    break;
                lines.push(line);
                ref = k;
            }
            // While the command runs the cursor waits at the start of the next line.
            cursor = [lines.length, 0];
        }
        const top = Math.max(0, lines.length + (cursor && cursor[0] === lines.length ? 1 : 0) - view);
        // Solid while keys land, blinking once the cursor has sat still.
        const blink = (now - ref) % 1 < 0.55;
        const body = [];
        for (let r = 0; r < view; r++) {
            const i = top + r;
            let s = cell(lines[i] ?? "");
            if (cursor && cursor[0] === i && blink && cursor[1] < inner)
                s = s.slice(0, cursor[1]) + "█" + s.slice(cursor[1] + 1);
            body.push("│ " + s + " │");
        }
        const name = title ? "─ " + title.slice(0, cols - 6) + " " : "";
        return ["╭" + (name + "─".repeat(cols)).slice(0, cols - 2) + "╮", ...body, "╰" + "─".repeat(cols - 2) + "╯"].join("\n");
    };
}
