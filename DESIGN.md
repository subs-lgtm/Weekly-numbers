# Lyzr Design System — Weekly Marketing Dashboard
> Single source of truth. Reference this file before touching any UI/UX.
> Sourced directly from `lyzr_brand_guidelines_2026.txt`.

---

## Color Palette

### Primary (Brand Identity — 30% of layout)
| Name | Hex | Usage |
|------|-----|-------|
| Deep Mahogany | `#6B4C4C` | CTA buttons, logo mark, active nav, links |
| Warm Mauve | `#8A6060` | Hover states, secondary interactive |
| Near Black | `#160F0B` | Hero & dark backgrounds |
| Dark Espresso | `#1E1610` | Dark panels, footer |

### Secondary (Neutral Foundation — 60% of layout)
| Name | Hex | Usage |
|------|-----|-------|
| Warm Linen | `#EBE5DC` | Main page background |
| Cream | `#F2EDE8` | Cards, nav glass |
| Parchment | `#F9F5F1` | Hover, tag surfaces |
| Warm Border | `#D4CBC0` | Borders, dividers |

### Accent (10% — sparingly only)
| Name | Hex | Usage |
|------|-----|-------|
| Dusty Rose | `#C96A5A` | Accent, badge, CTA highlight, italic emphasis |
| Ink Deep | `#2A1F1A` | All body text on light |
| Warm Muted | `#7A6A60` | Sub-text, captions |
| Sage Green | `#4ADE80` | Live status, success |
| Burnt Sienna | `#622B0F` | Deep hover, dark accent |
| Deep Brown | `#1F0F08` | Warmest near-black alt |

### Semantic Alert Colors (status only — never decorative)
| | Hex |
|--|-----|
| INFO | `#3B82F6` |
| SUCCESS | `#16A34A` |
| WARNING | `#D97706` |
| ERROR | `#DC2626` |

### 60–30–10 Rule
- **60%** Neutral Foundation: `#EBE5DC`, `#F2EDE8`, `#F9F5F1` — backgrounds, cards, fills
- **30%** Brand Identity: `#6B4C4C`, `#8A6060`, `#1E1610` — nav, CTAs, titles
- **10%** Accents: `#C96A5A`, `#4ADE80`, `#2A1F1A` — badges, live dots, body text

### All colors must be MATTE — no glossy, no overly vibrant, no washed-out.

---

## Design Tokens

### Light Theme (default for this app)
```
--bg0:     #FFFFFF          (pure white, max readability)
--bg1:     #EBE5DC          (main page background — Warm Linen)
--bg2:     #F2EDE8          (card fills, warm panel backgrounds — Cream)
--bg3:     #F9F5F1          (hover, tag surfaces — Parchment)
--border:  #D4CBC0          (all borders and dividers)
--fg:      #2A1F1A          (all text on light — Ink Deep)
--fg2:     rgba(42,31,26,.55) (secondary text, captions)
--accent:  #6B4C4C          (links, active nav, CTAs — Deep Mahogany)
--accent2: #8A6060          (hover state for all interactive — Warm Mauve)
--rose:    #C96A5A          (Dusty Rose — badges, italic, highlights)
--green:   hsl(140,50%,38%) (live status — darker for contrast on light)
```

### Dark Theme (hero sections, showcases)
```
--bg0:     #160F0B          (page & hero background)
--bg1:     #1E1610          (dark content sections, footer)
--bg2:     #261A15          (card surfaces, panels)
--fg:      #F0E8E4          (all text on dark)
--fg2:     rgba(240,232,228,.65) (descriptions, metadata)
--accent:  #C96A5A          (CTA buttons, italic accents)
--border:  rgba(255,255,255,.07) (card borders on dark)
--green:   hsl(140,55%,50%) (live status dot — pulse 2.4s)
```

---

## Typography

### Fonts
- **Playfair Display** — headings ONLY. Weight 300 (Light) always. Letter-spacing –0.03em. Italic accent in Dusty Rose `#C96A5A`. NEVER bold.
- **DM Sans** — everything else: body, buttons, labels, captions, tables, UI. Inter as fallback.

### Type Scale (Minor Third 1.200 — Product UI)
| Level | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| H1 | 2.986rem (47.78px) | 300 | Playfair Display | Page title, one per page |
| H2 | 2.488rem (39.81px) | 300 | Playfair Display | Section headings |
| H3 | 2.074rem (33.18px) | 400 | Playfair Display | Card headings |
| H4 | 1.728rem (27.65px) | 400 | Playfair Display | Sub-section |
| Lead | 1.440rem (23.04px) | 300 | DM Sans | Intro text |
| UI Label | 1.200rem (19.20px) | 400 | DM Sans | Large body / UI label |
| Body | 1.000rem (16px) | 400 | DM Sans | Standard body copy |
| Caption | 0.833rem (13.33px) | 400 | DM Sans | Dates, metadata |
| Badge | 0.694rem (11.11px) | 700 | DM Sans | Status tags — UPPERCASE |

### Line Spacing Rules
- Headings: 115%–130% (line-height 1.15–1.30)
- Paragraphs: 130%–150% (line-height 1.30–1.50) — body uses 1.88
- All Caps: 115%–125%
- **Never letter-space body text**

### Eyebrow Labels
- 10–11px · weight 600 · DM Sans · ALWAYS UPPERCASE · letter-spacing +0.22em

### Buttons
- 13–14px · weight 500 · DM Sans · NEVER uppercase · NEVER bold · letter-spacing +0.02em

---

## Icons
- **Lucide React only** — line-art stroke, never solid fills
- `fill="none"` `stroke="currentColor"` — inherits color from context
- Stroke width: 1.5px default · 2.0px arrows · 2.2px checkmarks
- Default sizes: 14px buttons · 20px UI · 26px containers (never exceed 26px in body)
- Active/engineering highlight: `#C96A5A` Dusty Rose
- Icon container: 44×44px · radius 7px · bg `rgba(107,76,76,.12)`

---

## Background Ladder (section sequence)
```
BG-DEEPER  #160F0B  → Hero / Dark CTA        → text: white
BG-DEEP    #1E1610  → Dark Sections           → text: white
BG-BG      #EBE5DC  → Main Content            → text: #2A1F1A
BG-WARM    #E6DFD5  → Alternating sections    → text: #2A1F1A
BG-PARCH   #F9F5F1  → Soft Panels             → text: #2A1F1A
BG-CREAM   #F2EDE8  → Cards                   → text: #2A1F1A
BG-WHITE   #FFFFFF  → Modals                  → text: #2A1F1A
```

### Gradients
- Brand Hero: `linear-gradient(90deg, #6B4C4C, #C96A5A)`
- Dark Depth: `linear-gradient(180deg, #160F0B, #1E1610, #261A15)`
- Orb Glow: `radial-gradient(circle, rgba(107,76,76,.22), transparent 60%)` + blur(80–96px)

---

## Spacing Scale (always pick from this — never in-between)
| Value | Usage |
|-------|-------|
| 4px | Micro gaps — icon-to-text, badge spacing |
| 8px | Small gaps — icon inside button, badge padding |
| 12–16px | Medium — card small padding, eyebrow margin |
| 20–24px | Standard — card inner padding, stat columns |
| 28–32px | Feature & grid gaps — column gap, rule bar margin |
| 36–40px | Page wrap — horizontal padding, all content containers |
| 112px | Section padding — top & bottom of every section |
| 140px | Hero top offset — pushes below 68px fixed nav |

---

## Border Radius
| Type | Value | Usage |
|------|-------|-------|
| Standard Cards | 14–22px | Cards, modal panels, info boxes, feature blocks |
| Large Cards | 20–22px | Large cards, image frames, code windows |
| XL Panels | 28–36px | Full-width panels, extra-large section blocks |
| Pills | 9999px | All buttons, badges, chips, tags, pills, rule bars |
| Small | 6–8px | Logo box, icon container, nav logomark, inline code badge |

---

## Shadows & Elevation
| Name | CSS | Usage |
|------|-----|-------|
| Resting | `0 4px 20px rgba(40,20,10,.07)` | Nav bar on light, cards at rest |
| Elevated | `0 8px 32px rgba(40,20,10,.10)` | Sticky elements, floating panels |
| Hover | `0 8px 40px rgba(40,20,10,.13)` | Cards on hover — always with `translateY(-6px)` |
| Btn Light | `0 12px 32px rgba(107,76,76,.35)` | Primary button hover in light mode |
| Btn Dark | `0 12px 32px rgba(201,106,90,.40)` | Primary button hover in dark mode |

---

## Navigation
- Height: 68px · position: fixed · backdrop-filter: blur(48px)
- Light: `rgba(240,234,226,.97)` · Dark: `rgba(22,15,11,.88)`

## Cards — Light Mode
- bg: `rgba(255,255,255,.85)` · no border · radius: 22px
- Shadow: resting
- Hover: `translateY(-6px)` + elevated shadow

---

## WCAG 2.2 Contrast Reference
| Pairing | Ratio | Level |
|---------|-------|-------|
| White on `#160F0B` | 18.97:1 | AAA |
| `#F0E8E4` on Dark Espresso | 14.75:1 | AAA |
| `#2A1F1A` on White | 16.04:1 | AAA |
| `#2A1F1A` on Warm Linen | 12.81:1 | AAA |
| `#6B4C4C` on White | 7.60:1 | AAA |
| `#6B4C4C` on Warm Linen | 6.07:1 | AA |
| `#C96A5A` on Near Black | 5.14:1 | AA |
| `#7A6A60` on White | 5.17:1 | AA |
| `#4ADE80` on Near Black | 10.88:1 | AAA |

---

## Chart Colors (for Recharts / data viz)
Use brand palette in this order:
1. `#6B4C4C` Deep Mahogany — primary series
2. `#C96A5A` Dusty Rose — secondary series / highlight
3. `#8A6060` Warm Mauve — tertiary
4. `#4ADE80` Sage Green — positive/success series
5. `#D97706` Warning amber — caution series
6. `#7A6A60` Warm Muted — neutral/baseline series

Chart backgrounds: `#F9F5F1` (Parchment) or transparent on `#F2EDE8` (Cream)
Grid lines: `#D4CBC0` (Warm Border) at 40% opacity
Tooltip bg: `rgba(255,255,255,.95)` · border: `#D4CBC0` · shadow: resting

---

## Component Patterns

### Metric Cards (stat tiles)
- bg: `#FFFFFF` or `#F2EDE8`
- radius: 16–20px
- shadow: resting → hover elevated + translateY(-4px)
- value: Playfair Display H3 weight 400, color `#2A1F1A`
- label: DM Sans 11px weight 600 UPPERCASE letter-spacing +0.22em, color `#7A6A60`
- delta positive: `#16A34A` · delta negative: `#DC2626`
- border: 1px solid `#D4CBC0`

### Inline Edit Cells
- Idle: transparent bg, value in `#2A1F1A`
- Hover: bg `#F9F5F1`, cursor text
- Active: border 1.5px `#6B4C4C`, bg `#FFFFFF`, ring `rgba(107,76,76,.15)`
- Save confirmation: brief `#16A34A` flash

### Sidebar
- bg: `#F2EDE8` (Cream) on light
- Active item: bg `rgba(107,76,76,.10)`, text `#6B4C4C`, left border 2px `#6B4C4C`
- Hover: bg `rgba(107,76,76,.06)`
- Group labels: DM Sans 10px weight 600 UPPERCASE letter-spacing +0.22em, color `#7A6A60`

### Page Header
- bg: `rgba(242,237,232,.97)` · backdrop-blur(48px) · border-bottom: 1px `#D4CBC0`
- height: 56px (product UI, not full 68px nav)
- Title: DM Sans 15px weight 600, color `#2A1F1A`

### Buttons — Primary
- bg: `#6B4C4C` · text: `#F9F5F1` · radius: 9999px
- hover: bg `#8A6060` · shadow: `0 12px 32px rgba(107,76,76,.35)`
- 13–14px · weight 500 · never uppercase

### Buttons — Ghost/Secondary
- bg: transparent · border: 1px `#D4CBC0` · text: `#6B4C4C`
- hover: bg `#F9F5F1`

### Badges / Tags
- radius: 9999px · 9–10px · weight 700 · UPPERCASE · letter-spacing +0.16em
- Positive: bg `rgba(74,222,128,.12)` · text `#16A34A`
- Negative: bg `rgba(220,38,38,.10)` · text `#DC2626`
- Neutral: bg `#F2EDE8` · text `#7A6A60`
- Brand: bg `rgba(107,76,76,.10)` · text `#6B4C4C`

---

## Do's and Don'ts
- ✅ Warm earth tones everywhere — this is the Lyzr identity
- ✅ Playfair Display for all headings, DM Sans for everything else
- ✅ Matte finish only — no gradients on UI elements (only on hero/brand sections)
- ✅ Generous whitespace — 20–24px card padding minimum
- ✅ Thin borders — 1px `#D4CBC0`
- ✅ Lucide icons, stroke only, 1.5px weight
- ❌ Never use bold Playfair Display
- ❌ Never letter-space body text
- ❌ Never use uppercase for buttons
- ❌ Never use glossy, vibrant, or washed-out colors
- ❌ Never use colors outside the palette for decorative purposes
- ❌ Never use solid-fill icons
