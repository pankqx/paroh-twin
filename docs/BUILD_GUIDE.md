# Paroh — Solo Build Guide (Claude Code + Codex)

Follow in order. Every step has: who does it, the exact prompt, and how to check it worked.
Scope = SOLO_PLAN.md. Design = DESIGN_SYSTEM.md. Details = HANDOFF.md. Deadline 08:00.

---

## Part A — Setup (about 30-40 minutes)

### A1. Tools
- Node 20+ and git installed; VS Code open.
- Claude Code installed and signed in (`claude` in a terminal). Follow the current install
  instructions from Anthropic's docs; the npm route is `npm install -g @anthropic-ai/claude-code`.
- Codex CLI installed and signed in (`codex`), following OpenAI's current instructions.
- An OpenRouter account with a key and a small credit or spend limit (organizers give none).
  Do this now while you wait for installs. You can build everything without it first.

### A2. Repo and scaffold
```bash
git clone https://github.com/pankqx/paroh-twin.git
cd paroh-twin
# if the repo has only a README, delete it first so the scaffold can run in this folder
npx create-next-app@latest . --ts --app --src-dir --no-tailwind --eslint --import-alias "@/*" --use-npm
```
Answer the prompts: no Tailwind, no extra experiments. Then:
```bash
mkdir docs
# copy CLAUDE.md to the repo root; copy HANDOFF.md, DESIGN_SYSTEM.md, SOLO_PLAN.md into docs/
printf "Read CLAUDE.md, then docs/SOLO_PLAN.md, docs/HANDOFF.md and docs/DESIGN_SYSTEM.md before coding.\n" > AGENTS.md
printf "OPENROUTER_API_KEY=\nOPENROUTER_MODEL=\nOPENROUTER_FALLBACK_MODEL=\n" > .env.example
cp .env.example .env.local     # then paste your real key into .env.local only
git add -A && git commit -m "chore: scaffold Next.js app and project docs" && git push
```
Check `.gitignore` contains `.env*.local` (create-next-app adds it). The repo is PUBLIC:
never commit the real key.

### A3. Deploy the empty app now
Import the GitHub repo into Vercel, add the three env vars there, deploy. Confirm the live
URL loads. From now on every push to `main` redeploys.

### A4. Two agents, two folders (avoid collisions)
Two agents editing the same folder will overwrite each other. Use git worktrees:
```bash
git worktree add ../paroh-ui -b ui
git worktree add ../paroh-engine -b engine
```
- Open `../paroh-ui` in one VS Code window and run **Claude Code** there.
- Open `../paroh-engine` in another window and run **Codex** there.
- In each worktree run `npm install` and copy `.env.local` in.
- Merge into `main` often: `git checkout main && git merge ui && git merge engine`, run
  `npm run build`, push. Then in each worktree `git merge main` to stay in sync.
Ownership rule: **UI** owns `src/app/**` (pages), `src/components/**`, `src/styles/**`.
**Engine** owns `src/lib/**`, `src/mock/**`, `src/app/api/**`. Neither edits the other's
files; if a type must change, change `types.ts` on `main` and merge it to both.

---

## Part B — Habits that keep the agents useful
- One step per prompt. Start each step with `/clear` (Claude Code) or a fresh session so the
  context stays small and usage lasts.
- For big steps say: "First propose a short plan and wait for my approval."
- After each step: `npm run build`, `npm run dev`, click through the feature, then commit.
- Reject anything that adds Tailwind, UI kits, icon libraries, gradients, shadows, or copies
  code from elsewhere. Say: "Remove that; follow docs/DESIGN_SYSTEM.md."
- If one tool hits its usage limit, continue with the other on the same worktree.
- Never paste secrets into a prompt.

---

## Part C — Build steps

### Step 1 — Foundation (Claude Code, on `main`) — about 45 min
Prompt:
> Read CLAUDE.md and docs/. Do ONLY this: (1) implement `src/styles/globals.css` exactly from
> docs/DESIGN_SYSTEM.md (fonts via next/font or a link tag, all tokens, global styles, shared
> classes: btn-primary, btn-secondary, btn-text, card, status pills, chips, empty state,
> ledger list); (2) root layout with the Navbar component (links Twin, Journal, Ask,
> Approvals, Privacy; sample-data pill; Voice toggle placeholder; Reset placeholder); (3) a
> Welcome/consent card page at `/welcome` with four toggles and a "Start with the sample
> student" button that routes to `/`; (4) `src/lib/types.ts` from HANDOFF.md section 7,
> trimmed to what the solo scope needs; (5) `src/lib/data/DataService.ts` (interface only, no
> implementation) per HANDOFF section 8 trimmed to the solo scope; (6)
> `src/mock/twinStateStub.ts`, a typed hard-coded TwinState with realistic numbers so the UI
> can be built before the engine exists. No other screens. Show me the file list when done.

Check: `/welcome` looks like the design system (warm paper, Fraunces headings, hairlines).
Commit and push to `main`. Then create the worktrees (A4).

### Step 2a — Engine core (Codex, `engine` worktree) — about 90 min
Prompt:
> Read AGENTS.md and the docs it names. Implement, with unit tests (use vitest), ONLY:
> `src/mock/sample.ts`: a clearly labelled SAMPLE student ("Asha (sample)") with about 3-4
> weeks of data per HANDOFF section 11 (tasks with est/actual hours where study tasks run
> about 1.3x over, 5 habits with streaks, about 14 check-ins, 8 journal entries, 3 goals, an
> exam and a project deadline within the next 4 days, 6 past decisions with accept/reject).
> `src/lib/twin/`: heatmap, estimationBias, load, habitConsistency, goalAlignment,
> confidenceByDomain, deriveTwinState(data) per HANDOFF section 9. Also
> `src/lib/data/LocalDataService.ts` implementing DataService on localStorage, seeded from
> sample.ts, with `resetAll`. Do not touch UI files or styles.

Check: `npm test` passes; a quick console call to `deriveTwinState(sample)` gives sensible
numbers (e.g. study bias near 1.3).

### Step 2b — Twin page (Claude Code, `ui` worktree, in parallel) — about 90 min
Prompt:
> Build the Twin home page (`/`) per docs/DESIGN_SYSTEM.md section 7.1 using the stub in
> `src/mock/twinStateStub.ts` for now. Components in `src/components/`: `TwinBloom` (SVG, six
> leaves, dashed low-confidence leaves, workload ring colour by load, centre fidelity number,
> grow-in animation, respects prefers-reduced-motion; props: domains, load, fidelity),
> `Heatmap`, `StatRow`, `LedgerList`, `RiskPill`, `ProgressBar`. Hero two columns, stats,
> focus hours, coming up, goals, memory timeline. Plain CSS only, flat colours, hairlines.
> Make it beautiful but quiet: strong type scale and generous whitespace.

Check at 100%, 125% zoom and on a narrow window. Compare with your Stitch screenshots.
Commit on `ui`. When the engine is merged, swap the stub for `deriveTwinState`.

### Step 3a — Extraction + facts (Codex, `engine`) — about 60 min
> Implement fact extraction in canned mode: `src/lib/ai/extractCanned.ts` that turns a journal
> text into `Fact[]` (kinds task/goal/habit/deadline/preference) using simple keyword and date
> patterns, plus a fixed rich result for the demo entry text stored in `src/mock/demoEntry.ts`.
> Add DataService methods: saveEntry, extractFacts(entry) (canned), listFacts, setFactStatus
> (approve/reject/edit), and make approved facts update the derived TwinState (raise the
> relevant domain confidence, add to the memory timeline, add tasks/deadlines). Tests for the
> approve -> twin state change.

### Step 3b — Journal + Approvals (Claude Code, `ui`) — about 75 min
> Build `/journal` (DESIGN_SYSTEM 7.2) and `/approvals` (7.3). On "Find what to remember" save
> the entry, call `extractFacts`, show "N things to review" linking to Approvals. Approve /
> Not me / Edit work; approving shows inline "Added to your twin." and the Twin Bloom leaf for
> that domain grows (transition on leaf length + brief stroke thickening). Include a
> "Use demo entry" text button that fills the journal with the demo text so the demo is
> reliable. Add the Dictate button using SpeechRecognition (hide if unsupported).

Check: journal -> extract -> approve two, reject one -> Twin page shows the change.

### Step 4a — Simulation (Codex, `engine`) — about 90 min
> Implement the what-if flow (HANDOFF sections 9.7-9.10): `src/lib/twin/scenarios.ts`:
> `parseWhatIfCanned(text)` producing two scenario specs (recognise the demo sentence about
> finishing a project versus revising for an exam, plus a generic two-option pattern using
> "instead of"); `simulate(spec, twinData)` running 500 Monte Carlo trials that resample the
> student's own actual/estimated ratios and returns onTimeProb, peakLoad, goalImpact and
> assumptions; `recommend(scenarios)`; `predictChoice(decisions)`; `recordChoice` updating
> the Fidelity Score (rolling accuracy over the last 10). If required data is missing, return
> a needsInfo message instead of inventing values. Seeded random for testable results. Tests.

### Step 4b — Ask page (Claude Code, `ui`) — about 90 min
> Build `/ask` per DESIGN_SYSTEM 7.4: prompt textarea with "Use demo question" and "Dictate",
> "Compare options" calls the engine, thin SVG fork (lines draw in with stroke-dashoffset),
> two scenario cards with big Fraunces percentages (count-up), recommendation card with
> "Why this?" expanding a ledger of the exact facts used, Go with this / Change it / Not for
> me. After choosing, reveal "Your twin guessed option B. It was right." and animate the
> Fidelity number in the navbar/Twin page. Handle the needsInfo case with a friendly message.

### Step 5 — Voice speak-back (Codex writes module, Claude Code wires UI)
Codex, `engine`:
> Implement `src/lib/voice/speak.ts` per HANDOFF section 6b: isSupported, speak(text) queueing
> sentences, stop, setEnabled/isEnabled persisted in localStorage, voice selection preferring
> English (India), then British, then US; rate 0.95. Must be callable only from user gestures.
Claude Code, `ui`:
> Add the navbar "Voice on/off" toggle, "Read aloud" text buttons on the recommendation and
> on the Approvals confirmation, a Stop control while speaking, and auto-speak the
> recommendation after "Compare options" ONLY when Voice is on. Captions stay visible.

Check on your demo laptop, in Chrome, with sound on. If no voice is available, buttons hide.

### Step 6 — Privacy page (Claude Code `ui` + Codex `engine`)
Engine: DataService `getConsent/setConsent`; all extraction and explain calls must first
filter their input by consent and expose `previewPayload()` returning the exact text that
would be sent. UI: `/privacy` per DESIGN_SYSTEM 7.7 with real toggles, live payload preview,
the voice-input note, and "Delete all my data".
Check: turn Journal off -> payload preview shrinks and extraction refuses with a friendly line.

### Step 7 — Real AI via OpenRouter (Codex, `engine`) — about 60 min
> Add `src/app/api/extract/route.ts` and `src/app/api/explain/route.ts`. Server-side calls to
> OpenRouter's OpenAI-compatible chat API using env OPENROUTER_API_KEY, OPENROUTER_MODEL and
> OPENROUTER_FALLBACK_MODEL; 15s timeout; on any failure return the canned result with
> `degraded: true`. Extract: return ONLY JSON `{facts:[{kind,text,category,data,confidence}]}`;
> extract only what the text states; no emotional or clinical interpretation. Explain: given
> already computed numbers and used facts, return `{text, spoken}` (spoken under 60 words);
> never invent numbers. Validate model JSON before use. Add simple in-memory rate limiting
> per IP (e.g. 20 requests per 10 minutes). Update the client so the UI uses these routes
> and shows a small muted "offline sample response" note when degraded. Never expose the key.

Before this step, test your model choice with a quick curl using your key. Pick a fast,
inexpensive model that returns clean JSON; keep a second one as fallback. Set a low spend cap
on the OpenRouter key.

### Step 8 — Polish (both agents, then you) — about 90 min
Checklist for prompts to Claude Code:
- Empty, loading and error states in the ledger/dashed style.
- Consistent spacing; type scale; hover/focus states; keyboard focus ring.
- Zoom 110-125% still looks good; all pages OK at 720px and 520px.
- Reduced-motion respected. No console errors. Page titles and favicon.
- "Reset sample data" works from the navbar.

### Step 9 — README, deploy, video (you) — about 90 min
- README: what Paroh is, the loop, screenshots, how to run, env vars, **implemented vs
  planned**, honesty notes (see SOLO_PLAN "README must say"), from-scratch statement.
- Merge everything to `main`, `npm run build` locally, push, confirm the Vercel deployment.
- Run the full demo on the LIVE link in a fresh incognito window.
- Record a backup video (two takes) following the demo script in HANDOFF section 13.

### Stretch steps (only if ahead of schedule, in this order)
1. Habits & tasks page (DESIGN_SYSTEM 7.6) on existing sample data.
2. Month planner view (7.5) reading tasks/deadlines.
3. Twin Questions card on the Twin page asking about the lowest-confidence domain.
Anything not finished stays listed as "planned" in the README.

---

## Part D — Final checklist before submitting (do at least 30 minutes early)
- [ ] Repo is PUBLIC; no `.env.local` or keys committed (search the history for your key).
- [ ] README states from-scratch, implemented vs planned, hosted-LLM and voice notes.
- [ ] Live Vercel link works from a clean browser; demo path works end to end.
- [ ] Canned fallback works with the network off.
- [ ] Voice works on the presenting laptop; Chrome is the demo browser.
- [ ] Backup demo video recorded and uploaded/linked as the form requires.
- [ ] Submission form filled: repo link, demo, deployed link. Submitted before 08:00.

## If something breaks
- Build fails on Vercel but not locally: run `npm run build` locally, read the exact error,
  paste it to the agent with "fix only this".
- Agent rewrites too much: `git checkout .` on that worktree and re-prompt with a narrower step.
- Merge conflict: only `types.ts` and shared files should ever conflict; resolve on `main`,
  then merge `main` back into both worktrees.
- Running out of time: follow "If you fall behind" in SOLO_PLAN.md.
