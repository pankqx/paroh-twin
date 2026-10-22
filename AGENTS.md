# Paroh project rules (read first)

Read `docs/CLAUDE.md` (hard rules), `docs/NIGHT_PLAN.md` (the plan; decisions are locked) and
`docs/DESIGN_SYSTEM.md` (the only visual reference: "Night Garden / Orbit", `motion` + five
approved React Bits) before coding. Older docs are superseded where they disagree. Do not
rewrite or delete the engine in `src/lib/`; the UI talks only to `DataService`.

Humans who want to understand the whole project from zero (stack, files, flows, maths, interview prep):
read [`GUIDE.md`](GUIDE.md).

## Map

```
src/app/                 Next.js App Router pages: / (Twin), talk, journal, approvals, memory, ask, rhythm, pulse, sources, plan, welcome
src/app/api/*/route.ts   server routes: extract, converse, parse-whatif, explain (LLM with rule fallback), visits (counter)
src/app/dataService.ts   the single DataService instance the UI uses
src/lib/types.ts         data model: JournalEntry, Fact, Task, Goal, Habit, CheckIn, Decision, MemoryItem, ConsentSettings
src/lib/data/            DataService interface + LocalDataService (localStorage, consent, approval -> structured data)
src/lib/twin/            the engine (pure TS): load, bias, heatmap, habits, twin state, scenarios (Monte Carlo), memory, graph, insights
src/lib/ai/              openRouter.ts (server-only fetch + model fallback), buildTwinContext, relevantFacts, extractCanned (rules)
src/lib/voice/           listen.ts (Web Speech recognition), speak.ts (speech synthesis)
src/mock/                labelled sample student "Pankaj (sample)" and connector samples
src/components/          UI components (design system in docs/DESIGN_SYSTEM.md)
```

## Commands

```bash
npm install
npm run dev        # http://localhost:3000 (Chrome for voice)
npm test           # vitest: engine, data service, AI fallbacks, routes
npm run lint
npm run build
npm run check:ai   # verifies OpenRouter settings from .env.local
```

## Invariants

- Nothing becomes twin knowledge without explicit approval (the consent gate). Keep every source behind it.
- Every API route must work with no API key: it falls back to local rules and returns `degraded: true`.
- `OPENROUTER_API_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_` or send it to the client.
- Extracted fact `text` must be an exact quote from the input (no interpretation, no mental-health content).
- Only data from consented categories may be sent to the model (`buildTwinContext`).
- Commit as `pankqx <pankqx@gmail.com>`. Do not add `Co-Authored-By` or any AI trailer.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
