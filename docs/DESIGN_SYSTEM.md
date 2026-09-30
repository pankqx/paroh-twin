# Paroh Design System — quiet paper-ledger look

This is the ONLY visual reference. Follow it exactly. Only content and features change.
Write every file fresh in this repo; do not copy files or code from any earlier project.

## 1. Concept and mood
- A quiet, warm, **paper-ledger** look, like a bound register or notebook. NOT a SaaS
  dashboard, NOT neon "AI".
- Calm, minimal, human. Lots of whitespace, thin 1px lines, almost no shadow, **no gradients,
  no dark mode, no icon libraries, no big illustrations, no UI kits**.
- Copy tone: friendly, plain, short. "Hey Asha, here's your week." / "Nothing waiting for
  review. Take a breath." / "Nothing here yet."
- One primary action per page. Nothing to hunt for.
- The "wow" comes from craft: typography, spacing, and ONE hero visual (the Twin Bloom) with
  slow, subtle motion.

## 2. Tech rules
- Plain CSS only (a global `styles.css` of tokens + shared classes, plus per-component CSS).
  No Tailwind, Bootstrap, shadcn, Material, Framer Motion, or chart libraries.
- Charts, heatmap, bloom and timelines are hand-written SVG/HTML + CSS transitions.
- Default framework: **Next.js (React, App Router, TypeScript)** so the frontend, API routes
  and deployment stay in one app. (Angular 17 with standalone components + signals is an
  acceptable alternative if the team decides so; the visual system is identical.)
- Mock/local data behind a `DataService` interface (see HANDOFF.md section 8).

## 3. Fonts (load via Google Fonts in the document head)
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
```
- Display / headings / big numbers / brand: **Fraunces**, fallback `Georgia, serif`.
- Body / UI / buttons / forms: **Inter**, fallback `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

## 4. Tokens (`:root`)
```css
:root {
  --ink: #23291f;          /* main text, headings */
  --ink-soft: #4b5245;     /* paragraphs, labels, table cells */
  --muted: #7a7566;        /* captions, placeholders, inactive nav */
  --paper: #f6f4ee;        /* page background */
  --paper-raised: #ffffff; /* cards, navbar, inputs */
  --line: #dcd6c6;         /* ALL borders and dividers */
  --forest: #2f5d50;       /* primary accent */
  --forest-dark: #1f4038;  /* primary hover */
  --forest-tint: #e4eee7;
  --amber: #a8752c;        /* pending / caution */
  --amber-tint: #f6ecd9;
  --rust: #a34d3d;         /* rejected / error / high risk */
  --rust-tint: #f5e2dd;

  --font-display: "Fraunces", Georgia, serif;
  --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --radius: 3px;
  --shadow-card: 0 1px 0 rgba(35, 41, 31, 0.06);
}
```
Semantic colour meaning (keep consistent everywhere):
- Green = primary action, active, approved, on track.
- Amber = pending, caution, medium risk.
- Rust = rejected, error, high risk.
Never hardcode new colours. Tints for charts may be derived with
`color-mix(in srgb, var(--forest) 25%, var(--paper-raised))` and similar.

## 5. Global styles
- `* { box-sizing: border-box }`; `html, body { height:100%; margin:0; padding:0 }`.
- `body`: background `--paper`, colour `--ink`, Inter, **15px**, line-height **1.55**,
  `-webkit-font-smoothing: antialiased`.
- `h1 h2 h3`: Fraunces, weight 500, `--ink`, `margin: 0 0 0.4em`, `letter-spacing: -0.01em`.
  `h1` 2.1rem/600, `h2` 1.35rem, `h3` 1.05rem.
- `p`: `margin: 0 0 1em`, `--ink-soft`, `max-width: 62ch`.
- Links: `--forest`, no underline, underline on hover.
- `button, input, select, textarea { font-family: inherit; font-size: inherit; color: inherit }`.
- Buttons: pointer, `1px solid transparent`, radius `--radius`, transition
  (background .15s, border-color .15s, transform .05s); `:active` -> `translateY(1px)`.
- Focus ring on buttons, links, inputs: `outline: 2px solid var(--forest); outline-offset: 2px`.
- `::selection`: background `--forest-tint`, colour `--forest-dark`.

### Shared classes
| Class | Style |
|---|---|
| `.btn-primary` | bg `--forest`, white text, padding `0.85rem 1.6rem`, weight 500, 1rem, radius 4px. Hover `--forest-dark`. Disabled: bg `--line`, text `--muted`, not-allowed. |
| `.btn-secondary` | transparent, `1px solid --line`, `--ink-soft`, padding `0.7rem 1.3rem`, weight 500. Hover: border and text `--forest`. |
| `.btn-text` | transparent, `--forest`, padding `0.4rem 0.2rem`, weight 500. |
| Form fields | width 100%, `1px solid --line`, bg `--paper-raised`, radius 3px, padding `0.65rem 0.75rem`; focus border `--forest`; textarea `resize: vertical; min-height: 5rem`. |
| `label` | block, 0.85rem, `--ink-soft`, weight 500, margin-bottom 0.35rem; always above the field. |
| `.card` | bg white, `1px solid --line`, radius 6px, `--shadow-card`. |
| `.status-pill` | inline-flex, padding `0.25em 0.75em`, radius 100px, 0.8rem, weight 500. |
| `.status-approved` | bg `--forest-tint`, text `--forest-dark`. |
| `.status-pending` | bg `--amber-tint`, text `--amber`. |
| `.status-rejected` | bg `--rust-tint`, text `--rust`. |

Recurring patterns:
- **Empty state:** 0.9rem, `--muted`, padding 1.25rem, `1px dashed var(--line)`, radius 6px.
- **Error text:** `--rust`, 0.85rem, `margin: 0.75rem 0 0`.
- **Ledger rows:** no boxes; `border-top` on the `<ul>`, `border-bottom: 1px solid var(--line)`
  on each `<li>`, padding `0.9rem 0.25rem`.
- Small buttons: padding `0.55rem 1.1rem`, 0.88rem.
- **Filter chips:** transparent, `1px solid --line`, `--muted`, 0.82rem, weight 500, padding
  `0.4rem 0.9rem`, fully rounded; active: border+text `--forest`, bg `--forest-tint`.

## 6. Navbar (all pages except first-run)
- Full-width, white, `border-bottom: 1px solid --line`, padding `1rem 2rem`, flex, gap 2rem.
- Left: brand = small leaf SVG mark (1.1rem, forest stroke) + "Paroh" in Fraunces 1.15rem/600,
  `--ink`. Links to Twin home.
- Middle: text links **Twin, Journal, Ask, Plan, Approvals, Privacy** (0.92rem, weight 500,
  `--muted`, `border-bottom: 2px solid transparent`; hover `--ink`; active `--forest` with
  forest bottom border). Approvals shows a small count in Fraunces when facts are pending.
- Right: sample student name, a small pill "sample data" (0.72rem, `--muted`, bg `--paper`,
  `1px --line`, rounded), "Reset" as `.btn-text`.
- Mobile (<= 720px): wraps, padding `0.85rem 1.25rem`; links drop to their own row.

## 7. Pages (all centred, narrow, never full width; padding `3rem 2rem 4rem`)

### 7.0 Welcome / consent (first run, no navbar) — pattern of a centred sign-in card
Single `.card`, max-width 380-420px, padding `2.25rem 2rem`: leaf mark, `h1` "Paroh", one
line "Your personal twin. You decide what it knows.", four plain toggles (Journal, Tasks and
habits, Energy and mood, Planner), then full-width `.btn-primary` "Start with the sample
student". Below a hairline: small muted note that the demo uses sample data and how the
language model is used.

### 7.1 Twin (home), max-width **920px**
- Hero, two columns (text left, **Twin Bloom** right; stacks under 720px):
  eyebrow "Good to see you" (0.85rem, `--forest`), `h1` 2.4rem (`max-width: 14ch`), e.g.
  "Hey Asha, here's your week.", lede (`max-width: 46ch`), one `.btn-primary.big` "Ask a
  what-if".
- Stats row (flex, gap 2.5rem, margin-top 2.5rem, padding-top 1.75rem, top hairline): Fraunces
  1.8rem numbers over 0.8rem muted labels: "on-time odds this week", "twin fidelity",
  "waiting for review".
- **Focus hours** (`h2`): weekday x hour heatmap of flat cells (see 8.2).
- **Coming up** (`h2`): deadlines as a ledger list; right side a risk pill (forest "on track",
  amber "tight", rust "at risk") with the on-time percentage.
- **Goals**: ledger rows with a 4px flat progress bar (`--forest` on `--line`).
- **What your twin has learned** (memory timeline): ledger rows, newest first, each with
  date, short fact text, and kind pill (task, goal, habit, preference).

### 7.2 Journal, max-width **560px**
`h1` "Journal", subtitle. `.card` form padding 2rem: title input, big textarea (`min-height`
12rem, body text 1rem, comfortable line height), energy/mood chips ("Low, Meh, Ok, Good,
Great" as text chips), tags input, row of `.btn-text` "Dictate" and `.btn-secondary` "Save
draft", then ONE `.btn-primary` "Find what to remember". Result summary line: "3 things to
review" linking to Approvals.

### 7.3 Approvals (extracted facts queue), max-width **720px**
Direct use of the review-queue pattern. `h1` "Approvals", subtitle "3 things waiting on you."
Each item is a `.card` (padding `1.25rem 1.4rem`): top row = kind pill + fact text on the
left, source date on the right; the sentence it came from in quotes, italic, `--ink-soft`;
optional note textarea via "Add note"; actions: small `.btn-primary` "Approve", small
`.btn-secondary` "Not me" (hover rust), `.btn-text` "Edit". Approving shows inline forest
text "Added to your twin." and triggers the Twin Bloom growth (see 8.1). "Recently decided"
ledger below with status pills. Empty: "Nothing waiting for review. Take a breath."

### 7.4 Ask (what-if simulator), max-width **760px**
`h1` "Ask", subtitle. Prompt textarea (`rows=3`) + `.btn-text` "Dictate" + `.btn-primary`
"Compare options". Results: two `.card`s in a 2-column grid (1 column under 720px), each:
label (Fraunces h3), big on-time chance (Fraunces 1.8rem), then ledger rows for peak
workload, effect on goals, assumptions. A thin SVG **fork** above the cards (see 8.3).
**Recommendation** card below: pill "Recommended", 3-4 sentence explanation, `.btn-text`
"Why this?" that expands a ledger of the exact facts used, and `.btn-text` "Read aloud".
Actions: `.btn-primary` "Go with this", `.btn-secondary` "Change it", `.btn-secondary`
"Not for me". After the choice: a line "Your twin guessed option B. It was right." and the
fidelity number updates with a count-up.

### 7.5 Plan, max-width **920px**
- **Month** (default): ledger-style calendar grid drawn with 1px lines only; events are small
  tinted labels (study = forest tint, health = amber tint, personal/other = neutral with
  `--line` border; use a text label so colour is never the only signal; avoid rust for
  categories because rust means risk/rejection). Right column (or below on mobile): top
  priorities, monthly goals with flat progress bars, month overview numbers in Fraunces.
- **Year** (P2): toggle chips "Month | Year". Year = 12 month columns separated by hairlines
  and horizontally scrollable plan rows; today marked with a forest vertical line.

### 7.6 Habits & tasks, max-width **760px**
Two sections. Habits: ledger rows with a square checkbox styled with tokens, 14-day dot strip,
streak number in Fraunces. Tasks: ledger rows with title, category label, due date, estimate
(hours), done checkbox; adding a task is a compact inline form. Header chips: All / Today /
This week.

### 7.7 Privacy (consent ledger), max-width **720px**
Rows per data category: name, plain description, "last used" text, and a CSS-only toggle
(forest when on). Below: `h2` "What would be sent to the language model" with a bordered box
(`--paper` bg, 1px line, preformatted text) showing the exact payload for the last action,
plus a muted line about voice input using the browser's speech service. Include "Delete all
my data" as a rust-hover `.btn-secondary`.

## 8. Signature visuals (flat, hand-drawn SVG, no gradients, no shadows)

### 8.1 Twin Bloom (the hero)
- SVG about 320x320. Centre: small circle (1px `--ink` stroke) with the Fidelity percentage
  in Fraunces.
- **Six leaves** radiate from the centre, one per domain: tasks, habits, routines, energy,
  goals, planner. Leaf length = that domain's confidence (0-1). Fill `--forest-tint`, stroke
  `--forest` 1px. Domains with confidence < 0.3 are a **dashed** outline with no fill (same
  visual language as empty states). Each leaf has a 0.75rem muted label.
- An outer thin ring arc shows weekly workload; its stroke colour follows load: forest (<60%),
  amber (60-85%), rust (>85%).
- Motion: on first paint leaves grow from the centre (scale, 800ms ease-out, 80ms stagger).
  When a fact is approved, its domain's leaf extends smoothly (500ms) and its stroke thickens
  to 2px then eases back. Idle: none, or an extremely slow +-1.5 degree sway (8s). Respect
  `prefers-reduced-motion` (no animation).
- Implement as a pure component: `<TwinBloom domains={...} load={...} fidelity={...} />`.

### 8.2 Focus-hours heatmap
7 rows (Mon-Sun) x hourly columns 6:00-24:00 as flat square cells with 1px gaps, 5 tint levels
derived with `color-mix` from `--forest` over `--paper-raised`. Muted hour labels on top,
weekday labels on the left (0.75rem). Hover shows plain text in a caption line beneath (no
floating tooltips with shadows).

### 8.3 Scenario fork
Thin SVG, 1px lines: a dot at "now", two lines diverging to the two deadline markers, each
line coloured by risk (forest/amber/rust), small dots at deadlines with muted date labels.
Draws in with a stroke-dashoffset animation (600ms).

## 9. Motion
Slow, eased (`cubic-bezier(.2,.7,.2,1)`), 200-800ms. Numbers may count up. Nothing bouncy,
no parallax, no glow. Everything must also look complete with motion disabled.

## 10. Responsive
Breakpoints: **720px** (navbar wraps, tables stack, grids to one column) and **520px** (form
grids to one column). Pages stay narrow and centred (560-920px).

## 11. Voice controls (visual)
Speaker toggle in the navbar right side: `.btn-text` "Voice on / Voice off". "Read aloud"
`.btn-text` next to any spoken text. While speaking, a muted "Speaking..." line with the
words highlighted in `--forest-tint` is optional. Captions (the text itself) are always
visible; voice never replaces text.

## 12. Do / Don't
**Do:** use only tokens; hairlines instead of boxes and shadows; Fraunces for anything
headline-like and big numbers, Inter for the rest; flat buttons (3-4px radius), pills fully
rounded, cards 6px; warm short copy; dashed empty states.
**Don't:** dark mode, gradients, extra shadows, icon libraries, UI kits, zebra tables, heavy
table headers, more than one filled green button per section, saturated colours, and any
therapy/mental-health wording (no "healing", "anxiety", "therapy", "diagnosis").
