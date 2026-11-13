#!/usr/bin/env python3
"""The pull request comment for a preview: its link and the smoke test's screenshots.

Usage: preview_comment.py PREVIEW_URL SCREENSHOT_DIR > comment.md

The screenshots are published with the preview, under /_screenshots/, so the
comment shows them from there. Each page folds open to its full-page shots at
375 and 1440 wide. Reads SHA, SMOKE (the smoke job's result) and RUN_URL from
the environment. The first line marks the comment, so the next run updates it.
"""
import os
import sys
from pathlib import Path

MARKER = '<!-- preview -->'
SCALE = 0.32  # both widths shown at the same scale: 120px and 460px


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    url, shots = sys.argv[1].rstrip('/'), Path(sys.argv[2])
    sha = os.environ.get('SHA', '')[:7]
    smoke = os.environ.get('SMOKE', '')
    run = os.environ.get('RUN_URL', '')
    smoke_text = {'success': 'passed', 'failure': 'failed', 'skipped': 'skipped'}.get(smoke, smoke or 'unknown')

    out = [MARKER,
           f'**Preview** of {sha}: {url}',
           '',
           f'Production build, so pending items are left out. Smoke test: {smoke_text}'
           + (f' ([run]({run}))' if run else '') + '. Each push gets its own preview; this comment shows the latest.']

    pages = sorted({p.name.rsplit('-', 1)[0] for p in shots.glob('*.png')}, key=lambda n: (n != 'home', n))
    if pages:
        out += ['', 'Screenshots from the smoke test, full page, 375 and 1440 wide (click for full size):', '']
        for page in pages:
            imgs = []
            for width in (375, 1440):
                name = f'{page}-{width}.png'
                if (shots / name).exists():
                    src = f'{url}/_screenshots/{name}'
                    imgs.append(f'<a href="{src}"><img src="{src}" width="{round(width * SCALE)}" alt="{page} at {width}"></a>')
            out += [f'<details><summary>{page}</summary>', '', ' '.join(imgs), '', '</details>']
    else:
        out += ['', 'No screenshots: the smoke test did not produce any.']
    print('\n'.join(out))


if __name__ == '__main__':
    main()
