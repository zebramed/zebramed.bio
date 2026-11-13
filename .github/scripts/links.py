#!/usr/bin/env python3
"""Check internal links, anchors and images in the built site.

Usage: links.py SITE_DIR [HOST ...]

Every internal href, src, srcset and poster must resolve to a file the way
GitHub Pages serves it (path, path.html or path/index.html). Every #anchor
must exist on its page. Every <img> needs an alt attribute (empty is fine
for decoration). Absolute URLs on HOST (default zebramed.bio) count as
internal. Other external links are not fetched.
"""
import os
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

URL_ATTRS = {'href', 'src', 'poster', 'data-src'}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.refs, self.no_alt = set(), [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
        for key in ('id', 'name'):
            if a.get(key) and (key == 'id' or tag == 'a'):
                self.ids.add(a[key])
        for key in URL_ATTRS:
            if a.get(key):
                self.refs.append((a[key].strip(), line))
        if a.get('srcset'):
            for part in a['srcset'].split(','):
                if part.strip():
                    self.refs.append((part.strip().split()[0], line))
        if tag == 'meta' and (a.get('property') or a.get('name') or '').endswith(':image') and a.get('content'):
            self.refs.append((a['content'], line))
        if tag == 'img' and 'alt' not in a:
            self.no_alt.append((a.get('src', '?'), line))

    handle_startendtag = handle_starttag


def resolve(site, page, path):
    """The file GitHub Pages would serve for this path, or None."""
    base = site if path.startswith('/') else page.parent
    target = (base / path.lstrip('/')).resolve()
    candidates = [target / 'index.html'] if path.endswith('/') or not path else [
        target, Path(str(target) + '.html'), target / 'index.html']
    for c in candidates:
        if c.is_file() and site.resolve() in c.parents:
            return c
    return None


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    site = Path(sys.argv[1])
    hosts = set(sys.argv[2:]) or {'zebramed.bio', 'www.zebramed.bio'}
    pages = {}
    for p in sorted(site.rglob('*.html')):
        parser = Page()
        parser.feed(p.read_text(encoding='utf-8'))
        parser.close()
        pages[p.resolve()] = parser

    in_ci = bool(os.environ.get('GITHUB_ACTIONS'))
    problems = []
    for path, page in pages.items():
        rel = path.relative_to(site.resolve())
        for src, line in page.no_alt:
            problems.append((rel, line, f'<img> without an alt attribute: {src}'))
        for ref, line in page.refs:
            u = urlsplit(ref)
            if u.scheme in ('mailto', 'tel', 'data', 'javascript'):
                continue
            if u.scheme in ('http', 'https') and u.netloc not in hosts:
                continue
            if u.netloc and u.netloc not in hosts:
                continue
            target_path = unquote(u.path)
            if '{{' in ref or '{%' in ref:
                problems.append((rel, line, f'Unrendered Liquid in a link: {ref}'))
                continue
            target = path if not target_path else resolve(site, path, target_path)
            if target is None:
                problems.append((rel, line, f'Broken link: {ref}'))
                continue
            if u.fragment and target.suffix == '.html':
                ids = pages[target.resolve()].ids if target.resolve() in pages else set()
                if unquote(u.fragment) not in ids:
                    problems.append((rel, line, f'Missing anchor: {ref}'))

    for rel, line, msg in problems:
        if in_ci:
            print(f'::error file=_site/{rel},line={line},title=Links::{msg}')
        else:
            print(f'ERROR   _site/{rel}:{line}  {msg}')
    print(f'Links: {len(problems)} problems in {len(pages)} pages.')
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
