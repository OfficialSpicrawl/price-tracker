"""Verify the price-tracker film deliverables.

    uv run -q --with numpy python3 scripts/verify.py out/price-tracker/v1

Derived from product-film's verify.py, adapted: 30 fps, a ground probe at a corner (the frame centre
is inside the terminal card), audio presence, loudness and the GIF.
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np

W, H = 1920, 1080
GROUND = np.array([0x16, 0x18, 0x1B])  # #16181B
CARD = np.array([0x1E, 0x21, 0x24])  # #1E2124
CORNER = (40, 40)  # x, y: ground, clear of every element at frame 0
CARD_PROBE = (200, 330)  # inside the products.json window at frame 0 (card)
MIN_S, MAX_S = 15.0, 20.0


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)


def probe(path):
    out = sh("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)).stdout
    return json.loads(out)


def frame(path, index, width=W, height=H, honest=True):
    """Decode one frame to RGB. `honest` spells out BT.709 limited range, as a player would read it."""
    vf = f"select=eq(n\\,{index})"
    if honest:
        vf = "scale=in_range=tv:in_color_matrix=bt709:out_range=pc," + vf
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-vf", vf, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, np.uint8).reshape(height, width, 3).astype(int)


def lufs(path):
    r = sh("ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-")
    tail = r.stderr[r.stderr.rfind("Summary:") :]
    i = tail.split("I:")[1].split("LUFS")[0].strip()
    p = tail.split("Peak:")[1].split("dBFS")[0].strip()
    return float(i), float(p)


def main():
    folder = Path(sys.argv[1])
    ok_all = True

    def report(label, ok, detail):
        nonlocal ok_all
        ok_all &= bool(ok)
        print(f"  [{'ok' if ok else 'FAIL'}] {label}: {detail}")

    mp4 = folder / "price-tracker.mp4"
    info = probe(mp4)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = [s for s in info["streams"] if s["codec_type"] == "audio"]
    dur = float(info["format"]["duration"])
    print(mp4)
    report("duration", MIN_S <= dur <= MAX_S, f"{dur:.3f} s (brief 15-20 s)")
    report("video", v["codec_name"] == "h264" and (v["width"], v["height"]) == (W, H), f"{v['codec_name']} {v['width']}x{v['height']} {v['pix_fmt']} {v['r_frame_rate']} fps")
    report("colour tags", v.get("color_space") == "bt709" and v.get("color_range") == "tv", f"space={v.get('color_space')} range={v.get('color_range')}")
    report("audio present", len(a) == 1 and a[0]["codec_name"] == "aac", f"{a[0]['codec_name']} {a[0].get('sample_rate')} Hz, {float(a[0]['duration']):.3f} s" if a else "NO AUDIO STREAM")
    i, p = lufs(mp4)
    report("loudness", abs(i + 16) <= 1.5 and p <= -1.0, f"{i:.1f} LUFS integrated, sample peak {p:.1f} dBFS (target -16 LUFS)")

    f0 = frame(mp4, 0)
    ground = f0[CORNER[1], CORNER[0]]
    report("frame 0 ground", np.all(np.abs(ground - GROUND) <= 2), f"{ground.tolist()} vs #16181B {GROUND.tolist()}")
    card = f0[CARD_PROBE[1], CARD_PROBE[0]]
    report("frame 0 card", np.all(np.abs(card - CARD) <= 2), f"{card.tolist()} vs #1E2124 {CARD.tolist()}")
    naive = frame(mp4, 0, honest=False)[CORNER[1], CORNER[0]]
    print(f"      (a player that ignores the tags reads the corner as {naive.tolist()})")

    gif = folder / "price-tracker.gif"
    gi = probe(gif)
    gv = gi["streams"][0]
    mb = gif.stat().st_size / 1e6
    report("gif", gv["width"] == 960 and mb <= 8 and not [s for s in gi["streams"] if s["codec_type"] == "audio"], f"{gv['width']}x{gv['height']}, {mb:.2f} MB (limit 8), silent")
    loop = gif.read_bytes()
    report("gif loops", b"NETSCAPE2.0" in loop, "NETSCAPE2.0 loop extension present")
    g0 = np.frombuffer(
        subprocess.run(["ffmpeg", "-v", "error", "-i", str(gif), "-frames:v", "1", "-vf", "scale=960:540", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout,
        np.uint8,
    ).reshape(540, 960, 3).astype(int)[20, 20]
    report("gif ground", np.all(np.abs(g0 - GROUND) <= 3), f"{g0.tolist()} vs {GROUND.tolist()}")

    poster = folder / "poster.png"
    if poster.exists():
        pr = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(poster), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout, np.uint8).reshape(H, W, 3).astype(int)[CORNER[1], CORNER[0]]
        report("poster ground", np.all(np.abs(pr - GROUND) <= 1), f"{pr.tolist()}")
    sys.exit(0 if ok_all else 1)


if __name__ == "__main__":
    main()
