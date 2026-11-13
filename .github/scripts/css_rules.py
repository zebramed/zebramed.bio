#!/usr/bin/env python3
"""Advisory checks of the graphical rules in .github/STYLE.md (Visual style).

Usage: css_rules.py STYLESHEET

Warns on colours written outside the :root tokens, font families that do not
use the font tokens, and !important outside the reduced-motion section.
Never fails: the existing exceptions are known and listed in STYLE.md.
"""
import os
import re
import sys
from pathlib import Path

HEX = re.compile(r'#[0-9a-fA-F]{3,8}\b')
RAW_RGB = re.compile(r'rgba?\(\s*\d')
FONT_FAMILY = re.compile(r'font-family\s*:\s*([^;}]+)')
# Not brand colours: alpha masks, and translucent white or black glazes over the ground.
NEUTRAL = re.compile(r'rgba\(\s*(255,\s*255,\s*255|0,\s*0,\s*0)\s*,\s*[\d.]+\s*\)')
MASK = re.compile(r'(-webkit-)?mask(-image)?\s*:')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = sys.argv[1]
    lines = Path(path).read_text(encoding='utf-8').splitlines()
    in_ci = bool(os.environ.get('GITHUB_ACTIONS'))
    depth_root, in_root, in_font_face, in_reduced = 0, False, False, False
    warnings = []

    for n, raw in enumerate(lines, 1):
        line = re.sub(r'/\*.*?\*/', '', raw)
        if re.match(r'\s*:root\s*\{', line):
            in_root, depth_root = True, 0
        if '@font-face' in line:
            in_font_face = True
        if 'REDUCED MOTION' in raw:
            in_reduced = True
        if not in_root and not in_font_face and not MASK.search(line):
            line_colours = NEUTRAL.sub('', line)
            for m in HEX.finditer(line_colours):
                warnings.append((n, f'Colour {m.group(0)} outside the tokens: add a token in section 1'))
            if RAW_RGB.search(line_colours):
                warnings.append((n, 'Raw rgb() value: use a token (the -rgb variants work inside rgba())'))
            for m in FONT_FAMILY.finditer(line):
                if 'var(--font-family-' not in m.group(1) and m.group(1).strip() != 'inherit':
                    warnings.append((n, f'font-family {m.group(1).strip()}: use --font-family-sans or -display'))
        if '!important' in line and not in_reduced:
            warnings.append((n, '!important outside the reduced-motion section'))
        if in_root:
            depth_root += line.count('{') - line.count('}')
            if depth_root <= 0 and '}' in line:
                in_root = False
        if in_font_face and '}' in line:
            in_font_face = False

    warnings = list(dict.fromkeys(warnings))
    for n, msg in warnings:
        print(f'::warning file={path},line={n},title=Graphical rules::{msg}' if in_ci else f'WARNING {path}:{n}  {msg}')
    print(f'Graphical rules: {len(warnings)} warnings.')


if __name__ == '__main__':
    main()
