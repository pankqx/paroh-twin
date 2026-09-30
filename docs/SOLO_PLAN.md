> **SUPERSEDED by `docs/NIGHT_PLAN.md`.** Do not follow this file. Its scope cuts (planners,
> habits/tasks screens, Twin Questions), its "plain CSS / no animation libraries" stance and its
> timeline are replaced. Kept only as history.

# Paroh — Solo Plan (one builder, deadline 08:00 on 1 Oct)

This REPLACES `TEAM_PLAN.md`. HANDOFF.md and DESIGN_SYSTEM.md still apply, except where this
file cuts scope. Hours below are relative to "now" (H0); the deadline is about H13.

## Scope (solo)

**MUST (the demo):**
1. Welcome/consent card + Navbar + design tokens.
2. **Twin** page: Twin Bloom, 3 stats, focus-hours heatmap, deadlines with risk, goals, memory
   timeline (all from sample data + live twin state).
3. **Journal -> Approvals:** extraction cards, approve/reject, Bloom grows.
4. **Ask:** what-if -> two scenarios (real simulation) -> fork -> recommendation -> Accept /
   Change / Reject -> prediction reveal -> Fidelity updates -> **AI speaks the recommendation**.
5. **Privacy:** consent toggles that actually filter data + "what would be sent" preview.

**CUT (list as "planned" in the README, do not build):** monthly planner, yearly planner,
habits & tasks screens, Twin Questions, mood strip, audio journal. Habits, tasks and deadlines
still exist as SAMPLE DATA that feed the Twin page and the simulation.

## Architecture simplifications
- One Next.js app. Two API routes only: `POST /api/extract` and `POST /api/explain`
  (OpenRouter, server-side). Scenarios and simulation run client-side in plain TypeScript.
- Everything works in **canned mode** (no network, cached responses) FIRST. Real OpenRouter is
  added afterwards behind the same functions, with fallback to canned on any error/timeout.
- Persistence: localStorage only. No database.
- Deploy to Vercel in the first hour and redeploy often.

## Use two AI agents like a two-person team
You have Claude Code and Codex. Run them in parallel on separate folders and separate git
branches (merge often):
- **Agent A (Claude Code): UI.** `src/app/**`, `src/components/**`, `styles.css`.
- **Agent B (Codex or a second Claude session): engine.** `src/lib/twin/**`,
  `src/lib/data/**`, `src/mock/**`, `src/app/api/**`, `src/lib/voice/**`, with unit tests.
Agree the interfaces first (`types.ts`, `DataService.ts`) by asking ONE agent to write them,
then freeze. Review every merge yourself and run the app before moving on.

## Timeline
| Hours | Work |
| --- | --- |
| H0-1 | Scaffold, tokens/styles.css, navbar, Welcome card, `types.ts`, `DataService`, sample data. Push. Deploy empty app to Vercel. |
| H1-3 | A: Twin page + TwinBloom + heatmap + lists. B: twin functions (bias, load, heatmap, confidence, Monte Carlo, prediction/fidelity) + tests. |
| H3-5 | A: Journal + Approvals + approve animation. B: canned extraction, DataService wiring, `speak.ts` voice module. |
| H5-8 | A: Ask page (scenarios, fork, recommendation, choice, fidelity, Read aloud). B: connect engine to UI, fix bugs. |
| H8-9.5 | Real OpenRouter for extract + explain with fallback; payload preview. |
| H9.5-10.5 | Privacy page with real filtering. |
| **H10.5** | **FEATURE FREEZE** |
| H10.5-12 | Polish, zoom/contrast check, README (honest implemented vs planned), production deploy, smoke test on the live link. |
| H12-13 | Record backup demo video (2 takes), rehearse, submit with a 30-minute buffer. |

Take a 15-minute break every few hours. Tired mistakes cost more than the break.

## If you fall behind
1. Drop real OpenRouter and ship canned mode (label it honestly in the README and UI).
2. Drop heatmap detail (use a simpler bar row).
3. Never drop: Twin page, Journal->Approvals, Ask with the fork and voice, working deploy.

## README must say
- Built from scratch during GATEWAYS 2026 in this repo; inspired by an earlier concept, no
  code or assets reused.
- Implemented now vs planned (planner, habits/tasks screens, twin questions).
- Hosted LLM via OpenRouter when available, with a canned offline mode; a payload preview shows
  what is sent; no audio stored; browser voice input may use the browser's speech service.
- Sample student data; the twin is an explainable approximation, not a perfect predictor.
