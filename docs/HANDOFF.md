# Paroh — Full Project Handoff

> **STATUS (30 Sep, late night): partly SUPERSEDED.** `docs/NIGHT_PLAN.md` and
> `docs/DESIGN_SYSTEM.md` (Night Garden / Orbit) are now the source of truth. Still valid here:
> sections 1-3 (context, product, guardrails), 7-11 (data model, data layer, twin logic, LLM
> contracts, seed data). SUPERSEDED: section 4 scope, 5 screens, 6 design direction, 6b voice
> priority (voice is now the CORE), 12 build order, 13 demo script. Ignore any mention of
> TEAM_PLAN, the paper-ledger look, "plain CSS only", "no gradients", "no dark mode", or
> Framer Motion being obsolete. Consent categories follow `src/lib/types.ts` (journal, tasks,
> mood, planner), not the longer list below.


Everything a fresh Claude (Claude Code in VS Code, or Cowork for docs/pitch work) needs to
continue this project. Read fully before coding.

---

## 1. Context

- **Event:** GATEWAYS 2026, 24-hour online hackathon. Started 10:00 on 30 Sep 2026.
  **Round 2 (development) final submission is due 08:00 on 1 Oct 2026; late = not evaluated.**
  Required: (1) PUBLIC GitHub repo link, (2) demo of the working project, (3) deployed link
  (preferred). Organizers give NO API keys or credits. Major deviation from the Round 1
  problem statement is not allowed. AI tools are allowed. Only shortlisted teams go to
  Round 3 (live presentation on campus). About 15 hours remained at the start of this plan.
- **Team:** http dino. Domain 3 — Personal Productivity & Lifestyle. Problem statement:
  *HumanTwin AI: The Intelligent Digital Twin of a Person.*
- **Repo:** https://github.com/pankqx/paroh-twin (new, from scratch).
- **Who builds:** Pank (design system + screens) and Frank Ndagula (full-stack; twin logic,
  API routes, OpenRouter, deployment) work IN PARALLEL from the start in this one repo.
  Other teammates: Merel Riha D souza (ideation), Siddharth Bhat (front end), K S Pankaj
  (researcher) — currently busy. Pank is now building solo with two AI agents; see `docs/NIGHT_PLAN.md`.
- **Rule:** no existing repo or implementation may be used. The idea may be inspired by the
  author's earlier "Paroh" concept, but every line here is new.
- **Round 1 document (already submitted, cannot be edited)** promised: a privacy-focused
  personal assistant that evolves into a digital twin; consent controls; personal memory;
  pattern detection; what-if scenario simulation; recommendation + feedback loop; visual
  dashboard; voice interaction; "SLM/local processing where feasible"; edge-case handling
  (missing, conflicting, changing info, ambiguous requests, privacy boundary). The build must
  stay consistent with this. Deviation to disclose honestly: the LLM is a hosted model via
  OpenRouter, not local.

## 2. Product in one paragraph

Paroh is a personal digital twin for students. The student journals (text or voice), plans
their year and month, tracks tasks, habits and a quick energy/mood check-in, and answers short
questions the twin asks. Paroh turns all of it into structured, approved facts and shows a
living visual model of the student: a **Twin Bloom**, goal progress bars, a productive-hours
heatmap, workload and deadline risk, and a growing memory timeline. The student can ask
"what if I do X instead of Y?", see branching scenarios with risk, get a recommendation, and
accept/reject/modify it. Feedback improves the twin, and a **Twin Fidelity Score** shows how
well the twin predicts the student's own choices.

**The loop:** permitted data -> approved facts -> twin state -> patterns -> what-if simulation
-> recommendation -> user feedback -> better twin.

**Core differentiator:** the twin is a *quantitative model* (numbers derived from the student's
own data), not just chat memory. The LLM structures text and explains results; plain code does
the pattern math and simulation.

## 3. Guardrails (do not violate)

- Not a therapist/mental-health product. No healing/anxiety/therapy/diagnosis wording.
  Mood = 1-5 "energy & mood" check-in for productivity patterns only. Drop any "healing
  prompts" or "AI therapist" ideas from reference images.
- Consent: per-category toggles; extracted facts require approval; "what is sent to the model"
  preview before LLM calls.
- No audio is recorded or stored. Only text may go to an LLM, and only if allowed. Browser voice input may use the browser vendor's speech service (disclose it).
- Honest claims: no "perfect prediction", no "fully local/offline". Show confidence values.
- Sample persona clearly labelled as sample data.
- No secrets in client code or in git.

## 4. Scope (be ruthless — one person, limited hours)

**P0 — must exist and look stunning**
1. **Twin Home:** Twin Bloom, goal progress bars, productive-hours heatmap, workload gauge,
   deadline-risk list, memory timeline, Fidelity Score.
2. **Journal:** simple rich-text-lite editor (textarea + title + tags), mood pick, save. On
   "Analyze" show **extracted-fact cards** (task / goal / habit / routine / preference /
   deadline). Approve/reject each. Approved cards **animate into the Twin** and update visuals.
3. **Simulate:** "what if" input -> two scenarios as a branching timeline with on-time
   probability, risk colours, recommendation card, Accept / Reject / Modify.
4. **Consent Ledger:** category toggles + "what is sent to the model" preview + provenance
   ("Why this answer?" showing which facts fed it).

**P1 — do if P0 is solid**
5. **Monthly planner:** calendar grid with colour-coded categories, side panel (top priorities,
   monthly goals with progress, month overview stats).
6. **Habits & tasks:** daily habit checklist with streak; task list with estimate + due date +
   category (estimates and actuals feed estimation-bias stats).
7. **Twin Questions:** the twin asks 1-3 short questions per day about the areas where its
   confidence is lowest (see 9.6). Answers become candidate facts.
8. **Mood/energy check-in:** 5 levels, shown as a small weekly strip and as heatmap overlay.

**P2 — only if time remains**
9. **Yearly planner:** horizontal year timeline with month markers and plan cards by category
   (zoom is optional; a simple scrollable timeline is enough).
10. **Voice (dictation + AI speaks back):** see section 6b. Treat speak-back as HIGH priority
    (build it as soon as Ask works); it is cheap with the browser speech APIs. Audio journal
    (recording/storage/playback) is CUT.

Cut order if time runs out: P2 -> yearly planner -> habits/tasks detail -> monthly planner.
Never cut P0.

## 5. Screens & UX

Full page-by-page spec is in `docs/DESIGN_SYSTEM.md` (section 7). Summary:
Welcome/consent card (first run) -> **Twin** (home: Twin Bloom, stats, focus-hours heatmap,
deadlines with risk, goals, memory timeline) -> **Journal** -> **Approvals** (extracted facts
queue; approving grows the Twin Bloom) -> **Ask** (what-if, two scenarios, recommendation,
read aloud, Accept/Change/Reject, Fidelity update) -> **Plan** (month, year is P2) ->
**Habits & tasks** -> **Privacy** (consent toggles + payload preview).

## 6. Design direction

**Replaced.** Follow `docs/DESIGN_SYSTEM.md` ("Night Garden / Orbit"): dark cinematic, glass
panels, aurora gradient accent, Framer Motion (`motion`) plus five approved React Bits
components, custom SVG visuals, the VoiceOrb as the hero. The earlier paper-ledger look, its
"no gradients / no dark mode / plain CSS only" rules and its "Twin Bloom" hero are retired.

## 6b. Voice (input and speak-back)

- **Speech in:** browser `SpeechRecognition` (Chrome) behind "Dictate" buttons on Journal and
  Ask. Hide the button when unsupported. In Chrome this typically uses the browser vendor's
  cloud speech service; say so in the Privacy page. We do NOT record or store audio.
- **Speech out (the AI talks back):** `window.speechSynthesis` in `src/lib/voice/speak.ts`
  exposing `isSupported()`, `speak(text)`, `stop()`, `setEnabled()`. Requirements:
  1. Speech must start from a user gesture (click) because of browser autoplay rules; the
     "Voice on" toggle in the navbar and the "Read aloud" buttons satisfy this.
  2. Speak: the recommendation summary on Ask, twin questions, and a short confirmation after
     Approvals. Auto-speak the recommendation only when Voice is on.
  3. Keep spoken text under about 60 words, plain sentences, no markup. The `explain`
     endpoint returns both `text` and a short `spoken` string.
  4. Split into sentences and queue them (long single utterances can get cut off in Chrome).
  5. Prefer an English (India) voice, else British/US; rate about 0.95. Persist the choice.
  6. Captions always visible; a Stop control while speaking; respect the Voice toggle.
  7. Voice quality varies by device and browser: test on the exact laptop used for the
     live demo and for Round 3. If time remains, a server-side cloud TTS with cached audio
     for the demo phrases is a possible upgrade; do not depend on it.
- **Conversation loop for the demo:** Dictate a what-if -> scenarios -> the twin reads the
  recommendation aloud -> the student answers by click or voice.

## 7. Data model (TypeScript)

Put in `src/lib/types.ts`. Everything has `id`, `createdAt`, `updatedAt`.

```ts
type Category = 'study' | 'health' | 'personal' | 'career' | 'other';
type FactKind = 'task' | 'goal' | 'habit' | 'routine' | 'preference' | 'deadline' | 'decision';
type ConsentCategory = 'journal' | 'tasks' | 'habits' | 'mood' | 'planner' | 'voice' | 'decisions';

interface JournalEntry { id; title; body; tags: string[]; mood?: 1|2|3|4|5; energy?: 1|2|3|4|5; createdAt; }
interface Fact {           // candidate or approved knowledge about the student
  id; kind: FactKind; text: string; category: Category;
  data: Record<string, unknown>;      // structured payload, e.g. {due, estHours}
  sourceId: string; sourceType: 'journal'|'question'|'manual';
  status: 'pending'|'approved'|'rejected'; confidence: number; // 0-1 extractor confidence
}
interface Task { id; title; category: Category; dueAt?: string; estHours: number; actualHours?: number; done: boolean; goalId?: string; completedAt?: string; }
interface Goal { id; title; category: Category; targetDate?: string; progress: number; /* 0-1 */ }
interface Habit { id; title; category: Category; log: Record<string /*YYYY-MM-DD*/, boolean>; }
interface CheckIn { id; date: string; mood: 1|2|3|4|5; energy: 1|2|3|4|5; }
interface PlanItem { id; title; category: Category; start: string; end: string; goalId?: string; }
interface Decision { id; prompt: string; scenarios: Scenario[]; recommendedId: string; predictedChoiceId: string; userChoice?: 'accept'|'reject'|'modify'; chosenScenarioId?: string; createdAt: string; }
interface Scenario { id; label: string; summary: string; onTimeProb: number; peakLoad: number; goalImpact: number; assumptions: string[]; }
interface ConsentSettings { [k in ConsentCategory]: boolean }
interface TwinState { confidenceByDomain: Record<string, number>; loadPct: number; habitConsistency: number; goalAlignment: number; estimationBias: Record<Category, number>; heatmap: number[][]; /*7x24*/ fidelity: number; updatedAt: string; }
```

## 8. Data layer contract (for Frank)

The UI must NEVER call storage or network directly. Use one interface, `src/lib/data/DataService.ts`,
with two implementations: `LocalDataService` (localStorage, now) and `ApiDataService` (Frank, later).

```ts
interface DataService {
  // CRUD (list/get/upsert/remove) for: entries, facts, tasks, goals, habits, checkins, planItems, decisions
  // consent
  getConsent(): Promise<ConsentSettings>; setConsent(c: ConsentSettings): Promise<void>;
  // twin
  getTwinState(): Promise<TwinState>;                 // derived (see 9)
  // AI (server-side, OpenRouter)
  extractFacts(input: { text: string; source: 'journal'|'question'; sourceId: string }): Promise<Fact[]>;
  nextQuestions(): Promise<{ id: string; text: string; domain: string }[]>;
  proposeScenarios(prompt: string): Promise<Scenario[]>;    // LLM parses, code simulates
  explain(decisionId: string): Promise<{ text: string; usedFactIds: string[] }>;
  previewPayload(kind: 'extract'|'scenarios'|'explain', input: unknown): Promise<{ categories: ConsentCategory[]; text: string }>;
  // seed
  loadSampleData(): Promise<void>; resetAll(): Promise<void>;
}
```
Suggested REST for Frank: `POST /api/extract`, `POST /api/questions/next`, `POST /api/scenarios`,
`POST /api/explain`, `POST /api/payload-preview`, plus CRUD under `/api/{entity}`. Until then,
`LocalDataService` returns realistic canned AI responses (from a `mock/` folder) so the UI works
offline and in a demo with no network.

## 9. Twin logic (deterministic, plain TS — `src/lib/twin/`)

9.1 **Heatmap:** 7x24 grid; weight completed tasks/focus time by weekday and hour; normalise 0-1.
9.2 **Estimation bias:** per category, mean(actualHours / estHours) over completed tasks
(default 1.0 if < 3 samples).
9.3 **Load:** open task hours due in the next 7 days x bias / available hours (default 4h/day).
9.4 **Habit consistency:** completed / expected over last 14 days.
9.5 **Goal alignment:** share of last-7-day completed task hours attached to a goal.
9.6 **Confidence per domain** (tasks, habits, routines, mood, goals, planner):
`min(1, observations / target)` with targets like 12 tasks, 14 habit-days, 10 check-ins.
The **Twin Questions** feature asks about the lowest-confidence domain first.
9.7 **Simulation:** for each scenario, take the task hours it implies, resample the student's
own `actual/est` ratios (or a lognormal fit if few), run ~500 trials against available time
before each deadline; output on-time probability, peak load, goal impact. LLM only parses the
"what if" text into a structured scenario spec `{ tasks: [...], hoursShift: [...] }` and later
phrases the explanation.
9.8 **Prediction + Fidelity:** before showing the recommendation, predict which scenario the
student will pick (simple rule/logistic on past choices: past accept rate for
"deadline-first" vs "rest/health-first", etc.). After the choice, record hit/miss. **Fidelity
Score** = rolling accuracy over last N decisions (show N, e.g. "7 of 10"), with the honest
label "twin's guess vs your actual choice".
9.9 **Conflicts:** if a newer approved fact contradicts an older one (same kind + subject),
show a "changed" chip and prefer the newer; keep the old in history.
9.10 **Missing info:** if a scenario needs data the twin lacks (e.g. no estimate), it says so
and asks one focused question instead of inventing values.

## 10. LLM contracts (OpenRouter, server-side only)

- OpenAI-compatible chat API. Model set via env `OPENROUTER_MODEL`, fallback model via
  `OPENROUTER_FALLBACK_MODEL`. Choose fast, inexpensive models that follow JSON instructions;
  check current availability/limits on OpenRouter. Timeouts 15s; on failure return cached
  mock response and set `degraded: true`.
- **Extract prompt:** input journal text; output ONLY JSON `{ facts: [{kind, text, category,
  data, confidence}] }`. Rules: extract only what the text states, no guessing, no emotional or
  clinical interpretation, no diagnoses; dates relative to `today` supplied in the prompt.
- **Scenario prompt:** convert a "what if" into two structured scenarios; do not compute
  probabilities in the LLM.
- **Explain prompt:** given computed numbers + used fact texts, write 3-4 plain sentences and
  list which facts were used. Never invent numbers.
- Send only fields from categories the student allowed. Log the exact payload for the Ledger
  preview.

## 11. Seed data (sample student)

Create `src/mock/sample.ts` with about 3-4 weeks of data for a fictional, clearly labelled
sample student (name is a placeholder such as "Asha (sample)"): ~25 tasks with est/actual (bias
about 1.3x on study tasks), 5 habits with realistic streaks, ~14 check-ins, 8-10 journal
entries, 3 goals, an upcoming exam and a project deadline within the next 4 days, 6 past
decisions with accept/reject history so Fidelity starts near 60% and can climb during the demo.

## 12. Build order & prompts for Claude Code

Do these in order; commit after each. Keep the app runnable at every step.

1. **Scaffold:** Next.js + TS, plain CSS only (no Tailwind/UI kits/chart libs). Design tokens
   from `docs/DESIGN_SYSTEM.md` in `styles.css` (fonts, colours, shared classes). Layout
   shell with left rail and top bar. Commit.
2. **Types + DataService + LocalDataService + sample data.** Twin logic functions (section 9)
   with a few unit tests for bias, load, simulation. Commit.
3. **Twin Home** with the Twin Bloom, rings, heatmap, timeline, risk list, Fidelity chip. Use
   sample data. Spend real effort on polish here; this is the first impression. Commit.
4. **Journal + extraction flow** using canned extraction from mock, approve/reject cards,
   approve animation that updates Twin Home. Commit.
5. **Simulate** screen with branching timeline, recommendation, Accept/Modify/Reject, and
   Fidelity update. Commit.
6. **Consent Ledger** with toggles and payload preview; toggles must actually filter data used
   by extraction/simulation. Commit.
7. **P1 screens:** monthly planner, habits & tasks, check-in strip, Twin Questions. Commit each.
8. **Voice + P2:** voice speak-back and dictation (section 6b) as soon as Ask works; then the yearly timeline. Audio journal is CUT. Commit each.
9. **Integration with Frank:** swap `LocalDataService` for `ApiDataService` behind an env flag.
10. **Polish & demo prep:** empty states, loading skeletons, reduced-motion, responsive check
    on a laptop screen and projector contrast, README with run steps, demo script rehearsal,
    backup screen recording.

Example first prompt to give Claude Code:
> Read CLAUDE.md and docs/HANDOFF.md. Execute build steps 1 and 2 only. Show me the folder
> structure and how to run it. Do not start screens yet.

## 13. Demo script (3 minutes)

1. (20s) Open Twin Home. "This is Asha's twin (sample data). It's a model built from what she
   permitted, not a chat history." Point at the Twin Bloom, heatmap, load.
2. (40s) Journal: type/paste a short entry mentioning a deadline, a study habit, a preference.
   Analyze -> fact cards -> approve two, reject one. Cards fly into the twin; visuals move.
3. (60s) Simulate: "What if I finish the project tonight instead of revising for tomorrow's
   exam?" Show branches, probabilities from her own history (estimation bias), recommendation,
   and "Why this?" provenance. The twin's predicted choice is revealed after she decides.
4. (20s) Accept/modify -> Fidelity Score ticks up.
5. (20s) Ledger: toggle journal off, show payload preview shrink. Say clearly what leaves the
   device (text sent to a hosted model) and that no audio is stored (voice input may use the browser's speech service).
6. (20s) Close: "Not perfect prediction — an explainable, improving model of you."

## 14. Definition of done

- P0 flow works end to end offline with sample data, and with the real API if available.
- No console errors; app usable on a laptop screen; no secrets committed.
- README explains how to run, states this is a new from-scratch build, and lists implemented
  vs planned features honestly.
- Demo rehearsed 3 times; backup video recorded.
