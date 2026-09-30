# Paroh — HumanTwin AI (GATEWAYS 2026 hackathon build)

Read `docs/NIGHT_PLAN.md` (the plan and decisions), `docs/DESIGN_SYSTEM.md` (the ONLY visual
reference) and then `docs/HANDOFF.md` sections 1-3 and 7-11 (product, guardrails, data model,
twin logic, LLM contracts, seed data). Where older docs disagree, NIGHT_PLAN and
DESIGN_SYSTEM win.

## What this is
Paroh is a personal digital twin for STUDENTS: a productivity and lifestyle decision-support
product. A **voice assistant is the core**: the twin asks questions aloud, answers and
journal entries become candidate facts, the student approves them, and the twin shows what it
learned as a living visual model. It simulates "what if" choices, speaks its recommendation,
and learns from accept/change/reject feedback.

## Hard rules
1. Built from scratch during the hackathon in this repo. Do NOT copy code, docs, design files
   or assets from any other project.
2. NOT a therapist or mental-health product. No "healing", "anxiety", "therapy", "diagnosis"
   wording in UI copy or prompts. Mood/energy is a 1-5 check-in for planning patterns only.
3. Consent first: per-category toggles; facts need approval before entering the twin; a
   "what is sent to the model" preview before any LLM call.
4. No audio is recorded or stored. Browser speech input may use the vendor's cloud speech
   service; disclose it on the Sources/Privacy screen.
5. Never claim perfect prediction or "fully local". The LLM is a hosted model via OpenRouter.
   Monitoring/notifications run on sample data; connectors (Gmail, WhatsApp, Telegram,
   Calendar) are roadmap only.
6. Demo uses the clearly labelled SAMPLE student "Asha".
7. OpenRouter is called only from server code; key in `.env.local` (git-ignored), never in
   client code. This repo is PUBLIC: never commit secrets. Keep `.env.example` updated.
8. Simulation and pattern math are plain TypeScript, not LLM output.
9. The UI reads and writes data only through the `DataService` interface. Do not rewrite or
   delete the engine in `src/lib/`.

## Stack
Next.js (App Router) + TypeScript, plain CSS tokens, **`motion` (Framer Motion)** and the five
approved React Bits components (TS+CSS variants) in `src/components/fx/`. No Tailwind, UI
kits, chart libraries or icon libraries. Charts, graph, wheel, heatmap and fork are custom SVG.
localStorage for persistence. Browser `SpeechRecognition` for dictation and `speechSynthesis`
for the AI speaking back.

## Working style
- Follow the ownership split in NIGHT_PLAN section 4. Commit after every screen/feature.
- One flawless end-to-end loop beats many half-working screens. Keep the app runnable.
- Motion: only `transform`/`opacity`, one heavy effect per screen, honour reduced motion.
