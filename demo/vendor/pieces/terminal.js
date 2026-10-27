// Copied from ascii.rest 0.4.0 (https://ascii.rest/terminal/), MIT, (c) 2026 bas3line. See ascii.rest.LICENSE.
// Changes: the session is price-tracker's own output (the real table and ALERT lines of track.mjs, example prices);
// no frame (the page draws the box with a CSS border, so it never renders dotted) and 52 columns by 10 rows;
// the first run is already on screen when each loop starts, and the first (and reduced-motion) frame is the finished alert;
// the alert holds for a few seconds before `clear`; a `sync(now, drop)` option reports the playhead so a second piece
// can follow it; `from` sets where play starts.
export const meta = {
    name: "terminal",
    category: "ui",
    note: "a shell session: typed commands, output, scrolling, clear",
    cols: 52,
    rows: 10,
    fps: 15,
    options: { prompt: "$", sync: null, from: null },
};
// Each command: what is typed, seconds before its output, then the output.
// A number in the output is a pause before the next line.
const SESSION = [
    [
        "node track.mjs",
        0,
        ["NAME  PRICE   CHANGE           STOCK", "Mug   £59.00  new              in stock", "Credits used: 1 (999 left this month)"],
    ],
    [
        "node track.mjs",
        1.3,
        [
            "NAME  PRICE   CHANGE           STOCK",
            "Mug   £44.99  -14.01 (-23.7%)  in stock",
            0.25,
            "ALERT Mug: price dropped £59.00 -> £44.99",
            "ALERT Mug: £44.99 is at or below your target £45.00",
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
// The example price at `tau` seconds on the terminal's clock: 59.00 from five seconds before the loop starts (the
// first run, already on screen), and after the second run prints it ticks down. Earlier than that there is no sample.
export const priceAt = (tau, drop) => (tau < -5 ? NaN : tau < drop ? 59 : tau < drop + 0.5 ? 56 : tau < drop + 1 ? 52.3 : tau < drop + 1.5 ? 48.1 : 44.99);
export default function terminal({ prompt = meta.options.prompt, sync = meta.options.sync, from = meta.options.from } = {}) {
    const { cols, rows } = meta;
    const rand = mulberry32(5);
    const head = prompt + " ";
    // Lay the session out in time once: when each prompt shows, each key lands,
    // and each output line prints. The loop ends the moment clear runs. The first run is on screen at 0.
    const steps = [];
    let at = 0.9;
    SESSION.forEach(([cmd, wait, out], n) => {
        const s = { cmd, shown: n ? at : 0, keys: [], lines: [] };
        if (n === 0) {
            for (let i = 0; i < cmd.length; i++) s.keys.push(0);
            s.enter = 0;
            for (const line of out) s.lines.push([0, line]);
        } else {
            at += 0.1 + rand() * 0.2;
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
        }
        steps.push(s);
    });
    const period = steps[steps.length - 1].enter + 0.1;
    const drop = steps[1].lines[1][0]; // when the second run prints its price row
    // Frame 0 is the finished alert: the second run's last line has just printed.
    const lastRun = steps[steps.length - 2];
    const finished = Math.max(lastRun.lines[lastRun.lines.length - 1][0] + 0.2, lastRun.lines[1][0] + 1.7); // and the chart has finished falling
    const start = typeof from === "number" ? from : finished; // `from: 0` plays the loop from its start
    const cell = (s) => (s.length > cols ? s.slice(0, cols) : s.padEnd(cols));
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
        const top = Math.max(0, lines.length + (cursor && cursor[0] === lines.length ? 1 : 0) - rows);
        // Solid while keys land, blinking once the cursor has sat still.
        const blink = (now - ref) % 1 < 0.55;
        const body = [];
        for (let r = 0; r < rows; r++) {
            const i = top + r;
            let s = cell(lines[i] ?? "");
            if (cursor && cursor[0] === i && blink && cursor[1] < cols)
                s = s.slice(0, cursor[1]) + "█" + s.slice(cursor[1] + 1);
            body.push(s);
        }
        return body.join("\n");
    };
}
