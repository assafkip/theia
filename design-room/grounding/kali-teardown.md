# Kali.org — Design Teardown (grounded)

Reference: https://www.kali.org/ (home), /get-kali/, /docs/
Method: curled HTML + `style.min.css` + `index.min.css`, grepped tokens, read hero DOM + inline `:root`. All hexes below are REAL values pulled from the shipped CSS/HTML. WebFetch's vision model misread the page (hallucinated a laptop-screenshot hero) — the DOM/CSS is authoritative and used here instead.

---

## Stack & motion

- **Generator:** No `<meta generator>` emitted (stripped), but the shape is classic **Hugo** static build — minified `style.min.css` / `index.min.css` / `index.min.js` / `script.min.js` each cache-busted with `?ver=<md5>`. Fully static HTML, no hydration.
- **Libraries:** None. JS is hand-rolled vanilla with `$` / `$$` = `querySelector` / `querySelectorAll` shims. No jQuery, GSAP, Swiper, AOS, Lottie, Three. The only "framework" is a `setInterval` carousel + drag-to-scroll + a few hover toggles. **Largely static site.**
- **Fonts:** self/Google **Noto Sans** only (`--font-family:Noto Sans`, fallback Cantarell → sans-serif). Icon font **Themify** (`ti-*` classes) for nav/inline icons.
- **Hero DOM:** `<header class=bg-cover>` is full-bleed, `min-height:100vh`, background = photo `home-banner.jpg` (`background-size:cover`) under a solid dark-blue tint `.bg-cover::before { background:#143162 }`. Inside: `#banner` flex-row splitting `#banner-logo` (the **Kali dragon icon SVG**, `kali-dragon-icon.svg`, `background-size:auto 410px`, blue `drop-shadow(20px 20px 20px #153f86)`) on the left, and `#banner-text` (H1 + subhead + two pill CTAs: `Download`, `Documentation`) on the right. A bouncing `#down-arrow` sits at bottom-center.
- **Signature motion:** (1) the `#down-arrow` chevron `animation: bounce 1s cubic-bezier(.5,.05,1,.5) infinite alternate`; (2) CTA hover `transform: translateY(2px) scaleY(.95)` — a tactile "press-down" squish; (3) the auto-advancing partner/highlights carousel. Everything else is static. No parallax, no scroll-scrub.

---

## Color tokens

Defined once in an inline `:root` block on the home page, using the native CSS **`light-dark()`** function — the site is genuinely dual-theme (follows OS `color-scheme`), not a class toggle.

### Core (theme-aware)
| Token | Light | Dark | Why / trade-off |
|---|---|---|---|
| `--primary-color` | `#367BF0` | `#367BF0` | Brand blue, same in both themes. The single accent — links, buttons, focus, ::selection. Confident mono-accent choice. |
| `--body-color` (bg) | `#f9f9f9` | `#010409` | Dark bg is near-black GitHub-dark (`#010409`), not navy — lets the blue/purple pop. Trade: very high contrast, slightly harsh. |
| `--white-color` (surface) | `#ffffff` | `#16171d` | Card/nav surface. Dark surface `#16171d` sits just above the `#010409` bg for subtle elevation without borders. |
| `--text-color` (body ink) | `#636363` | `#eeeeec` | Mid-grey body on light; warm off-white on dark. `#636363` is soft (not pure black) — calmer long-form reading. |
| `--text-color-dark` (heading ink) | `#242738` | `white` | Headings get a near-black desaturated navy `#242738` on light for weight. |

### Brand accents (fixed, theme-independent)
| Token | Hex | Role |
|---|---|---|
| `--color-kali-blue` | `#2777ff` | Deeper "Kali blue" than primary; brand/marketing blue. |
| `--color-kali-purple` | `#a400a4` | The magenta-purple half of the dragon identity. Second brand hue. |

### Hero-specific (in `index.min.css`)
| Value | Role / trade-off |
|---|---|
| `#143162` | Hero photo **overlay tint** — dark cobalt, unifies the busy banner photo so white type stays legible. |
| `#153f86` | Dragon-logo `drop-shadow` — mid-blue glow lifts the SVG off the dark banner. |
| `#fea44c` / `#FEA44C` | **Download CTA accent = warm orange.** Ghost button (transparent, `inset 0 0 0 .15em #FEA44C` ring), fills orange on hover. The one non-blue accent — draws the eye to the primary action against an all-blue field. Smart contrast play. |
| `#563719` | Brown drop-shadow under the orange CTA (`0 2px 20px #563719`). |
| `#1b51ad` | Blue glow under the secondary Documentation CTA. |
| `#563719` / `#153f86` | warm-vs-cool shadow pairing separates primary (warm) from secondary (cool) CTA. |

### Semantic / category palette (`style.min.css`, icon + tag set)
Bright saturated set used for inline icons / category chips, not core UI:
`#ffc730` (amber) · `#fea44c` (orange) · `#cd5c81` / `#bf2e5e` (pink/rose) · `#962ac3` (purple) · `#5ebdab` / `#47d4b9` (teal) · `#49aee6` / `#05a1f7` (cyan/azure) · `#198388` (deep teal) · `#1c1822` (near-black ink). Plus greys `#ddd #ccc #888 #4c4f5c`.

### Neutrals via rgba (not hex)
Borders/dividers are theme-agnostic **`rgba(127,127,127,.075–.4)`** (grey-on-either-theme trick — works in both light and dark without a variable). Overlays `rgba(0,0,0,.1–.5)`.

---

## Type

- **Family:** `Noto Sans` (Google/Monotype open-source humanist sans — an intentional "libre/no-license" choice that fits an open-source distro) → `Cantarell` → `sans-serif`. No separate display face; Noto Sans carries hero + body. `monospace` (system) for code. Icon font: `Themify`.
- **Weights:** only **400** and **700**. No 300/500/600. Lean loadout.
- **Hero headline uses weight 400, not bold** — `#banner-text h1 { font-size:35px; font-weight:400 }`. There is a larger `56px/700` variant in the DOM but it's `display:none` (A/B leftover). So the shipped hero H1 is **35px regular**, subhead **19px**, line-height 1.8. Trade: a lighter, less shouty hero than typical — reads as calm/technical rather than marketing-loud.
- **Real type scale (px), observed:** `10, 12, 13, 14, 15, 16, 17.4, 18, 19, 20, 21, 24, 25, 26, 30, 32, 35, 44, 45, 56`. Base body **16px**, content pages step 16→21. Not a strict modular ratio — pragmatic/hand-tuned, roughly ~1.25 between major steps.
- **Line-height:** body `1.8` (generous, long-doc friendly), headings `1.2–1.4`.
- **Tracking:** default `normal` everywhere except one uppercase-label use at `letter-spacing:.2em`. No global tracking system.

---

## Spacing / radius / shadow

- **Spacing vars:** `--margins:30px`, `--nav-height:70px`, `--sidebar-width:250px`. Grid rhythm hangs off 30px gutters; section paddings in the 40–80px range (hero text `padding:80px 0; margin:0 60px`). Docs grid uses `calc(33.33vw - 32px)` thirds.
- **Radius:** `--border-radius: 6px` is the base token. Also seen: `4px`, `5px`, `999px` (pills / nav), `50%`–`100%` (avatars/dots), `.43em` (CTA buttons, em-relative so they scale with text). Soft, not sharp; not heavily rounded.
- **Shadow (real values):**
  - Elevation cards: `0 4px 20px rgba(0,0,0,.2)`, `0 14px 25px rgba(0,0,0,.1)`, `0 3px 15px rgba(127,127,127,.3)`.
  - Hero header: `box-shadow: 0 0 20px rgba(0,0,0,.5), inset 0 -8px rgba(0,0,0,.3)` (the inset bottom line grounds the banner).
  - Signature dragon glow: `filter: drop-shadow(20px 20px 20px #153f86)` — colored, offset, big-blur → the logo floats.
  - Accent-glow buttons: `0 30px 80px var(--primary-color)` and `0 0 10px #FEA44C` (colored shadows, not just black) — a recurring "neon lift" motif.
- **Transitions:** short + easy. `transform .1s–.2s linear`, `box-shadow .4s`, compound CTA `box-shadow .4s, transform .2s, background .4s, color .4s`, `max-height .6s` (accordions), `visibility 0s, opacity .3s ease` (fades). No spring libs, all CSS ease/linear.

---

## Design decisions

- **hero_subject:** The **Kali dragon icon** (`kali-dragon-icon.svg`, ~410px tall, blue drop-shadow) — a mascot/character mark, paired with a lighter-weight white headline. Set over a full-viewport dark-cobalt photographic banner (`home-banner.jpg` + `#143162` tint).
- **composition:** Full-bleed 100vh hero, **left dragon / right text** flex split, centered as a unit. Focal point = the glowing dragon; hierarchy: dragon + 35px H1 → 19px subhead → orange primary CTA (warm) vs blue secondary CTA (cool). Bouncing down-arrow invites scroll.
- **art_direction_approach:** **character** (dragon mascot) layered over a **photo** background — mascot-led, not type-led. Call it character-primary.
- **bespoke_vs_default:** **bespoke.** Custom single-accent theme system built on native `light-dark()`, colored drop-shadows, the proprietary dragon SVG, hand-rolled vanilla JS, and a warm-orange CTA deliberately breaking the all-blue field. Not a template.
- **signature motion:** the infinite `bounce` down-chevron (`cubic-bezier(.5,.05,1,.5)`), plus CTA "press-down" `translateY(2px) scaleY(.95)` squish on hover, and colored neon-glow shadows on interactive elements. Otherwise static.
