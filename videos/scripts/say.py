"""Kokoro TTS: say.py <voice> <out.wav> "<text>". Prints the clip duration in seconds."""
import sys

import numpy as np
import soundfile as sf
from kokoro import KPipeline

voice, out, text = sys.argv[1:4]
pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
audio = np.concatenate([np.asarray(a) for _, _, a in pipe(text, voice=voice, speed=1.0)])
sf.write(out, audio, 24000)
print(f"{out}: {len(audio) / 24000:.3f} s")
