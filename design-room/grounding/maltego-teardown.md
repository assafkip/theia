# Maltego — Design Teardown (grounded)

Source: `https://www.maltego.com/` (home) + `/products/maltego`.
Tokens extracted from the real shipped CSS:
`general-v3.min.css` (121 KB) + `css/v3/home.min.css` (56 KB). Every hex below
was counted in those files; frequencies noted where useful. Nothing invented.

## Stack & motion

- **Libraries (all jQuery-era, no modern motion runtime):** jQuery 3.6, Slick
  Carousel 1.8, Owl Carousel 2.3.4, Select2 4.1, jquery-validation, js-cookie,
  Cookiebot. Site JS is hand-rolled: `generic-scripts…js`, `homepage…js`,
  `header-sticky.min.js`.
- **No GSAP, Lenis, Three.js, Rive, Lottie, Webflow, Barba, Locomotive, or
  AOS.** Confirmed by grep over the home HTML — zero hits. This is a classic
  server-rendered CMS marketing site (Hugo-style hashed asset names), not a
  Webflow/React motion build.
- **JS globals / behaviors:** `owlCarousel` + `slick` (two carousel engines
  co-exist), a sticky-header shrink controller, and a scroll-triggered counter
  (`animate` + `scroll` in homepage.js).
- **Hero DOM structure:** `<section class="page-section m-hero">` → `.row` →
  `.col-12.m-hero__content` (flex column, centered) → `<h1>` with an inline
  `<span class="typed-words">` → `.get-started` (CTA button + G2 star rating +
  "200K+ users" trust line). Hero background is `background-color:#303849` plus
  **two decorative PNGs** (`/img/v3/hero/left-background-image.png` and
  `right-background-image.png`) pinned bottom-left and bottom-right at 50% size —
  faint framing graphics, not a product screenshot.
- **The one signature motion moment:** the **typewriter word-cycle** in the H1.
  A single amber phrase (`.typed-words{color:#fcb216}`) types/retypes inside the
  otherwise-static white headline "From data to intelligence — in minutes." The
  eye-catch is that one moving amber word against the dark navy. Secondary motion
  is the auto-scrolling client-logo trust carousel (FBI, Deloitte, BNP Paribas,
  European Parliament) and the header shrink on scroll.

## Color tokens

Grouped by role. Count = occurrences in shipped CSS (signal of how load-bearing).

### Background (dark)
- `#303849` (32×) — **hero navy**, the brand's dark canvas. Slightly blue-lifted
  charcoal, not pure black. Trade-off: softer/more "enterprise-trustworthy" than
  a true black, keeps the amber accent from vibrating.
- `#1d242a` (73×, the single most-used color) — **near-black ink / dark button
  fill / footer**. Cooler and darker than the hero navy; the two dark tones are
  intentionally distinct (canvas vs. object).
- `#313847` / `#323847` — near-duplicates of the hero navy used in gradients/borders.

### Surface (light)
- `#fff` (69×) + `#f7f7f7` (21×) — page and card surfaces. Warm-neutral off-white.
- `#ededed` (21×) + `#e5e5e5` (31×) — hairline/divider and disabled-button greys.
- `#efefef`, `#eee` — incidental fills. Trade-off: a very flat, low-contrast grey
  ladder — reads clean/corporate, sacrifices depth (they lean on the dark hero
  for drama instead).

### Ink (text)
- `#1d242a` — primary body/heading ink on light.
- `#5b616c` (13×) — secondary body text.
- `#757982` (8×) / `#828791` — tertiary / muted labels.
- `#999da6` (15×) — placeholder / disabled ink.
- `#c1c3c7` (29×) — **on-dark muted text** (subheads and trust line over navy).
- `#c3cfdc` (10×) — cool light-blue-grey, hover ink on dark.

### Accent (the whole brand rests on one)
- `#ffb30f` (54×) — **Maltego amber/gold**, the signature. Primary buttons,
  active carousel dots, tag hovers, link highlights. High-chroma warm gold on
  cool navy = maximum complementary pop with a single hue. Trade-off: monochrome
  accent system — confident and ownable, but nothing to fall back on for a
  second call-to-action tier.
- `#fcb216` — the typed-words amber (a hair warmer than #ffb30f; effectively the
  same accent, animation variant).
- `#ce9a11` (3×) — amber **hover/pressed** (darker gold).
- `#c8962a` / `#ce8d00` / `#9e6c00` — deeper gold shades for gradients/borders.

### Semantic
- Error red: `#d0021b` (4×) and `#dc3545` (3×, Bootstrap-red), with `#ffdbdb`
  as the light error-field background.
- Link / info blue: `#467adf`, `#5883da`, `#153069` (deep), with `#e7eeff` as a
  light info background. Blue is used sparingly — links and a few info states —
  so it never competes with the amber.
- Purple accents (`#7e53b4`, `#cac3e5`) appear only in incidental
  chart/illustration fills, not the core system.

## Type

Three real families, self-hosted display + Google body:

- **Display — `N27`** (foundry face, self-hosted `.woff2`/`.ttf` under `/fonts/`;
  only the **Regular 400** weight + italic are shipped). N27 is a neo-grotesque
  display sans. Used for large headings and the "load more" UI. It is the only
  *bespoke* type choice — everything else is off-the-shelf.
- **Body — `Roboto`** (Google, `roboto, sans-serif` — 44× the single most-common
  declaration). The workhorse for all copy, buttons, forms.
- **Also present:** `Roboto Condensed` (dense labels), `Inter` (the hero trust
  line, 14px/500), `Roboto Mono` / `monospace` (code snippets), Material Icons +
  Font Awesome 5 for glyphs.
- **Mono — `Roboto Mono`** (declared `roboto mono, monospace`).

### Real type scale (px, from shipped CSS)
`9, 10, 12, 13, 14, 15, 16, 18, 20, 21, 22, 24, 26, 28, 32, 34, 36, 38, 40, 44,
46, 48, 52, 53, 54, 64, 78`

Load-bearing steps by frequency: **16 / 15 / 18** (body), **14 / 13 / 12**
(labels), **38** (section headings), **28 / 22** (subheads), **53** (hero on
tablet), **78** (hero desktop H1).

### Weights
`300, 400, 500, 600, 700, 800, 900`. The **hero H1 is weight 300** (light) — an
unusual, deliberate choice.

### Tracking
- `.3px` (35×) — the default nudge on nearly all body/label text.
- `1px` (11×) — uppercase eyebrow/label tracking.
- `-2px` (hero 78px H1), `-1.5px` (53px), `-1px`, `-3px` — **negative tracking on
  the big display sizes only**.

### The type trade-off
Hero H1 = **78px, weight 300, letter-spacing −2px, white on navy**. Light weight
+ tight negative tracking + huge size reads as *modern, calm, editorial
authority* rather than loud/aggressive. They buy elegance and enterprise
credibility at the cost of punch — the single amber typed word does the
attention-grabbing that a heavier weight would otherwise do. Everything below the
hero snaps back to Roboto 400/500 at 15–18px with +.3px tracking (neutral,
legible, corporate).

## Spacing / radius / shadow

- **Radius ladder:** `4px` (7×, default — buttons, inputs, cards), `8px`, `12px`,
  `20px` (3×, pills/tags), then large `30 / 48 / 55px` for fully-rounded pill
  chips. Mostly tight/square (4px) — corporate, not playful.
- **Container rhythm:** max-widths step `824 → 1024 → 1224 → 1424px` across
  breakpoints (1100/1300/1601); base gutter `12px`, mobile `16px`. Hero vertical
  padding `132px 0 10%` desktop, collapsing to `100px` / `60px` on smaller.
- **Line-height rhythm (px, paired with the scale):** 22 (with 15/16 body), 26
  (18), 30, 32, 36, 46 (with 38 heading), 60 / 78 (hero). Body runs ~1.4–1.45,
  display runs 1.0 (78/78) — tight display, comfortable body.
- **Shadows (soft + one signature):**
  - `0 8px 16px rgba(0,0,0,.04)` — default card lift (barely-there).
  - `0 16px 24px rgba(0,0,0,.16)` — raised menus/dropdowns.
  - `0 2px 2px rgba(0,0,0,.16)` — small controls.
  - `10px 10px #FFB30F` — **signature hard offset amber shadow** (a solid amber
    drop, no blur) on a highlighted element. This is the one expressive,
    non-neutral shadow — brand accent used as a graphic device.
- **Transitions:** default `all .1s ease-out` (10×, very snappy), plus
  `.25s all ease`, `.3s ease-out`, `150ms linear`. No custom cubic-beziers — all
  stock easings. Fast, functional, un-fancy.

## Design decisions

- **hero_subject:** No product screenshot and no illustration in the fold. The
  subject is a **type headline** ("From data to intelligence — in minutes") on a
  dark-navy canvas, anchored by a single animated amber typed word, a G2
  star-rating badge, and a "200K+ users" trust line. Two faint decorative PNGs
  frame the lower corners.
- **composition:** **Centered, type-forward, single-column.** Focal point =
  the H1. Hierarchy: giant white headline → amber CTA button + G2/users trust
  row → auto-scrolling client-logo carousel (FBI, Deloitte, BNP Paribas, EP) as
  the credibility anchor directly beneath. No left/right split; everything stacks
  and centers.
- **art_direction_approach:** **type** (type-led + credibility-led). The design
  leans entirely on typographic scale, one bespoke display face, one amber
  accent, and social proof — not on imagery, 3D, or characters.
- **bespoke_vs_default:** **mixed.** The typographic system (self-hosted N27
  display, the 78px/300/−2px hero, the ownable amber-on-navy palette, the hard
  amber offset shadow) is deliberate and ownable. But the *scaffolding* — dual
  jQuery carousels, Select2, Bootstrap-red semantics, flat grey ladder, stock
  easings — is standard B2B-SaaS template plumbing. Custom art direction sitting
  on a conventional CMS chassis.
- **signature_motion:** the **amber typewriter word-cycle** in the hero H1 (one
  moving warm word inside a static white sentence on navy), backed by the
  auto-scrolling trust-logo carousel and a shrink-on-scroll sticky header.
