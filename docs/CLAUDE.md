# Paroh — HumanTwin AI (GATEWAYS 2026 hackathon build)

Read `docs/HANDOFF.md` (product, scope, data model, twin logic, voice, build order),
`docs/DESIGN_SYSTEM.md` (the ONLY visual reference) and `docs/TEAM_PLAN.md` before coding.
This file is the short rule set.

## What this is
Paroh is a personal digital twin for STUDENTS: a productivity and lifestyle decision-support
product. The student journals, plans, tracks habits/tasks/energy, and answers the twin's
questions. Everything shared becomes structured, approved facts shown visually as a living
"Twin Bloom". The twin simulates "what if" choices, speaks its recommendation aloud, and
learns from accept/change/reject feedback.

## Hard rules
1. Built from scratch during the hackathon in this repo. Do NOT copy code, docs, design files
   or assets from any other project (including the author's earlier projects). Reference
   screenshots are mood only.
2. NOT a therapist or mental-health product. No "healing", "anxiety", "therapy", "diagnosis"
   wording in UI copy or prompts. Mood is a simple 1-5 energy/mood check-in for productivity
   patterns only.
3. Consent first: per-category toggles; extracted facts need approval before entering the
   twin; a "what is sent to the model" preview before any LLM call.
4. We do not record or store audio. Voice input uses the browser speech API, which in Chrome
   typically uses the browser vendor's cloud speech service; disclose this on the Privacy page.
5. Never claim perfect prediction or "fully local". Show confidence and the Twin Fidelity Score
   honestly. The LLM is a hosted model via OpenRouter.
6. Demo runs on a clearly labelled SAMPLE student persona.
7. OpenRouter is called only from server code; key in `.env.local` (git-ignored), never in
   client code. This repo is PUBLIC: never commit secrets. Commit `.env.example`.
8. Simulation and pattern math are plain TypeScript, not LLM output.
9. Frontend reads/writes data only through the `DataService` interface.

## Stack
Next.js (App Router) + TypeScript. **Plain CSS only** following `docs/DESIGN_SYSTEM.md`
(no Tailwind, shadcn, UI kits, icon libraries, chart libraries, or animation libraries).
Charts and the Twin Bloom are hand-written SVG. localStorage for local persistence. Browser
SpeechRecognition for dictation and `speechSynthesis` for the AI speaking back.

## Working style
- Build the frontend with sample data first so something demo-able always exists.
- Commit after every screen/feature with clear messages (history = proof of from-scratch work).
- One flawless end-to-end flow beats many half-working features.
- UI quality is the priority: quiet, warm, spacious, paper-ledger look; slow subtle motion.
