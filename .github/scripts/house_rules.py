#!/usr/bin/env python3
"""Check the built site against the mechanical rules in .github/STYLE.md.

Usage: house_rules.py SITE_DIR [JS_FILE ...]

Reads every page in SITE_DIR (visible text, alt text, aria-labels, titles and
the meta description) and the string literals in each JS_FILE.

Errors fail the run. Warnings only annotate: they cover rules with exceptions
a pattern cannot judge (serial comma, sentence case) and the sentence-pattern
lists, which apply to new copy. Quotations are third-party text and skipped.
"""
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

# ---------- rules ----------

def rx(pattern, ci=False):
    return re.compile(pattern, re.IGNORECASE if ci else 0)

# Proper names that keep their own spelling (see STYLE.md, top).
PROPER = [rx(r'FDA Modernization Act')]

IZE_ALLOWED = {'size', 'sizes', 'sized', 'sizing', 'resize', 'resized', 'prize', 'prizes',
               'prized', 'seize', 'seized', 'seizes', 'seizing', 'capsize', 'capsized'}

ERRORS = [
    (rx('—'), 'No em dashes: use a comma, a colon, brackets or a full stop'),
    (rx(r'[™®]'), 'No ™ or ® after product names'),
    # British spelling
    (rx(r'\bbehavior(s|al|ally)?\b', True), 'British spelling: behaviour'),
    (rx(r'\bcolor(s|ed|ful|ing)?\b', True), 'British spelling: colour'),
    (rx(r'\bcenter(s|ed|ing)?\b', True), 'British spelling: centre'),
    (rx(r'\bmodel(ed|ing|er|ers)\b', True), 'British spelling: modelled, modelling'),
    (rx(r'\banalyz(e|es|ed|ing|er|ers)\b', True), 'British spelling: analyse'),
    (rx(r'\bprograms?\b', True), 'British spelling: programme'),
    (rx(r'\b(favor|honor|labor|tumor)(s|ed|ing)?\b', True), 'British spelling: -our'),
    (rx(r'\b(hematolog|pediatric|anemi|leukemi|edema|estrogen|esophag)', True), 'British spelling: ae/oe forms'),
    (rx(r'\bskeptic', True), 'British spelling: sceptic'),
    (rx(r'\bgray\b', True), 'British spelling: grey'),
    # house names and terms (STYLE.md, Names and terms)
    (rx(r'\b(Zebramed|ZebraMED|Zebra Med|ZEBRAMED)\b'), 'Write ZebraMed'),
    (rx(r'\b(Xenoex|XENOEX|XenoEX|Xeno Ex)\b'), 'Write XenoEx'),
    (rx(r'\b(Fisheye|Fish-Eye|FISHEYE|Fish Eye)\b'), 'Write FishEye'),
    (rx(r'\b(Zebrachip|Zebra Chip|ZEBRACHIP)\b'), 'Write ZebraChip'),
    (rx(r'\bSystemic Atlas\b'), 'Write cross-species systemic atlas (Systemic atlas as a label)'),
    (rx(r'\bsystemic graph\b', True), 'The systemic graph is now the cross-species systemic atlas'),
    (rx(r'\bbio-foundry\b', True), 'Write biofoundry'),
    (rx(r'\blab in the loop\b', True), 'Write lab-in-the-loop'),
    (rx(r'\bmultimodal\b', True), 'Write multi-modal'),
    (rx(r'\bdeep[- ]tech\b', True), 'Write deeptech'),
    (rx(r'\bcross species\b', True), 'Write cross-species'),
    (rx(r'\bpre GLP\b'), 'Write pre-GLP'),
    (rx(r'\bin-(vitro|silico|vivo)\b', True), 'Write in vitro, in silico, in vivo (no hyphen)'),
    (rx(r'\b[Tt]op 50\b'), 'Write top-50'),
    (rx(r'\b(Dr|Prof)\.?\s+[A-Z][a-z]'), 'No honorifics before names'),
    # numbers
    (rx(r'\d\s+%'), 'Percentages without a space: 90%'),
    (rx(r'\b\d+(?:[.,]\d+)?x\b'), 'Multiples with the multiplication sign: 2×'),
    (rx(r'(?<![\w\-−–])-\d+(?:[.,]\d+)?\s?%'), 'Negative values with the minus sign: −50%'),
    (rx(r'\b(EUR|USD|GBP)\s?\d|\d\s?(EUR|USD|GBP)\b'), 'Money with the symbol: €700k, $100B'),
    # register
    (rx(r'\b(moat|secret sauce|elite|game[- ]changers?)\b', True), 'Deck register: describe instead'),
]

WARNINGS = [
    (rx(r"\b(here'?s (why|what|the thing)|the truth is|make no mistake|it'?s worth noting|at its core|"
        r"let that sink in|it turns out|let me be clear|full stop|at the end of the day|when it comes to|"
        r"in a world where|the reality is|in today'?s)\b", True), 'Throat-clearing or emphasis crutch'),
    (rx(r'\b(really|just|simply|truly|actually|genuinely|fundamentally|literally|honestly|crucially|'
        r'importantly|interestingly|inherently|inevitably|deeply)\b', True), 'Intensifier or hedge'),
    (rx(r'\b(navigat(e|es|ing)|unpack(s|ing)?|lean(s|ing)? into|landscape|deep dive|double down|'
        r'moving forward|circle back)\b', True), 'Business jargon'),
    (rx(r'(?<=[a-z,] )(Biofoundry|Zebrafish)\b'), 'Lower case mid-sentence: biofoundry, zebrafish'),
]

WH_OPENER = rx(r'^(What|When|Where|Which|Who|Why|How)\b')
SENTENCE_SPLIT = rx(r'(?<=[.!?])\s+(?=[A-Z“"‘(])')

# Words that may keep a capital inside a sentence-case heading. Names from
# _data are added at start-up.
CAPS_ALLOWED = {'ZebraMed', 'XenoEx', 'FishEye', 'ZebraChip', 'Phase', 'I', 'Paris', 'Basel',
                'Europe', 'European', 'French', 'English', 'LinkedIn', 'Institut', 'Imagine',
                'Pasteur', 'Sorbonne', 'Université', 'University', 'Saclay', 'Google', 'McKinsey',
                'Kaggle', 'Grandmaster', 'Run', 'Translate', 'Reason', 'Measure', 'Design',
                'Structure', 'Contact', 'Act', 'Modernization', 'Daphne', 'Koller', 'Alex',
                'Zhavoronkov', 'Biofoundry'}

HEADING_TAGS = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'title'}
HEADING_CLASSES = {'display', 'title', 'vision', 'label', 'h3', 'h4', 'btn', 'nav-link', 'select-name', 'f-head'}
BLOCK_TAGS = {'p', 'div', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside', 'ul', 'ol',
              'li', 'dl', 'dt', 'dd', 'table', 'tr', 'td', 'th', 'figure', 'figcaption', 'blockquote',
              'br', 'text', 'g', 'svg', 'form', 'label', 'option', 'select', 'summary', 'details',
              'title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button'}
SKIP_TAGS = {'script', 'style', 'code', 'pre', 'template'}
VOID_TAGS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source',
             'track', 'wbr'}


# ---------- reading the site ----------

class Segment:
    def __init__(self, text, path, line, kind):
        self.text, self.path, self.line, self.kind = text, path, line, kind  # kind: body | heading | attr


class TextCollector(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.stack = []        # (tag, skip, heading, block)
        self.buf, self.buf_line = [], None
        self.segments = []

    def _ctx(self):
        skip = any(e[1] for e in self.stack)
        heading = any(e[2] for e in self.stack)
        return skip, heading

    def _flush(self):
        text = ' '.join(''.join(self.buf).split())
        if text:
            _, heading = self._ctx()
            self.segments.append(Segment(text, self.path, self.buf_line, 'heading' if heading else 'body'))
        self.buf, self.buf_line = [], None

    def _attrs(self, tag, attrs):
        a = dict(attrs)
        skip, _ = self._ctx()
        if skip:
            return
        line = self.getpos()[0]
        for name in ('alt', 'aria-label', 'title'):
            if a.get(name):
                self.segments.append(Segment(' '.join(a[name].split()), self.path, line, 'attr'))
        if tag == 'meta' and a.get('name') == 'description' and a.get('content'):
            self.segments.append(Segment(a['content'], self.path, line, 'attr'))

    def handle_starttag(self, tag, attrs):
        classes = set((dict(attrs).get('class') or '').split())
        # links and spans run inline, unless styled as a button, a label or a heading
        block = tag in BLOCK_TAGS or (tag in ('a', 'span') and bool(classes & HEADING_CLASSES))
        if block:
            self._flush()
        self._attrs(tag, attrs)
        if tag in VOID_TAGS:
            return
        skip = tag in SKIP_TAGS or (tag == 'figure' and 'quote' in classes)
        heading = tag in HEADING_TAGS or bool(classes & HEADING_CLASSES)
        self.stack.append((tag, skip, heading, block))

    def handle_startendtag(self, tag, attrs):
        if tag in BLOCK_TAGS:
            self._flush()
        self._attrs(tag, attrs)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                if self.stack[i][3]:
                    self._flush()
                del self.stack[i:]
                break

    def handle_data(self, data):
        skip, _ = self._ctx()
        if skip or not data.strip():
            return
        if self.buf_line is None:
            self.buf_line = self.getpos()[0]
        self.buf.append(data)


JS_STRING = rx(r"""'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`""")


def js_segments(path):
    src = Path(path).read_text(encoding='utf-8')
    out = []
    for m in JS_STRING.finditer(src):
        s = next(g for g in m.groups() if g is not None)
        # prose only: two or more words, no code-like characters
        if ' ' not in s.strip() or not re.search(r'[A-Za-z]{3}', s) or re.search(r'[{};=<>]|^[.#\[]', s):
            continue
        out.append(Segment(s, path, src.count('\n', 0, m.start()) + 1, 'js'))
    return out


# ---------- finding the source line ----------

SOURCE_GLOBS = ['_data/*.yml', '_includes/**/*.html', '_layouts/*.html', '*.html', '*.md', 'assets/js/*.js']
_sources = None


def locate(seg, start, end):
    """Point an annotation at the source line that holds the text, else at the built page."""
    global _sources
    if seg.kind == 'js':
        return seg.path, seg.line
    if _sources is None:
        _sources = []
        for g in SOURCE_GLOBS:
            for p in sorted(Path('.').glob(g)):
                try:
                    _sources.append((str(p), p.read_text(encoding='utf-8').splitlines()))
                except (OSError, UnicodeDecodeError):
                    pass
    text = seg.text
    # the widest window around the match that appears verbatim in one source line
    for before, after in ((30, 30), (15, 15), (0, 20), (12, 0)):
        snippet = text[max(0, start - before):end + after].strip()
        if len(snippet) < 8:
            continue
        for path, lines in _sources:
            for i, line in enumerate(lines, 1):
                if snippet in line:
                    return path, i
    return seg.path, seg.line


# ---------- checks ----------

def strip_proper(text):
    for p in PROPER:
        text = p.sub(lambda m: ' ' * len(m.group(0)), text)
    return text


def context(text, start, end, width=40):
    a, b = max(0, start - width), min(len(text), end + width)
    return ('…' if a else '') + text[a:b] + ('…' if b < len(text) else '')


def serial_comma(sentence):
    """A comma before the final and/or of a list of three or more, where no item contains and/or."""
    for m in re.finditer(r',\s(and|or)\s', sentence):
        clause = re.split(r'[;:()]', sentence[:m.start()])[-1]
        items = clause.split(', ')
        if len(items) >= 2 and not any(re.search(r'\b(and|or)\b', it) for it in items):
            return m
    return None


def sentence_case(text):
    """The first capitalised word after the first word that is not a name, with its offset."""
    words = [(m.group(0), m.start()) for m in re.finditer(r'\S+', text)]
    first = next((i for i, (w, _) in enumerate(words) if re.search(r'[A-Za-zÀ-ÿ]', w)), None)
    if first is None:
        return None
    for i in range(first + 1, len(words)):
        w, pos = words[i]
        prev = words[i - 1][0]
        core = w.strip('“”"‘’\'()[],.;:!?·–-+&|‹›')
        if not core or not core[0].isupper() or prev.endswith((':', '·', '(', '/', '+', '&', '–', '—', '|', '.')):
            continue
        if core in CAPS_ALLOWED or sum(c.isupper() for c in core) > 1 or any(c.isdigit() for c in core):
            continue
        return core, pos
    return None


def check(seg, errors, warnings):
    """Append (segment, start, end, message, context) for each finding."""
    text = strip_proper(seg.text)

    def add(bucket, start, end, msg):
        bucket.append((seg, start, end, msg, context(seg.text, start, end)))

    for pattern, msg in ERRORS:
        for m in pattern.finditer(text):
            add(errors, m.start(), m.end(), msg)
    for m in re.finditer(r'\b([A-Za-z]+)iz(e|es|ed|ing|ation|ations|er|ers|able)\b', text):
        if m.group(0).lower() not in IZE_ALLOWED:
            add(errors, m.start(), m.end(), 'British spelling: -ise, -isation')
    if seg.kind == 'js':
        return
    for pattern, msg in WARNINGS:
        for m in pattern.finditer(text):
            add(warnings, m.start(), m.end(), msg)
    for m in re.finditer(r'\bwhole organism\b', text, re.IGNORECASE):
        if not re.search(r'\b(the|a|an|each|one)\s+$', text[:m.start()], re.IGNORECASE):
            add(warnings, m.start(), m.end(), 'Hyphenate before a noun: whole-organism data')
    if seg.kind == 'heading':
        found = sentence_case(text)
        if found:
            word, pos = found
            add(warnings, pos, pos + len(word), f'Sentence case: lower case "{word}" unless it is a name')
        return
    offset = 0
    for sentence in SENTENCE_SPLIT.split(text):
        offset = text.find(sentence, offset)
        if seg.kind == 'body' and WH_OPENER.match(sentence):
            add(warnings, offset, offset + len(sentence.split()[0]), 'Lead with the subject, not a Wh- word')
        m = serial_comma(sentence)
        if m:
            add(warnings, offset + m.start(), offset + m.end(), 'No serial comma unless an item contains "and"')


def load_names():
    """Capitalised words from the names in _data, allowed in sentence-case headings."""
    for p in Path('_data').glob('*.yml'):
        for line in p.read_text(encoding='utf-8').splitlines():
            m = re.match(r'\s*-?\s*(name|org|programme|affiliation|partner|title|source|kicker):\s*"?(.+?)"?\s*$', line)
            if m:
                CAPS_ALLOWED.update(w.strip('(),.&') for w in m.group(2).split() if w[:1].isupper())


def report(items, level):
    in_ci = bool(os.environ.get('GITHUB_ACTIONS'))
    seen = set()
    for seg, start, end, msg, ctx in items:
        path, line = locate(seg, start, end)
        key = (path, line, seg.text[start:end], msg)
        if key in seen:
            continue
        seen.add(key)
        if in_ci:
            print(f'::{level} file={path},line={line},title=House rules::{msg}: {ctx}')
        else:
            print(f'{level.upper():7} {path}:{line}  {msg}\n        {ctx}')
    return len(seen)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    site = Path(sys.argv[1])
    load_names()
    segments = []
    for page in sorted(site.rglob('*.html')):
        collector = TextCollector(str(page))
        collector.feed(page.read_text(encoding='utf-8'))
        collector.close()
        segments += collector.segments
    for js in sys.argv[2:]:
        segments += js_segments(js)
    errors, warnings = [], []
    for seg in segments:
        check(seg, errors, warnings)
    n_err = report(errors, 'error')
    n_warn = report(warnings, 'warning')
    summary = f'House rules: {n_err} errors, {n_warn} warnings in {len(segments)} text segments.'
    print(summary)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as f:
            f.write(f'### {summary}\n')
    sys.exit(1 if n_err else 0)


if __name__ == '__main__':
    main()
