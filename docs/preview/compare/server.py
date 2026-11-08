#!/usr/bin/env python3
"""Serve two builds of zebramed.bio side by side.

The compare page runs on --port, the left build on --port+1 and the right on
--port+2, each at its own root (the site uses absolute /assets/ paths, so a
build cannot live in a subfolder). Every HTML page served gets sync.js added
on the way out, so the builds on disk stay exactly as Jekyll wrote them.
Like GitHub Pages, /page is answered with page.html when it exists.

Started by docs/preview/compare.sh; it can also be run by hand on any two
built _site folders.
"""
import argparse
import functools
import http.server
import json
import threading
import urllib.parse
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYNC_TAG = b'<script src="/__compare/sync.js"></script>'


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    """Never cached, so a rebuild shows on the next reload."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

    def send_bytes(self, body, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class SiteHandler(NoStoreHandler):
    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/__compare/sync.js":
            return self.send_bytes((HERE / "sync.js").read_bytes(), "text/javascript; charset=utf-8")
        target = Path(self.translate_path(path))
        if target.is_dir() and (target / "index.html").is_file() and path.endswith("/"):
            target = target / "index.html"
        elif not target.exists() and target.with_name(target.name + ".html").is_file():
            target = target.with_name(target.name + ".html")
        if target.suffix == ".html" and target.is_file():
            body = target.read_bytes()
            i = body.rfind(b"</body>")
            body = body[:i] + SYNC_TAG + body[i:] if i != -1 else body + SYNC_TAG
            return self.send_bytes(body, "text/html; charset=utf-8")
        return super().do_GET()


class CompareHandler(NoStoreHandler):
    config = b"null"

    def do_GET(self):
        if urllib.parse.urlsplit(self.path).path in ("/", "/index.html"):
            page = (HERE / "index.html").read_bytes().replace(b"/*CONFIG*/null", self.config)
            return self.send_bytes(page, "text/html; charset=utf-8")
        self.send_error(404)


def serve(port, handler):
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--left", required=True, help="built site folder shown on the left")
    ap.add_argument("--right", required=True, help="built site folder shown on the right")
    ap.add_argument("--left-name", default="Left")
    ap.add_argument("--right-name", default="Right")
    ap.add_argument("--left-ref", default="")
    ap.add_argument("--right-ref", default="")
    ap.add_argument("--port", type=int, default=4000)
    ap.add_argument("--no-open", action="store_true", help="do not open a browser")
    args = ap.parse_args()

    base = f"http://127.0.0.1:{args.port}"
    left_url, right_url = f"http://127.0.0.1:{args.port + 1}", f"http://127.0.0.1:{args.port + 2}"
    CompareHandler.config = json.dumps({
        "left": {"url": left_url, "name": args.left_name, "ref": args.left_ref},
        "right": {"url": right_url, "name": args.right_name, "ref": args.right_ref},
    }).encode()

    servers = [
        serve(args.port + 1, functools.partial(SiteHandler, directory=args.left)),
        serve(args.port + 2, functools.partial(SiteHandler, directory=args.right)),
        serve(args.port, CompareHandler),
    ]
    print(f"Compare:  {base}\n  left:   {left_url}  ({args.left_name})\n  right:  {right_url}  ({args.right_name})\nCtrl+C to stop.", flush=True)
    if not args.no_open:
        webbrowser.open(base)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        pass
    finally:
        for s in servers:
            s.shutdown()


if __name__ == "__main__":
    main()
