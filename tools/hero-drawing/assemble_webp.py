"""Assemble the draw-in frames written by render_evidence.cjs into animated WebPs.

usage: python assemble_webp.py <evidence-dir>
reads <dir>/frames/<set>/NNN.png + timing.json, writes <dir>/draw-<set>.webp
"""
import json, sys
from pathlib import Path

from PIL import Image

root = Path(sys.argv[1])
for d in sorted((root / "frames").iterdir()):
    if not d.is_dir():
        continue
    t = json.loads((d / "timing.json").read_text())
    files = sorted(d.glob("*.png"))
    frames = [Image.open(f).convert("RGB") for f in files]
    step = round(1000 / t["fps"])
    durations = [step] * (len(frames) - 1) + [t["hold_ms"]]
    out = root / f"draw-{d.name}.webp"
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=durations, loop=0,
                   quality=82, method=6)
    print(out, len(frames), "frames", out.stat().st_size, "bytes")
