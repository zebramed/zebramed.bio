#!/usr/bin/env python3
"""Render the Systemic backbone film (docs/preview/graph-backbone.html) to video.

    python3 docs/preview/film/export.py                 both formats, 30 fps
    python3 docs/preview/film/export.py 4x5             one format
    python3 docs/preview/film/export.py --fps 60
    python3 docs/preview/film/export.py --stills 3600,8300,15500
                                                        PNG stills at those film times (ms)

The page draws every frame itself (export mode). This script serves the
repository on 127.0.0.1, opens the page in headless Chromium, receives the
frames and encodes them with ffmpeg. Output goes next to this script:
backbone-<format>.mp4 (H.264), backbone-<format>.webm (VP9) and
backbone-<format>-poster.jpg; stills go to stills/.
"""
import argparse
import http.server
import shutil
import subprocess
import sys
import tempfile
import threading
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PAGE = "docs/preview/graph-backbone.html"
SIZES = {"16x9": (1920, 1080), "4x5": (1080, 1350)}


class Receiver(http.server.SimpleHTTPRequestHandler):
    """Serves the repository and accepts the frames the page posts back."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(url.query)
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        job = self.server.job
        if url.path == "/frame":
            index = int(query["i"][0])
            (job["dir"] / f"{index:05d}.png").write_bytes(body)
            job["count"] += 1
            if job["count"] % 60 == 0:
                print(f"  {job['count']} frames", flush=True)
        elif url.path == "/done":
            job["done"].set()
        elif url.path == "/fail":
            job["error"] = body.decode("utf-8", "replace")
            job["done"].set()
        else:
            self.send_error(404)
            return
        self.send_response(204)
        self.end_headers()


def chromium():
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        path = shutil.which(name)
        if path:
            return path
    sys.exit("Chromium or Chrome not found on PATH.")


def render(server, port, fmt, fps, times):
    """Let the page render every frame; returns the folder of PNGs."""
    width, height = SIZES[fmt]
    frames = Path(tempfile.mkdtemp(prefix=f"backbone-{fmt}-"))
    server.job = {"dir": frames, "count": 0, "done": threading.Event(), "error": None}
    query = {"export": fmt, "fps": fps}
    if times:
        query["times"] = ",".join(f"{t:g}" for t in times)
    url = f"http://127.0.0.1:{port}/{PAGE}?{urllib.parse.urlencode(query)}"
    profile = tempfile.mkdtemp(prefix="backbone-chromium-")
    browser = subprocess.Popen(
        [chromium(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
         "--no-first-run", "--no-default-browser-check", f"--user-data-dir={profile}",
         f"--window-size={width},{height}", url],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not server.job["done"].wait(timeout=1200):
            sys.exit(f"{fmt}: timed out waiting for frames ({server.job['count']} received).")
    finally:
        browser.terminate()
        try:
            browser.wait(timeout=10)
        except subprocess.TimeoutExpired:
            browser.kill()
        shutil.rmtree(profile, ignore_errors=True)
    if server.job["error"]:
        sys.exit(f"{fmt}: the page reported an error:\n{server.job['error']}")
    return frames


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def encode(fmt, fps, frames):
    pattern = str(frames / "%05d.png")
    mp4, webm, poster = (HERE / f"backbone-{fmt}{ext}" for ext in (".mp4", ".webm", "-poster.jpg"))
    ffmpeg("-framerate", str(fps), "-i", pattern, "-c:v", "libx264", "-preset", "slow", "-crf", "20",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4))
    ffmpeg("-framerate", str(fps), "-i", pattern, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36",
           "-row-mt", "1", "-pix_fmt", "yuv420p", str(webm))
    ffmpeg("-i", str(sorted(frames.glob("*.png"))[-1]), "-q:v", "3", str(poster))
    for path in (mp4, webm, poster):
        print(f"  {path.relative_to(ROOT)}  {path.stat().st_size / 1e6:.1f} MB", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("formats", nargs="*", help="16x9 and/or 4x5 (default: both)")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--stills", help="comma-separated film times in ms; writes PNGs instead of video")
    args = parser.parse_args()

    formats = args.formats or list(SIZES)
    unknown = [f for f in formats if f not in SIZES]
    if unknown:
        sys.exit(f"Unknown format: {', '.join(unknown)} (use 16x9 or 4x5)")
    times = [float(t) for t in args.stills.split(",")] if args.stills else None
    if not times and not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH.")

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Receiver)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    try:
        for fmt in formats:
            print(f"{fmt}: rendering", flush=True)
            frames = render(server, port, fmt, args.fps, times)
            if times:
                out = HERE / "stills"
                out.mkdir(exist_ok=True)
                for i, t in enumerate(times):
                    target = out / f"{fmt}-{int(t):05d}.png"
                    shutil.copy(frames / f"{i:05d}.png", target)
                    print(f"  {target.relative_to(ROOT)}", flush=True)
            else:
                print(f"{fmt}: encoding", flush=True)
                encode(fmt, args.fps, frames)
            shutil.rmtree(frames, ignore_errors=True)
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
