#!/usr/bin/env bash
# Kokoro (af_heart) narration: one clip per caption into public/audio/. Prints each duration.
# Usage: scripts/narration.sh   (keep the captions equal to src/price-tracker/cues.ts)
set -euo pipefail
cd "$(dirname "$0")/.."
say() { uv run -q --python 3.12 --with kokoro --with soundfile python scripts/say.py af_heart "public/audio/$1.wav" "$2"; }
say n1 "Track prices on any shop."
say n2 "No selectors needed for most stores."
say n3 "Get an alert when the price drops."
say n4 "Free and open source. Built on Spicrawl."
