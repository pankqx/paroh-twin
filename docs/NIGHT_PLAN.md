# Paroh — Night Plan (THE plan; no turning back)

Deadline **08:00, 1 Oct 2026**. Submit by **07:30**. One builder (Pank) + two AI agents
(Claude Code = UI, Codex = engine). This file is the single source of truth. Where it
disagrees with `HANDOFF.md`, `SOLO_PLAN.md` or `BUILD_GUIDE.md`, THIS file and
`DESIGN_SYSTEM.md` win. Do not revisit decisions below.

## 0. Decisions (locked)
1. Visual direction: **Night Garden / Orbit** (`docs/DESIGN_SYSTEM.md`). The old paper-ledger
   look is dead.
2. **The voice assistant is the core.** The twin asks questions out loud; the answers become
   candidate facts; the user approves; the twin visibly learns.
3. Libraries: **`motion`** (Framer Motion) + the **five approved React Bits** (Aurora, Orb,
   Count Up, Blur Text, Spotlight Card, TS+CSS variants). No Tailwind. No others.
4. The engine in `src/lib/` (types, DataService, twin functions, simulation, extraction,
   LocalDataService) is KEPT. The UI talks only to `DataService`. Do not rewrite it.
5. Simulation and pattern math stay in TypeScript. The LLM only structures text and explains.
6. LLM via OpenRouter from server routes only. Any error or timeout falls back to canned
   responses so the demo never breaks. Key only in `.env.local` / Vercel env, never in git.
7. Demo uses the labelled sample student "Asha (sample)".

## 1. The product (what judges see)
Loop: **data sources -> extract facts -> user approves (consent) -> twin state (visual) ->
what-if simulation -> spoken recommendation -> feedback -> fidelity.**
Data sources: Journal and Voice answers are live; tasks/planner are sample data; Gmail,
WhatsApp, Telegram, Calendar are **roadmap** (shown, not implemented, said out loud as such).
Personalisation: the twin tailors questions, scenarios and explanations using approved facts
plus habit, task-estimation and mood/energy statistics from consented categories only.

## 2. Screens (priority order)
| # | Screen | What it proves | Tier |
|---|---|---|---|
| 1 | **Twin** — VoiceOrb, knowledge constellation, heatmap, load, fidelity | it is a living model | MUST |
| 2 | **Talk** — voice Q&A -> fact cards -> approve -> fly into orb | data collection + consent | MUST |
| 3 | **Journal** -> extraction cards -> Approvals tray | multiple sources | MUST |
| 4 | **Ask** — what-if fork, spoken recommendation, fidelity tick | decision support | MUST |
| 5 | **Sources** (+ Privacy) — live vs roadmap connectors, consent toggles, payload preview | trust and roadmap | MUST |
| 6 | **Rhythm** — habit chains, tasks (est vs actual), energy/mood ribbon | tailoring data | SHOULD |
| 7 | **Plan** — month calendar + year wheel, derived from tasks/goals | visual planners | SHOULD |
| 8 | **Pulse** — whispers feed ("monitoring: sample data") | notifications, monitoring | SHOULD |

Cut order if behind: Year wheel -> Month -> Pulse -> Rhythm polish. **Never cut 1-5.**
Consent note: `ConsentCategory` in `types.ts` is journal | tasks | mood | planner. Habits are
covered by **tasks**. Do not change the type tonight.

## 3. Honest claims (say and write exactly this)
- Hosted LLM via OpenRouter (not on-device); a payload preview shows what is sent.
- No audio is recorded or stored; browser speech input may use the browser vendor's service.
- Monitoring/notifications run on sample data while the app is open; real continuous
  monitoring needs the connectors (roadmap).
- The twin is an explainable approximation with a fidelity score, **not** perfect prediction.
- Not a therapy or mental-health product.

## 4. Ownership (no collisions)
- **Claude Code (UI):** `src/app/**` pages, `src/components/**`, `src/styles/**`.
- **Codex (engine):** `src/lib/**`, `src/mock/**`, `src/app/api/**`.
- Use worktrees: `git worktree add ../paroh-engine -b engine`. Merge to `main` every ~90 min,
  run `npm run build`, push. A type change happens on `main` first, then merged into both.
- Commit after every screen/feature. Keep the app runnable at every commit.

## 5. Engine tasks (Codex), in order
1. Confirm `LocalDataService`, sample data (Asha), twin functions and canned extraction exist
   and match `DataService.ts`. If any piece is missing, implement it per HANDOFF section 9.
2. `nextQuestions()` on DataService: lowest-confidence domains first, each with question text,
   domain and 3 quick-reply options. Answers go through `extractFacts` (`source: "question"`).
3. `src/lib/voice/speak.ts` (sentence-queued speechSynthesis, en-IN preferred, `stop()`,
   persisted on/off, only starts after a user gesture) and `src/lib/voice/listen.ts`
   (SpeechRecognition wrapper, `isSupported()`, start/stop, optional input `level` via
   AnalyserNode, never records or stores audio).
4. `buildTwinContext(consent)`: the compact, consented-only summary (approved facts, habit
   consistency, estimation bias, energy/mood averages) used in LLM prompts for tailoring.
5. `POST /api/extract` and `POST /api/explain` (OpenRouter): 12s `AbortController` timeout,
   try `OPENROUTER_MODEL`, then `OPENROUTER_FALLBACK_MODEL`, then canned response with
   `degraded: true`. JSON-only extract prompt, no clinical/emotional interpretation. Explain
   must never invent numbers. Log the exact payload for the preview.
6. `pulseWhispers(twinState, tasks, habits)`: pure function returning whispers (load spikes,
   deadline risk, streak at risk) for the Pulse feed.
7. A few unit tests (bias, load, simulation, whispers).

## 6. UI tasks (Claude Code), in order
1. Replace the old look: new tokens in `src/styles/globals.css`, fonts (add Caveat),
   `npm i motion`, copy the five React Bits (TS+CSS) into `src/components/fx/`, rebuild Navbar
   as the new shell (section 6 of the design system), restyle Welcome/consent.
2. `VoiceOrb` (4 states) + **Twin** page.
3. **Talk** + fact cards + Approvals tray + fly-into-orb animation.
4. **Journal** with scan-line extraction animation.
5. **Ask** with fork, typed + spoken recommendation, captions, Stop, fidelity reveal.
6. **Sources** + Privacy (toggles that really filter, payload preview, honesty notes).
7. **Rhythm**, **Plan** (month then year wheel), **Pulse**.
8. Empty states, loading states, reduced-motion pass, responsive pass, README.

## 7. React Bits: how to pick (decision-fatigue killer)
Use ONLY the five in `DESIGN_SYSTEM.md` section 8. Rule of thumb for anything else: if you
are browsing, stop and build it with `motion` + SVG. Install: go to reactbits.dev, open the
component, choose **TS** and **CSS** (not Tailwind), use the CLI/copy-paste shown on that
page (verify the command there), place it in `src/components/fx/`.

## 8. Timeline (IST)
| Time | Work |
|---|---|
| 23:30-00:00 | Push engine; worktrees; Vercel deploy of the empty app with env vars; start both agents |
| 00:00-02:00 | Engine tasks 1-3 || UI tasks 1-2 (Twin + orb) |
| 02:00-04:00 | Engine 4-5 || UI 3-4 (Talk, Approvals, Journal). Merge + smoke test |
| 04:00-05:30 | Engine 6-7 || UI 5-6 (Ask, Sources/Privacy). **FEATURE FREEZE 05:30 for MUSTs** |
| 05:30-06:30 | UI 7 (Rhythm, Plan, Pulse) only if MUSTs are solid; otherwise polish |
| 06:30-07:30 | Reduced-motion + responsive pass, README, production deploy, test the live link, record the demo twice, **submit by 07:30** |
Breaks: 10 minutes around 02:00 and 04:30. Tired mistakes cost more than the break.

## 9. Definition of done
- Twin -> Talk -> Approve -> Ask (spoken) -> fidelity works end to end, offline (canned) AND
  with the live model; fallback verified by unsetting the key.
- No console errors, no secrets in git, `.env.example` committed, deployed link works.
- README states: built from scratch during GATEWAYS 2026; implemented vs planned (connectors,
  real monitoring, audio journal); hosted LLM honesty; sample data; not a therapy product.
- Demo rehearsed; backup video recorded.

## 10. Demo script (3 minutes)
1. (20s) Twin: the orb breathes. "This is Asha's twin (sample data): a model of what she
   permitted, not a chat history."
2. (50s) Talk: the twin asks a question aloud; answer by voice; fact card; approve; it flies
   into the orb and the constellation grows.
3. (20s) Sources: live vs roadmap connectors; "every source ends at the same approval gate".
4. (60s) Ask: what-if by voice; fork; probabilities from her own history; spoken
   recommendation; accept; predicted-choice reveal; fidelity ticks up.
5. (20s) Privacy: toggle a category off, payload preview shrinks; state the honesty notes.
6. (10s) Close: "Not perfect prediction: an explainable, improving model of you."

## Amendment A (decided 1 Oct 00:00)
1. The **VoiceOrb hero is REPLACED by `TwinFace`**: a huge line-art portrait of a young woman,
   drawn in SVG, who is the student's "twin". No WebGL and no raster images.
2. The orb states become **face states**: `idle | listening | thinking | speaking`
   (breathing and blinking; leaning in; eyes up-left with thought dots; mouth shapes).
3. A small glowing **mind point** at her temple receives approved facts: cards fly into it and it
   flares. This replaces "fly into the orb" everywhere (Talk, Approvals tray).
4. A full **scroll-story landing at `/story`** with a first-visit loader is added and built
   **LAST**, only after Twin, Talk, Journal, Ask and Sources are solid. It is not a MUST.
5. Unchanged: ownership split, DataService-only data access, honest claims, sample data,
   consent-first, motion rules (transform/opacity/stroke-dashoffset, reduced motion).

