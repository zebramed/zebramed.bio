#!/usr/bin/env python3
"""Keep internal material out of the repository and the published site.

Usage: guard.py SITE_DIR

Fails when:
- a tracked file sits under docs/ outside docs/preview/ (internal notes stay
  untracked; the repository is public);
- the built site contains anything from docs/;
- a term listed in the CONFIDENTIAL_TERMS secret (one per line) appears in a
  tracked file's name or text, or in the built site. The terms live only in
  the secret, so this file never names them.
"""
import os
import subprocess
import sys
from pathlib import Path

TEXT_SUFFIXES = {'.html', '.xml', '.json', '.txt', '.js', '.mjs', '.cjs', '.css', '.scss', '.md',
                 '.yml', '.yaml', '.svg', '.py', '.sh'}


def tracked_files():
    out = subprocess.run(['git', 'ls-files', '-z'], capture_output=True, check=True).stdout
    return [p for p in out.decode().split('\0') if p]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    site = Path(sys.argv[1])
    in_ci = bool(os.environ.get('GITHUB_ACTIONS'))
    problems = []

    files = tracked_files()
    for f in files:
        if f.startswith('docs/') and not f.startswith('docs/preview/'):
            problems.append((f, 'Internal document tracked in a public repository'))
    if (site / 'docs').exists():
        problems.append(('_site/docs', 'The built site contains docs/'))

    terms = [t.strip().lower() for t in os.environ.get('CONFIDENTIAL_TERMS', '').splitlines() if t.strip()]
    if terms:
        targets = [Path(f) for f in files] + [p for p in site.rglob('*') if p.is_file()]
        for p in targets:
            hay = str(p).lower()
            if p.suffix.lower() in TEXT_SUFFIXES and p.is_file():
                try:
                    hay += '\n' + p.read_text(encoding='utf-8', errors='ignore').lower()
                except OSError:
                    pass
            for i, t in enumerate(terms, 1):
                if t in hay:
                    problems.append((str(p), f'Confidential term #{i} from CONFIDENTIAL_TERMS appears here'))
    else:
        print('CONFIDENTIAL_TERMS is not set: skipping the term scan.')

    for path, msg in problems:
        print(f'::error file={path},title=Confidentiality::{msg}' if in_ci else f'ERROR   {path}  {msg}')
    print(f'Confidentiality: {len(problems)} problems.')
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
