# Paroh Design System — "Night Garden / Orbit"

This is the ONLY visual reference. It REPLACES the earlier paper-ledger system entirely.
Nothing from that look (light paper background, no gradients, no dark mode, plain-CSS-only,
no animation libraries) applies any more. Write every file fresh in this repo.

## 1. Concept
**Time as orbits.** The twin is a living orb at the centre (it is also the voice assistant).
The year is a radial wheel around it, the month is a lunar calendar, and incoming data are
signals drifting toward the orb. Everything else is drawn in one consistent language:
**thin glowing strokes that draw themselves on**, glass panels, and a few hand-drawn doodles
(arrows, underlines, circled deadlines) so it looks designed, not generated.

Feel: dark, cinematic, calm, a little magical. Simple, never busy. One hero per screen.
Copy tone: friendly, plain, short. Not therapy wording (see guardrails in CLAUDE.md).

## 2. Tech rules
- Next.js App Router + TypeScript. Plain CSS (global tokens + per-component CSS files).
  **No Tailwind, no UI kits, no chart libraries, no icon libraries** (draw icons as inline SVG).
- **Motion:** `npm i motion`, import from `"motion/react"`. Components using it start with
  `"use client"`.
- **React Bits:** copy ONLY the approved five in section 8, using the **TS + CSS** variant
  (never the Tailwind variant), into `src/components/fx/`. Any other visual library is banned.
- Charts, heatmap, year wheel, graph and fork are custom SVG.
- Performance: animate only `transform` and `opacity`; at most ONE heavy WebGL/canvas effect
  on screen at a time (the Aurora background OR the Orb, never stacked with more); everything
  must hold 60fps on a projector laptop. Honour `prefers-reduced-motion` everywhere.

## 3. Fonts (Google Fonts in the document head)
```
Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600   display, headings, big numbers
Inter:wght@400;500;600                                UI and body
Caveat:wght@500                                        doodle annotations ONLY (small, rare)
```

## 4. Tokens (`:root`)
```css
:root {
  --bg: #07060d;                      /* ink-violet page background */
  --bg-2: #0d0b18;                    /* raised sections */
  --glass: rgba(255, 255, 255, 0.05); /* panels, with backdrop-filter: blur(18px) */
  --glass-strong: rgba(255, 255, 255, 0.09);
  --stroke: rgba(255, 255, 255, 0.10);/* ALL 1px borders */
  --stroke-glow: rgba(167, 139, 250, 0.45);

  --text: #f3f0ff;
  --text-soft: #c9c3e6;
  --muted: #8f89ad;

  --teal: #5eead4;    /* study, on track, primary */
  --violet: #a78bfa;  /* the twin, AI, accents */
  --amber: #fbbf24;   /* career, caution, pending */
  --rose: #fb7185;    /* personal accent, high risk, rejected */
  --green: #86efac;   /* health, approved */

  --aurora: linear-gradient(120deg, var(--teal), var(--violet) 55%, var(--amber));

  --font-display: "Fraunces", Georgia, serif;
  --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-hand: "Caveat", cursive;

  --radius: 14px;
  --radius-sm: 8px;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  --spring: { type: "spring", stiffness: 140, damping: 18 }; /* use in motion props, not CSS */
}
```
**Category colours (fixed, everywhere):** study = teal, health = green, personal = rose-tinted
violet (`#c4b5fd`), career = amber, other = muted. Never use colour alone: add a text label.
**Risk colours:** on track = teal, tight = amber, at risk = rose.
Never hardcode new colours; derive tints with `color-mix(in srgb, var(--x) 30%, transparent)`.

## 5. Global styles
- `body`: `--bg`, `--text`, Inter 15px / 1.55, antialiased. Subtle film-grain overlay
  (inline SVG noise, `opacity: .05`, `pointer-events: none`, fixed, full screen).
- Headings Fraunces 500, `letter-spacing: -0.01em`. Hero headline up to 3rem. Big numbers
  Fraunces with `font-variant-numeric: tabular-nums`.
- **Glass panel** (`.glass`): `background: var(--glass)`, `1px solid var(--stroke)`,
  `backdrop-filter: blur(18px)`, radius `--radius`, soft inner top highlight. Use sparingly
  (max ~6 blurred panels visible at once) for performance.
- **Buttons:** `.btn-primary` = aurora gradient fill, dark text, radius 999px, hover lifts
  2px with glow. `.btn-ghost` = transparent, `--stroke` border, hover border `--stroke-glow`.
  One primary button per screen section.
- Focus ring: `outline: 2px solid var(--teal); outline-offset: 3px`.
- Doodles: Caveat 1.1rem in `--amber` or `--violet`, slight rotation (-3deg), a hand-drawn SVG
  arrow or underline beside it. Max one or two doodles per screen.

## 6. Shell
- Top bar (glass, sticky): leaf/orb mark + "Paroh", nav **Twin · Talk · Journal · Rhythm ·
  Plan · Pulse · Ask · Sources**, then right side: "Asha · sample data" pill, Voice on/off,
  and an **Approvals badge** (count of pending facts) that opens the Approvals tray from
  anywhere (also available at `/approvals`).
- Mobile (<=720px): bottom tab bar with the four main items plus a "more" sheet.
- Page background: one of the two — a very dark gradient with the Aurora effect (Twin page
  only) or flat `--bg` with a faint radial violet glow (all other pages).

## 7. Screens and their signature visuals

**Twin (home).** Centre: the **VoiceOrb** (see 7.1). Around it: the **knowledge constellation**
(approved facts as small glowing nodes grouped by kind, edges to their source, slow drift).
Below: a glass stat row (load gauge, habit ring, goal ring, fidelity chip "7 of 10 — twin's
guess vs your choice" with count-up), the focus **heatmap** (7x24 cells that light up in a
staggered wave), and the deadline **risk list** with small arcs.

**Talk.** Full-height, orb centre, live captions under it. The twin asks a question (lowest
confidence domain first) plus 3 quick-reply chips; user answers by voice or tap; a candidate
**fact card** appears with confidence; Approve sends it flying (shared layout / path) into the
orb, which flares, then the twin says a short confirmation.

**Journal.** Calm writing panel, title, mood and energy pick (5 glowing dots each), tags.
"Find what to remember" sweeps a scan line across the text, then fact cards fan out.

**Rhythm (habits + tasks + mood).** Three panels, one screen.
- Habits: each habit is a **chain of 14 orbiting dots** (done = filled teal) with the streak
  number in Fraunces; tap today's dot to check in (ripple animation).
- Tasks: list with category dot, due date, estimate; completing one asks for actual hours
  (this feeds estimation bias). A small "you usually take 1.3x longer on study tasks" doodle.
- Energy and mood: a 7-day wavy **ribbon** (mood as height, energy as colour) overlaid on
  the heatmap hours. Copy is about planning patterns, never feelings analysis.

**Plan.** Toggle chips "Month | Year".
- Month: lunar calendar grid, hairline cells, category-coloured glowing dots per task, overload
  days pulse amber, click a day to slide open its tasks. Side panel: top priorities, goal
  progress, month overview.
- Year wheel: radial layout, 12 month segments around the orb; goals are arcs, deadlines are
  pins, today is a sweeping hand that animates once on load.
Both are derived from `Task.dueAt` and `Goal.targetDate`; no extra engine data needed.

**Pulse (notifications and monitoring).** A feed of "whispers" computed from TwinState while
the app is open (load spikes, deadline risk changes, streak at risk). Glass cards slide in with
a soft chime (optional, respects Voice toggle). Each can be dismissed or turned into a What-if.
Header badge: "monitoring: sample data". Optional browser Notification opt-in, honest copy:
works only while the browser/tab is open.

**Ask.** What-if input (dictate button). Submitting morphs the input into the **fork**: two
paths drawing on (`pathLength`), each with an on-time probability arc and a peak-load band.
Recommendation card types out while speech reads the `spoken` text; captions always visible;
Stop control. After Accept / Change / Reject, reveal the twin's predicted choice and count
the fidelity number up.

**Sources.** A ring of tiles around a small orb. Live: Journal, Voice answers, Tasks and
planner (sample data). Roadmap (dashed outline, "Coming next", muted): Gmail, WhatsApp,
Telegram, Calendar. Tiny signal particles drift toward the orb from live tiles. Line for
judges: every source ends at the same gate — you approve before the twin learns. The
**Privacy** section lives on this screen: consent toggles that genuinely filter data, the
payload preview ("what would be sent to the language model"), the honesty notes, and
"Delete all my data".

### 7.1 VoiceOrb (the hero component)
`<VoiceOrb state="idle|listening|thinking|speaking" level={0..1} confidence={...} load={...}
fidelity={...} />`
- Built from the React Bits **Orb** as a base, then customised: ring thickness from domain
  confidence, pulse speed from load, glow from fidelity.
- idle = slow breathing; listening = reacts to `level` (Web Audio AnalyserNode, live only,
  nothing recorded); thinking = rings swirl faster; speaking = pulses with the sentence queue.
- Reduced motion: static orb with a colour change per state.

## 8. The approved React Bits list (decision fatigue solved — do not browse for more)
One component per role. If none of these fits, build it with `motion`. Nothing else tonight.
| Role | Component |
|---|---|
| Page background (Twin page only) | **Aurora** |
| Voice core base | **Orb** |
| Numbers (fidelity, stats) | **Count Up** |
| Headlines | **Blur Text** |
| Cards and tiles | **Spotlight Card** |
Everything else (graph, wheel, fork, heatmap, chains, ribbon) is custom SVG + `motion`.

## 9. Motion rules
- Easing `--ease`, 250-900ms for UI, slower (4-8s) for ambient breathing. Use `motion` springs
  for physical things (flying cards, presence). Stagger lists by 40-80ms.
- "Draw-on" for every line and path (`pathLength` 0 to 1). Approved things travel into the orb.
- `AnimatePresence` for all mount/unmount. Shared layout (`layoutId`) for card-to-orb moves.
- Everything looks complete with motion disabled (`prefers-reduced-motion`).

## 10. Responsive
Breakpoints 720px and 520px. Hero screens stack; orb scales with `clamp()`. Test on the
demo laptop at 100% and 125% zoom, and on a projector-like low-contrast check (text never
below `--muted` on glass).

## 11. Do / Don't
**Do:** one hero per screen, consistent stroke weight (1.5px), glass used sparingly, real data
from the DataService, short warm copy, empty states that are drawn (dashed orbit + doodle).
**Don't:** more than one heavy WebGL effect, unapproved React Bits, gradients on body text,
emoji as icons, therapy/mental-health wording, invented numbers (always from the engine),
any claim of perfect prediction or fully-local processing.
