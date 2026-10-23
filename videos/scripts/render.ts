import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { DURATION, FPS, narration } from "../src/price-tracker/cues";

/**
 * Final render of the price-tracker film (30 fps, 1920x1080), then the deliverables.
 *
 *   bun scripts/render.ts v1
 *
 * 1. Frames: Remotion's PNG sequence (sRGB, lossless). No intermediate H.264: a 444 master read as
 *    BT.601 and re-matrixed to BT.709 came out 2-3 levels dark (ground #16181B read #141518).
 * 2. Narration: the four Kokoro clips placed on cues.ts, mixed, loudnorm to -16 LUFS (two passes).
 * 3. MP4: RGB -> BT.709 limited range in one step, yuv420p, tagged, AAC.
 * 4. GIF (960 px wide, silent, loops) from the same PNG frames.
 * Stills and the poster come from scripts/stills.ts (straight from the renderer, no YUV).
 */
const version = process.argv[2] ?? "v1";
const root = resolve(import.meta.dirname, "..");
const out = join(root, "out", "price-tracker", version);
const work = join(out, "work");
mkdirSync(work, { recursive: true });

const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
const ff = (args: string[]) => run("ffmpeg", ["-v", "error", "-y", ...args]);
const size = (file: string) => `${(statSync(file).size / 1e6).toFixed(2)} MB`;

// 1. frames
const frames = join(work, "frames");
run("npx", ["remotion", "render", "src/index.ts", "PriceTracker", frames, "--sequence", "--image-format", "png", "--concurrency", "6", "--log", "error"]);

// 2. narration
const clips = (["n1", "n2", "n3", "n4"] as const).map((id) => ({ file: join(root, "public/audio", `${id}.wav`), at: narration[id] }));
const mix =
  clips.map((c, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`).join(";") +
  `;${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,apad=whole_dur=${DURATION},atrim=0:${DURATION}[mix]`;
const raw = join(work, "narration-raw.wav");
ff([...clips.flatMap((c) => ["-i", c.file]), "-filter_complex", mix, "-map", "[mix]", raw]);

const target = "I=-16:TP=-1.5:LRA=11";
const pass1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", raw, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
const m = JSON.parse(pass1.stderr.slice(pass1.stderr.lastIndexOf("{")));
const narrationWav = join(work, "narration.wav");
ff(["-i", raw, "-af", `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`, "-ar", "48000", narrationWav]);
console.log(`narration: input ${m.input_i} LUFS, true peak ${m.input_tp} dBTP -> normalised to ${target}`);

// 3. mp4 (BT.709 limited range, tagged), AAC
const mp4 = join(out, "price-tracker.mp4");
ff([
  "-framerate", String(FPS), "-pattern_type", "glob", "-i", join(frames, "element-*.png"), "-i", narrationWav,
  "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p",
  "-r", String(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "16",
  "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709",
  "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
  "-c:a", "aac", "-b:a", "192k", "-t", String(DURATION), "-movflags", "+faststart", mp4,
]);

// 4. gif: silent, 960 px wide, loops forever (-loop 0). Built from the PNG frames, not the MP4, so the
//    palette starts from the exact ground colour. Full-frame palette stats keep the ground exact.
const gif = join(out, "price-tracker.gif");
ff([
  "-framerate", String(FPS), "-pattern_type", "glob", "-i", join(frames, "element-*.png"),
  "-vf", "fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
  "-loop", "0", gif,
]);

copyFileSync(narrationWav, join(out, "narration.wav"));
rmSync(work, { recursive: true, force: true });
console.log(`price-tracker.mp4: ${size(mp4)}\nprice-tracker.gif: ${size(gif)}`);
