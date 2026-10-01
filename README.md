# Paroh: a digital twin for students

**GATEWAYS 2026 · Team http dino · Domain 3, Personal Productivity & Lifestyle · "HumanTwin AI: The Intelligent Digital Twin of a Person"**

Team: Frank Ndagula (Developer) · Merel Riha D souza (Ideation) · Siddharth Bhat (Front end) · K S Pankaj (Research)

Paroh builds an explainable model of a student from what they choose to share. The twin asks
questions out loud, turns the answers and journal entries into **candidate facts**, and the student
**approves** each one before the twin learns it. The twin then shows what it knows as a living
picture, simulates "what if" choices with real numbers, speaks its recommendation, and learns from
the student's feedback.

Built from scratch during the hackathon. Demo data belongs to the labelled sample student
**"Frank (sample)"**. Paroh is a planning and productivity tool, **not** a therapy or mental-health
product, and it does **not** claim perfect prediction.

Live demo: https://paroh-twin-git-main-mass-dcca.vercel.app (use Chrome for voice)

---

## 1. The loop (what the demo shows)

```
data sources ─► extract facts ─► you approve (consent gate) ─► twin state (visual)
     ▲                                                              │
     └──── feedback (accept / change / reject) ◄── spoken recommendation ◄── what-if simulation
```

Every source (voice, journal, sample connectors) ends at the same approval gate.

## 2. Screens

| Screen | What you see | What it proves |
|---|---|---|
| **Twin** (`/`) | Line-art twin who mouths her speech bubble, stars around her (one per approved fact, grouped by kind), weekly load, habit consistency, goal-linked work, "twin's guess vs your choice" with fidelity, focus-hours heatmap, upcoming deadlines, "How well she knows you". **"What am I looking at?"** explains every visual and its data source. | It is a living model of the student, built only from consented data. |
| **Talk** (`/talk`) | Two ways to talk: **Guided questions** (she asks about her least-known area) or **Free talk, a voice journal** (talk naturally for as long as you like; your words are saved as a journal entry, she replies and picks out what is worth remembering as fact cards). Opening Talk morphs the line-art twin into a coloured, animated character. She waves, asks the question about her least-known area aloud, and listens until you stop (tap the mic or press **Space**, **Esc** cancels). The answer becomes a fact card; **Approve** sends it flying into her mind point and she celebrates. Chat history and the mic are on the right, details on the left. | Voice-first data collection with consent. |
| **Journal** (`/journal`) + **Approvals** | Write an entry (or dictate it); facts are extracted and wait in the Approvals tray. On the right, **Your journal** lists every previous entry, newest first, with tabs for All, Voice (from Talk's free-talk mode) and Written; open one to read it, see which facts came from it (learned, waiting, not me) and reopen it in the editor. The sample includes three voice journals. | A second data source behind the same gate. |
| **Memory** (`/memory`) | Obsidian-style graph: facts linked to domains, tasks, goals and habits. Drag nodes, hover to see neighbours, click a fact to edit or reject it. | The twin's memory is visible and editable. |
| **Ask** (`/ask`) | Type or speak a what-if ("What if I go to the fest tonight?"). The twin asks one clarifying question if needed, simulates both paths, shows on-time probability and load, speaks a recommendation and which facts it used. Accept / change / reject updates fidelity ("After your feedback"). Conflicting or stale facts appear as chips. | Decision support from the student's own history, with feedback. |
| **Rhythm** (`/rhythm`) | Habit chains (tap a day to tick), streaks and 14-day rings; a 1 to 5 energy and mood check-in with a 14-day ribbon; estimate vs actual hours per task and the estimate multiplier the simulation uses; mark open tasks done with real hours. | The personal statistics the twin tailors to. |
| **Pulse** (`/pulse`) | Re-scans every 30 s while the tab is open: load spikes, deadline risk (same simulation as Ask), streaks at risk, plus calm notes with on-time odds. "Turn into a what-if" pre-fills Ask; "Say it" reads it aloud. Insights and "tomorrow you will probably need". | Monitoring and proactive notifications (sample data). |
| **Sources** (`/sources`) | Live sources (Voice, Journal) vs roadmap connectors (Gmail, WhatsApp, Telegram, Calendar) with "Preview with sample messages"; per-category consent toggles; **"What is sent to the model"** payload preview that shrinks when a category is switched off; twin appearance and voice; delete all data. | Trust, privacy and the roadmap. |
| **Plan** (`/plan`) | Month calendar (category dots, goal stars, habit rings, hours-due bars, heavy days flagged, click a day to see it or add a task) and a year wheel (months, finished work on the rim, goal arcs with progress, deadline pins, today; click a month to open it). | Visual planning built from the same data. |

Detailed use cases: [`docs/USE_CASES.md`](docs/USE_CASES.md).

### Free talk: a voice journal

On **Talk**, choose **Free talk · voice journal** and speak naturally, for as long as you like:

1. Press **Space** (or tap the mic) to start and again to stop; pauses are fine and your words appear live.
2. Your words are saved as a **journal entry** (tagged "voice" on the Journal page). Only text is kept; **no audio is recorded or stored**.
3. Paroh picks out what is worth remembering (deadlines, tasks, habits, goals, preferences) as **fact cards** for you to approve; approved facts update the dashboard exactly as described above.
4. The twin **replies conversationally** (`/api/converse`, hosted model, with a simple local reply if the model is unavailable) and asks a follow-up, so the conversation keeps going.
5. If what you said is a decision, she points you to **Ask** to compare the paths. You can switch back to guided questions at any time.

### How what you tell the twin changes the dashboard

Every answer goes through the same path, and each step is visible:

1. **You say or write something** (Talk, Journal, or a sample connector preview). Example: *"I need to finish my chemistry lab report, about 3 hours."*
2. **It becomes a candidate fact** (`/api/extract`: the hosted model, or Paroh's own rules if the model is slow or finds nothing). Kind: task, deadline, goal, habit, routine, preference or decision.
3. **You approve it** (Talk card, Approvals tray). Nothing changes before this.
4. **Approval writes structured data**: a task or deadline fact becomes a real task in the planner (due this week if you gave no date, with your hours or 1.5 h), a goal fact becomes a goal with its horizon ("I want to be a ... in the next 2 years" → target two years out, shown as an arc on the Plan year wheel; "by 2028", "within six months", "next year" also work; no horizon → one year), a habit fact becomes a tracked habit; every approved fact becomes a star and a memory.
5. **Every number is recomputed from that data** (TypeScript, `src/lib/twin`), so the dashboard moves: weekly load, Coming up, the star count, "How well she knows you", Plan, Pulse and the what-if odds.
6. **The Twin page tells you what moved.** A "What changed since you last taught her" card lists it, for the example above: *Stars 0 → 1 · new task in the planner · weekly load 30% → 41% · how well she knows your planner 58% → 67%*.
7. **She asks something new next time.** Areas you already answered move to the back and get a fresh question, so she does not repeat herself.

### Every widget, and how it is computed

| Widget (Twin page) | Computed from | Formula |
|---|---|---|
| Stars around the twin | Approved facts | One star per approved fact, grouped by kind |
| Weekly load | Open tasks due in the next 7 days | Hours due per day ÷ 4 free hours per day |
| Habit consistency | Habit check-ins, last 14 days | Share of habits ticked per day |
| Goal-linked work | Tasks finished in the last 7 days | Hours on tasks linked to a goal ÷ all hours finished |
| Twin's guess vs your choice, fidelity | Decisions in Ask | How often the twin's predicted choice matched yours (last 5) |
| Focus hours heatmap | Finished task times | When finished work happens, by weekday and hour |
| Coming up | Open tasks with a due date | Grouped by day, with on-time odds from the simulation |
| How well she knows you | Approved facts and data per area | Confidence per area (tasks, habits, routines, energy, goals, planner) |
| What-if odds (Ask, Pulse) | Open tasks, your real actual/estimate hour ratios | 500 seeded trials; a plan succeeds when each task fits before its deadline in order |

### Where the data lives

- All of a student's data (facts, tasks, goals, habits, check-ins, decisions, consent) is stored **in their own browser** (localStorage key `paroh-local-data-v1`), behind one `DataService` interface. Nothing is stored on our server and there are no accounts.
- On the first visit in a browser, it starts with the labelled sample student Frank. After that, every change persists in that browser across visits. A different browser or device starts from the sample again; **Sources → Delete all my data** resets it.
- Only the text needed for a request (plus consented, relevant approved facts, shown in the payload preview) is sent to the hosted model, from our server route, and nothing is kept there.
- Because the UI only talks to `DataService`, a server database with accounts (for example a graph database for memory) can replace browser storage without changing the screens. That is on the roadmap.


## 3. Three-minute demo script

1. **Twin (20 s).** "This is Frank's twin, on sample data. It is a model of what he permitted, not a chat history." Click *What am I looking at?*.
2. **Talk (50 s).** Click *Talk to your twin*: she morphs into colour and waves. Choose *Free talk · voice journal*, press Space, talk naturally about your day, press Space. She replies, saves it as a journal entry and shows fact cards. Approve one: it flies into her and *Learned today* grows.
3. **Memory / Rhythm (20 s).** The new fact in the graph; habits and the "study takes 1.3x your estimate" multiplier.
4. **Ask (50 s).** Ask by voice: "What if I spend tonight completing my project instead of preparing for tomorrow's exam?" (our Round 1 demo question). Fork, probabilities from his own history, spoken recommendation. Choose the other option: the "After your feedback" panel shows how the twin changed and fidelity moves.
5. **Pulse (15 s).** The twin re-checks the week and whispers; turn one into a what-if.
6. **Sources (20 s).** Toggle a category off: the model payload shrinks. Connectors are roadmap, previewed with sample messages.
7. **Close (5 s).** "Not perfect prediction: an explainable, improving model of you."

## 4. How it meets the brief

| The problem statement asks the solution to... | Where Paroh does it |
|---|---|
| Build an evolving picture of a person from information they chose to share (preferences, routines, goals, past decisions) | Talk, Journal and sample connectors produce candidate facts; only approved facts and consented data feed the twin (Twin page, Memory graph). |
| Understand current context and identify behaviour patterns | Twin state: load, habit consistency, goal alignment, estimation bias, focus-hours heatmap; insights on Pulse; Rhythm. |
| Simulate "what if" scenarios and compare outcomes and risks | Ask: Monte Carlo simulation of each path (on-time probability, peak load, goal impact) with stated assumptions. |
| Give personalised recommendations and improve from feedback | Spoken, explained recommendation citing the facts used; accept / change / reject updates fidelity and the twin's guess of future choices. |
| Give the user clear control over what the twin can access | Consent toggles per category, approve-before-learn, edit or reject any fact, payload preview, delete all data. |
| Demo: a sample person asks a what-if, sees the comparison, the recommendation, and how the twin changes after feedback | Demo script step 4 with sample student Frank. |

### Round 1 architecture, as built
| Round 1 layer | Implementation |
|---|---|
| User interaction (text, voice, dashboard) | Talk (voice + typing), Journal, Ask, Twin dashboard, Rhythm, Pulse |
| Consent and privacy | Sources: per-category toggles, payload preview, approvals tray |
| Personal memory and context | Approved facts, tasks, habits, check-ins, decisions in `DataService`; Memory graph |
| Context and pattern engine | `src/lib/twin` (state, patterns, insights, predicted needs) |
| Scenario and decision engine | `/api/parse-whatif` + TypeScript simulation (`scenarios.ts`) |
| Recommendation and feedback | `/api/explain` (spoken), feedback delta and fidelity |

### Round 1 edge cases, as built
- **Missing information:** the simulation reports what it needs instead of inventing facts; recommendations state their assumptions.
- **Ambiguous what-ifs:** Ask asks one clarifying question before simulating.
- **Conflicting information:** conflicting facts (e.g. "morning" vs "evening") are flagged as chips to resolve; the latest explicit update wins.
- **Stale information:** facts not re-confirmed for 30 days are flagged.
- **Changing circumstances:** a new task, habit or approved fact re-runs the numbers (Pulse rescans on every change; Ask simulates on current data).
- **Privacy boundary:** switched-off categories never reach prompts or patterns.

## 5. How it is built

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router) + TypeScript + React 19 |
| Motion and visuals | `motion` (Framer Motion), plain CSS tokens, custom SVG for the twin, constellation, graph, heatmap, rings, charts. Five React Bits components (Aurora, Orb, CountUp, BlurText, SpotlightCard). No UI kits or chart libraries. |
| Twin character | Hand-built SVG: line-art layer plus colour layers driven by a CSS `--form` variable (0 = line art, 1 = colour), a procedural rig (head, body, arms) animated with `requestAnimationFrame`, lip shapes from the speech engine, view-transition morph from Home to Talk. |
| Engine (`src/lib/`) | Plain TypeScript, unit-tested (Vitest): twin state (load, habit consistency, goal alignment, estimation bias, focus heatmap, confidence per domain, fidelity), Monte Carlo what-if simulation (500 seeded trials using the student's real actual/estimate ratios), insights, predicted needs, pulse whispers, conflict and stale-fact detection, keyword retrieval, memory graph. |
| Data | `DataService` interface; `LocalDataService` stores everything in the browser's localStorage. The UI only talks to `DataService`. |
| AI | Hosted LLM through **OpenRouter**, called only from server routes (`/api/extract`, `/api/explain`, `/api/converse`, `/api/parse-whatif`). 12 s timeout, main model then fallback model, then canned local rules (`degraded: true`), so the demo never breaks. The LLM only structures text and explains; it never produces the numbers. |
| Voice | Browser `SpeechRecognition` for dictation (continuous until you stop) and `speechSynthesis` for her voice (female voice preferred for her look). No audio is recorded or stored by Paroh. |
| Hosting | Vercel. |

### Folder map
```
src/app/          pages and API routes
src/components/   UI (TwinAvatar, TalkStage, TwinHome, AskStage, Rhythm, Pulse, MemoryGraph, Sources, ...)
src/lib/          engine: types, DataService, LocalDataService, twin/, ai/, voice/
src/mock/         sample student data (Frank)
docs/             plan, design system, use cases
```

## 6. Privacy and honesty

- **Consent first:** per-category toggles (journal, tasks and habits, mood and energy, planner). Facts are only candidates until approved; rejected facts never enter the twin.
- **Payload preview:** Sources shows exactly what would be sent to the model; switching a category off removes it.
- **Hosted model:** prompts go to a hosted LLM via OpenRouter, not an on-device model.
- **Voice:** no audio is recorded or stored. Browser speech input may use the browser vendor's cloud speech service (Chrome).
- **Monitoring:** Pulse runs on sample data only while the app is open. Real continuous monitoring needs the connectors (roadmap).
- **Mood and energy** are a 1 to 5 planning check-in, not a health measure.
- **Prediction:** an explainable estimate with a fidelity score, never a promise.

## 7. Implemented vs planned

**Implemented:** voice Q&A with approval, journal extraction, approvals, twin visual model, memory graph, what-if simulation with spoken explanation and feedback, Rhythm (habits, check-ins, estimates), Pulse (monitoring on sample data), Sources with consent and payload preview, sample connector previews, LLM with fallback.

**Planned (roadmap):** real Gmail / WhatsApp / Telegram / Calendar connectors, always-on monitoring and notifications, accounts and cloud sync (a graph database such as Neo4j for memory), on-device small language model, audio journal, month and year planners.

### Changes from our Round 1 proposal (approved by our supervisor)
| Round 1 | Built | Why |
|---|---|---|
| Python backend | TypeScript engine in the Next.js app | One language, one deploy, testable in the time available. |
| Local small language model | Hosted LLM via OpenRouter with local fallback rules | Reliable on any laptop for the demo; the payload preview keeps it transparent. |
| Embeddings for retrieval | Keyword and domain scoring | No extra infrastructure; explainable. |
| Database | Browser localStorage behind a `DataService` interface | Private by default; a server database can replace it without touching the UI. |

## 8. Run it

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
npm test                     # engine unit tests
npm run check:ai             # checks the OpenRouter key and model
```

`.env.local`:
```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=<an OpenRouter model id>
OPENROUTER_FALLBACK_MODEL=<optional second model id>
LLM_BASE_URL=            # optional, defaults to OpenRouter
```
Without a key the app still works on its local rules. Never commit `.env.local`.

**Deploy:** import the repo in Vercel, add the same environment variables, deploy. Use Chrome for voice.
