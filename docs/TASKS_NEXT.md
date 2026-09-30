# Paroh: what is left (1 Oct, ~04:00). Paste ONE prompt at a time.

## 0. Get the latest code onto your machine (do this first)
Everything I built is on the GitHub branch `avatar`. Your folder will keep showing old pages
until you switch to it.

```
# 1. stop every running dev server
pkill -f "next dev"; lsof -i :3100        # should print nothing

# 2. save anything you already changed locally (so nothing is lost)
cd ~/paroh-twin && git status
git add -A && git commit -m "local work before sync"
git push origin HEAD:local-ui             # backup branch on GitHub

# 3. get my branch and run it
git fetch origin && git checkout avatar && git pull
rm -rf .next && npm install && npm run dev -- -p 3100
```
Then hard-reload (Ctrl+Shift+R). Old sample data still showing? DevTools, Application,
Storage, "Clear site data" (Paroh keeps its data in the browser's localStorage).
If an old page still appears, a second copy of the project is serving port 3100:
`lsof -i :3100` then `pwdx <pid>` shows which folder it runs from.

## Codex (engine: src/lib, src/mock, src/app/api). Commit each prompt separately.

**A. What-if understanding.** Add POST /api/parse-whatif (OpenRouter JSON, 12 s timeout, main
then fallback model, canned fallback with degraded:true, same helper as /api/extract). Input: the
student's typed or spoken sentence plus buildTwinContext(consent). Output: {scenarios:[{label,
tasks/hours}], clarify?: string}. If the sentence is vague, return ONE short clarifying question
instead of scenarios. Add DataService.parseWhatIf(text) that calls it, then feeds the result to the
existing proposeScenarios/simulate (math stays in TypeScript). Unit-test the canned fallback.

**B. Memory quality.** In src/lib/twin add pure functions with tests:
detectConflicts(facts) (e.g. "works best morning" vs "works best evening"),
staleFacts(facts, now) (older than 30 days and never re-confirmed),
retrieveRelevant(facts, question, k) (keyword and domain scoring, no embeddings) and
privacyBoundary(facts, consent) (drops categories that are switched off). Expose them on
DataService: getConflicts(), getStale(), retrieve(question). Use retrieve() inside
buildTwinContext so prompts only carry relevant approved facts.

**C. Insights and connectors (sample only).** Add insights(twinState, tasks, habits,
checkins): pure function returning 3 to 5 plain statements with numbers (estimation bias, best
focus hours from the heatmap, habit streak risk). Add predictedNeeds(): tomorrow's likely needs from
deadlines and habits. Add feedbackDelta(decisions): how fidelity changed after the last 5 accept/
change/reject answers. Add src/mock/connectorSamples.ts (Gmail, WhatsApp, Telegram, Calendar) and
DataService.previewConnector(id) that runs sample messages through extractFacts as CANDIDATES
(never auto-approved), clearly labelled "sample messages".

**D. Memory graph data.** Add buildMemoryGraph(facts, tasks, goals, habits): returns
{nodes:[{id,label,kind,weight}], links:[{source,target}]} where facts link to their domain, to
matching tasks/goals/habits (shared keywords) and to each other when they share a keyword. Pure
TypeScript with a test. Expose DataService.getMemoryGraph().

## Claude Code (UI: src/app, src/components, src/styles). Commit each separately.

**E. Merge and clean up.** `git merge avatar` into your current branch; if Talk or Home conflict,
keep the avatar branch version of TwinAvatar, the Talk layout (chat history and input left, her in the
centre, details right) and the Home half-body avatar, and keep your newer features (twin picker,
"How well she knows you") by moving them into the RIGHT column. Remove every ring, dotted arc and
tick ring behind her on Home and Talk; the stage behind her stays plain dark with a few slow drifting
light particles (transform and opacity only, reduced motion respected).

**F. Ask screen.** On Ask, show the clarifying question from DataService.parseWhatIf when it
returns one (answerable by voice or chips), then the fork, the spoken recommendation, and an
"After your feedback" panel using feedbackDelta(). Show conflicts/stale facts from getConflicts() and
getStale() as small resolvable chips.

**G. Sources.** Each roadmap connector (Gmail, WhatsApp, Telegram, Calendar) gets a "Preview with
sample messages" button that calls previewConnector(id) and lists the candidate facts going to the
Approvals tray, plus a banner "sample messages, real connectors are roadmap".

**H. Memory graph (Obsidian-style).** New page /memory (add to Navbar): a force-directed graph,
custom SVG + motion, no libraries, using DataService.getMemoryGraph(). Nodes glow by kind
(fact, domain, task, goal, habit), drag to move, hover highlights neighbours, click a fact to open a
side panel with its text, source, confidence and an Edit/Reject action. Simple spring simulation in a
requestAnimationFrame loop, stop it when settled, reduced motion = static layout.

## Codex, extra: use an OpenAI key instead of OpenRouter

**I. Provider switch.** In the shared LLM helper used by /api/extract, /api/explain (and the new
routes) read `LLM_BASE_URL` (default `https://openrouter.ai/api/v1`), `LLM_API_KEY` (falls back to
`OPENROUTER_API_KEY`), `LLM_MODEL` and `LLM_FALLBACK_MODEL` (fall back to the OPENROUTER_* names).
Keep the OpenAI-compatible `/chat/completions` call, the 12 s timeout and the canned fallback. Update
`.env.example` and `check:ai`. For OpenAI: LLM_BASE_URL=https://api.openai.com/v1, LLM_MODEL=gpt-4o-mini,
LLM_FALLBACK_MODEL=gpt-4.1-mini. Server code only; never log the key. README/Sources wording must say
"hosted model (OpenAI)" when that provider is used.

## Done by Claude on branch `avatar` (1 Oct ~04:30)
Talk: chat history large on the left with the input under it, quick-reply chips removed, her bigger in
the middle, details on the right. Home: full-width stage, bigger half-body twin, side cards on wide
screens. Home to Talk uses a shared view-transition (the twin morphs), then blooms into colour.

## Claude Code: motion pass and smooth Home to Talk (paste as one prompt)

**J. Motion and transition.** Read docs/DESIGN_SYSTEM.md first. On the Talk and Home pages only
(src/components/TalkStage, TwinHome, TwinAvatar), using `motion` and CSS (transform and opacity only,
honour prefers-reduced-motion, one heavy effect per screen):
1. Smooth Home to Talk: the twin already shares `<ViewTransition name="twin" share="morph">` between
   the two pages. Make it feel seamless: add `::view-transition-group(.morph){animation-duration:700ms;
   animation-timing-function:cubic-bezier(.2,.7,.2,1)}` in globals.css, fade the Talk page panels
   (chat, details) in 300 ms AFTER the morph ends (stagger 80 ms), start the colour bloom when the morph
   ends (not on a fixed timer) and fade the Home side cards and chips out on click. Test in Chrome.
2. Talk stage life: behind her, a slow aurora wash (reuse fx/Aurora) and 20 to 30 tiny drifting light
   particles (opacity and translate only); a soft pulse glow under her that swells with her voice level
   when she speaks; chat bubbles slide and fade in; the active question types in word by word; the Approve
   card springs in with a slight overshoot and a spark burst where it flies to her mind point.
3. Home life: stars twinkle on staggered delays, the constellation lines draw on once at load, the bubble
   and chips float gently, the stat numbers count up once.
Do not change the engine or data flow. Run `npm run build`, then commit.
