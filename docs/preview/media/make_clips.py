#!/usr/bin/env python3
"""Cut the experiment clips used by graph-backbone.html out of assets/videos.

    python3 docs/preview/media/make_clips.py

Crops and time windows were measured from the sources (frame differences for
cuts, a median frame for the well, the larva's bounding box for the lateral
view); change them here and run again.

imaged   phenotype1.mp4 (3840x2160, 30 fps): the lateral view, 4:1 around the
         larva (it spans x 452-3564, y 742-1284 of the image band 567-1592).
         Three views joined with crossfades, skipping the transitions at
         5.6-6.5, 10.5-11.4, 14.5-15.4, 19.9-20.5 and 23.5-24.4 s:
         raw, vessels, then brain and spinal cord into full segmentation
         (sped up 1.5x).
tracked  behaviour2.mp4 (2304x768, 160 fps): well E6, the middle of three.
         The well centre is at (405, 378) in its tile; a 500 px square keeps
         the wall and drops the corner labels. One swim bout with rest before
         and after, 4.3-8.7 s, at half speed. Desaturated: the lilac light
         would read as the figure's violet for other models.
"""
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SRC = ROOT / "assets" / "videos"

FADE = 0.4
IMAGED = {
    "source": "phenotype1.mp4",
    "crop": (3240, 810, 388, 608),          # w, h, x, y
    "size": (1280, 320),
    "segments": [(7.0, 9.6, 1.0), (16.0, 18.6, 1.0), (25.6, 33.4, 1.5)],  # start, end, speed
}
TRACKED = {
    "source": "behaviour2.mp4",
    "crop": (500, 500, 768 + 405 - 250, 378 - 250),
    "size": (480, 480),
    "window": (4.3, 8.7),
    "speed": 0.5,
}


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def encode(graph, label, source, out_base, seek=None):
    """One filter graph, two web encodes with short keyframe intervals (fast seeking for the export)."""
    inputs = (["-ss", str(seek)] if seek is not None else []) + ["-i", str(SRC / source)]
    common = ["-filter_complex", graph, "-map", label, "-an"]
    ffmpeg(*inputs, *common, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-g", "10",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out_base.with_suffix(".mp4")))
    ffmpeg(*inputs, *common, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-g", "10",
           "-row-mt", "1", "-pix_fmt", "yuv420p", str(out_base.with_suffix(".webm")))
    ffmpeg("-i", str(out_base.with_suffix(".mp4")), "-frames:v", "1", "-q:v", "3", str(out_base.with_suffix(".jpg")))


def imaged():
    c, (w, h) = IMAGED["crop"], IMAGED["size"]
    segs = IMAGED["segments"]
    parts = [f"[0:v]split={len(segs)}" + "".join(f"[s{i}]" for i in range(len(segs)))]
    lengths = []
    for i, (a, b, speed) in enumerate(segs):
        parts.append(f"[s{i}]trim={a}:{b},setpts=(PTS-STARTPTS)/{speed},"
                     f"crop={c[0]}:{c[1]}:{c[2]}:{c[3]},scale={w}:{h}:flags=lanczos,fps=30,format=yuv420p[p{i}]")
        lengths.append((b - a) / speed)
    last, offset = "p0", 0.0
    for i in range(1, len(segs)):
        offset += lengths[i - 1] - FADE
        parts.append(f"[{last}][p{i}]xfade=transition=fade:duration={FADE}:offset={offset:.3f}[x{i}]")
        last = f"x{i}"
    encode(";".join(parts), f"[{last}]", IMAGED["source"], HERE / "imaged")


def tracked():
    c, (w, h) = TRACKED["crop"], TRACKED["size"]
    a, b = TRACKED["window"]
    graph = (f"[0:v]trim=0:{b - a},setpts=(PTS-STARTPTS)/{TRACKED['speed']},"
             f"crop={c[0]}:{c[1]}:{c[2]}:{c[3]},eq=saturation=0.12,scale={w}:{h}:flags=lanczos,fps=30,format=yuv420p[out]")
    encode(graph, "[out]", TRACKED["source"], HERE / "tracked", seek=a)


def main():
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH.")
    for make in (imaged, tracked):
        make()
    for f in sorted(HERE.glob("*.*")):
        if f.suffix in (".mp4", ".webm", ".jpg"):
            print(f"{f.relative_to(ROOT)}  {f.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
