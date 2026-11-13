# ZebraMed website style

How zebramed.bio reads and looks. These rules cover everything a visitor can see or hear: copy, figure labels, narration, alt text and screen-reader descriptions, wherever they live (`_data/*.yml`, `_includes/`, `_layouts/`, the pages or `assets/js/`).

Rules marked **(checked)** are mechanical, so CI checks them on every pull request (`.github/workflows/checks.yml`). A break fails the pull request, except for sentence case and the sentence patterns: those only raise warnings, because approved copy predates them. The rest need a reviewer. When the repository has an Anthropic or OpenAI key, a language model reads the changed copy against the rest too and leaves warnings on the lines; it never fails a pull request, and a reviewer decides.

Quotations, publication titles and proper names (programmes, companies, laws) keep their own spelling and punctuation.

This repository is public. Nothing in this file, or anywhere else in the repository, may quote internal documents.


## Readers and register

The site's readers are pharma R&D and business development teams, scientists and regulators who will test every claim, and investors. Write for the most sceptical of them.

- Describe what ZebraMed does and what it changes for a programme, in the words a pharma scientist would use. A public page that sells reads as weaker than one that describes.
- No deck register: "moat", "secret sauce", "elite", "game-changer". **(checked)**
- No ™ or ® after product names.
- The hero says what ZebraMed is in one sentence and promises an outcome.


## Voice

- ZebraMed speaks as "we" and "our", sparingly. Use "ZebraMed" when a sentence needs a clear subject.
- Address the reader as "you" when the sentence is about their programme or their assets.
- Give each sentence an actor: "XenoEx ranks the targets" rather than "the targets are ranked".


## Spelling and case

- British English: -ise and -isation, behaviour, programme, modelling, colour, centre, analyse, licence (noun). **(checked)**
- Sentence case for every heading, title, callout, button, tab, label and job title. Labels display in capitals through CSS, so write them in sentence case in the source. **(checked)**
- Product names keep their own capitals. Other terms stay in lower case (see Names and terms).


## Punctuation

- No em dashes. Use a comma, a colon, brackets or a full stop. **(checked)**
- An en dash (–) without spaces joins ranges and pairs: 24–48, Google–McKinsey.
- No serial comma: "cells cannot metabolise, clear or model a seizure". Add it only when an item in the list already contains "and", so the list stays unambiguous: "pharma R&D and business development teams, scientists and regulators, and investors".
- Cited titles take curly double quotes: “The Data Bottleneck in AI Drug Discovery”. Apostrophes are straight (').
- No ellipsis in our own copy. Inside a quotation, mark a cut with [...].


## Numbers, units and dates

- Percentages without a space: 90%. **(checked)**
- Multiples with the multiplication sign: 2×, 10×. Not 2x. **(checked)**
- Negative values with the minus sign: −50%. Not -50%. **(checked)**
- Money with the symbol before the amount and k, M or B after it: $100B, €700k+. Not EUR 700k. **(checked)**
- News dates as a three-letter month and the year: Nov 2026.


## Names and terms

| Write | Not |
|---|---|
| ZebraMed | Zebramed, ZebraMED, Zebra Med |
| XenoEx | Xenoex, XENOEX |
| FishEye ("our computer vision") | Fisheye, Fish-Eye |
| ZebraChip | Zebrachip, Zebra Chip |
| cross-species systemic atlas; "Systemic atlas" as a tab or label | Systemic Atlas, systemic graph (the old name) |
| biofoundry | bio-foundry; Biofoundry mid-sentence |
| lab-in-the-loop | lab in the loop |
| whole-organism data (before a noun); the whole organism (as a noun) | whole organism data |
| cross-species, multi-modal, pre-GLP, deeptech | cross species, multimodal, pre GLP, deep tech, deep-tech |
| in vitro, in silico, in vivo | in-vitro, in-silico |
| zebrafish | Zebrafish mid-sentence |
| a top-50 pharma company | a Top 50 pharma, top 50 pharma |

**(checked)** for the whole table.

- Step4NAM is a challenge. Name the challenge, not the company that runs it.
- Programmes and partners appear as they do in `_data/partners.yml`: HEC Paris Challenge+, Creative Destruction Lab, DayOne, Future4Care, Wilco, Spartners, i-Lab, Bpifrance, France 2030, Genopole, NVIDIA Inception, Medicen Paris Region, Région Île-de-France, Datacraft. Research partners: TEFOR (CNRS), Sorbonne ISIR, Institut Imagine.
- No honorifics before names: no Dr, no Prof. **(checked)**


## Claims, sources and clearance

- Every number on the site has a source, recorded in a comment beside it in `_data/`. A number without a source does not ship.
- An item that is unsourced or not yet cleared carries a `pending:` line in its data entry. Review builds (`jekyll serve`) show it in amber; production builds leave it out. Delete the `pending:` line only once someone has cleared the item.
- Name a client, partner or person only once they have agreed. Until then, describe them ("a top-50 pharma company") and use the generic logo. Board members appear once they have agreed.
- Nothing from internal documents (the business plan, decks, the notes in `docs/`) reaches the site until someone has cleared it.
- Figure values are illustrative. Use generic IDs such as ZM-131, never real client data, and no counts or capacities that would read as a product specification.


## Quotations

- Quote verbatim, in the source's own spelling. Mark a cut with [...].
- Bold the key line with `<b>`, once per quotation.
- Credit the speaker and give the source title in curly quotes.


## Sentence patterns

These rules come from the stop-slop rule set. They apply to new copy; approved text keeps its wording until its next copy pass.

- No throat-clearing or emphasis crutches: "here's why", "the truth is", "make no mistake", "it's worth noting", "at its core", "let that sink in". **(checked)**
- No intensifiers or hedges: really, just, simply, truly, actually, genuinely, fundamentally, literally, honestly, crucially, importantly. An adverb that carries meaning stays ("iteratively scored"). **(checked)**
- No business jargon: navigate, unpack, lean into, landscape, deep dive, double down, moving forward. **(checked)**
- No set-piece contrasts: "not X, but Y", "X isn't the problem, Y is", "not just X but also Y". State Y.
- Don't open a body sentence with What, When, Where, Which, Who, Why or How. Lead with the subject.
- Don't give inanimate things human verbs ("the data tells us"). Name who reads the data.
- Name the specific thing instead of announcing that something matters ("the implications are significant").
- Vary sentence length. Don't stack short fragments for drama, and don't pad a list to three items.
- Use every, always, never and nobody only when the claim is exact.


## Visual style

### Colour

Use the tokens in section 1 of `assets/css/main.scss`. A new colour gets a token there first, with a comment naming its role. **(checked)**

| Token | Value | Role |
|---|---|---|
| `--color-bg-dark` | #11174a | Page ground, one step under the brand navy #171F56 |
| `--color-bg-deep` | #0b1036 | Alternate bands and the footer |
| `--color-text-light` | #ffffff | Headings, callouts, names in figures |
| `--color-text-bright` | #e6f1ff | Default text |
| `--color-text-medium` | #ccd6f6 | Paragraphs, secondary text |
| `--color-accent-primary` | #64ffda, mint | Section titles, actions, the live element in a figure |
| `--color-accent-secondary` | #a8ff78, green | Labels, results, highlights, the focus ring |
| `--color-flag` | #f5b85c, amber | Exclusions, thresholds, review markers |
| `--color-heart` | #ff6b7d | The heartbeat in the hero loop and new targets in the platform film. Nothing else. |
| `--color-line` | #9fb0d0 | Structure strokes, at low opacity |
| `--color-stage` | #10153b | The platform film's stage: the halo behind its names |

- Mint-to-green gradient text appears in three places: the ZebraMed wordmark, one phrase of the hero headline and the role line on personal pages. Nowhere else.
- The platform film keeps its colour map (`COL`) in `assets/js/platform.js`. Its shared colours match the tokens. Its figure-only colours (#c3a6ff, #6cb6ff and the plate fill #12173c) stay inside the figures.

### Type

- Inter for reading and titles; Barlow for labels, navigation, buttons and numerals. No other typefaces. **(checked)**

| Class | Use |
|---|---|
| `.display` | The hero headline |
| `.title` | Section titles, in mint |
| `.vision` | The callout under a section title: white, one step below it, close to it |
| `.h3`, `.h4` | Card and item headings, in white |
| `.label` | Barlow capitals, tracked, in green |
| `.lede` | The opening paragraph of a section, 52ch at most |
| `p` | Body text, 54ch at most (about 70 characters of Inter); the platform film keeps 62ch |

- Display text, titles and callouts balance their lines (`text-wrap: balance`). Ledes avoid a lone last word (`text-wrap: pretty`).
- Compounds and names stay whole across line breaks: wrap "whole-organism" in headings in `<span class="nowrap">`, and let affiliation lists break only between names.

### Layout

- Full-width bands alternate between the page ground and the deep tone.
- Content sits in `.wrap`: 72rem wide at most, with gutters of 1rem on phones, 1.5rem from 640px and 2rem from 1024px.
- Bands have 5.5rem of vertical padding, 8rem from 768px. Section heads are centred and 48rem wide at most.
- The hero headline holds four lines or fewer on a phone.
- On phones, paired buttons stack at one width.
- Reuse an existing breakpoint before adding a new one.

### Figures

- Each section has one figure, doing one job.
- No text below about 12px as rendered on a phone. A figure that needs smaller text has too much in it.
- Line art is 1 to 1.5px: structure in the line colour at low opacity, mint for the live element, green for results and amber for flags.
- Labels never sit on a stroke. Where an edge passes, the label carries a halo in the plate colour.
- Every figure has a prose description for screen readers.
- Figures carry no "illustrative data" badge. Their values follow the rule under Claims.

### Motion

- Only figures move. Sections and text don't fade in.
- CSS and plain JavaScript only, without animation libraries.
- An animation plays while it is in view and stops once you scroll away.
- With reduced motion, a figure starts finished and steps through finished states. Nothing plays by itself.
- Without JavaScript, every figure shows a complete static version.
- Narration that runs with an animation stays on screen long enough to read, at about 3 to 4 words a second.

### Logos

- Show logos as their owners supply them: no recolouring, no greyscale filter.
- Logos sit on white, in equal tiles, three to a row, each contained in the same box. Trim built-in margins from the file instead of adjusting the tile.

### Buttons and focus

- Buttons are set in Barlow capitals, tracked: solid mint for the main action, outlined for the second.
- Every interactive element shows a 2px green outline on keyboard focus.

### Assets

- The site serves everything itself: fonts, scripts, images and video. No third-party requests.
- Video ships as MP4 and WebM with a JPEG poster.


## Pages and build

- Legal pages run in English first, with the French version below.
- `assets/css/tailwind.css` is compiled and committed. After adding a Tailwind class, run `npm run build:css`. **(checked)**
- Tailwind turns any word in a template that matches a utility into CSS, so avoid utility names as class names and in comments. The word "ring" is blocklisted in `tailwind.config.js` for this reason.
