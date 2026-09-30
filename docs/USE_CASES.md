# Paroh use cases (for judges and the demo)

Sample student: **Asha (sample data)**. Every screen shows only data she allowed and facts she approved.

| # | Use case | Where | What data | What the student sees and gets |
|---|---|---|---|---|
| 1 | Teach the twin by talking | Talk | Voice or typed answers (no audio stored) | The twin asks her weakest area first, turns the answer into a fact card, she approves it, the card flies into the twin, "Learned today" grows. |
| 2 | Teach the twin by journaling | Journal, Approvals | Journal text | Facts are extracted from the entry and wait in Approvals. Nothing enters the model without approval. |
| 3 | See what the twin knows | Twin, Memory | Approved facts, tasks, habits, goals | Stars around the twin (one per approved fact), the memory graph linking facts to tasks, goals and habits; click to edit or reject. |
| 4 | Understand her week | Twin | Sample planner tasks, habit check-ins, finished work | Weekly load vs free hours, habit consistency, goal-linked work, focus-hours heatmap, next deadlines. "What am I looking at?" explains each one. |
| 5 | Decide with a what-if | Ask | Tasks, deadlines, estimation bias, energy | "What if I go to the fest tonight?" The twin asks one clarifying question if needed, simulates both paths in TypeScript (probabilities of finishing on time), speaks a recommendation and explains which facts it used. |
| 6 | Correct the twin | Ask, Memory | Accept / change / reject feedback | Before each decision the twin guesses her choice; the feedback panel shows how fidelity moved. Conflicting or stale facts appear as chips to resolve. |
| 7 | Control privacy | Sources | Consent toggles per category | Switch a category off and the "what is sent to the model" preview shrinks at once. Hosted model via OpenRouter; no audio recorded. |
| 8 | Connect more sources (roadmap) | Sources | Sample Gmail, WhatsApp, Telegram, Calendar messages | "Preview with sample messages" shows the candidate facts a connector would propose; all still go through Approvals. Real connectors are roadmap. |
| 9 | Stay ahead | Pulse | Twin state, tasks, habits | Whispers such as load spikes, deadline risk, a streak at risk (sample data while the app is open). |

## What each Twin-page visual means
- **Stars:** approved facts only, grouped by kind. Count = what the twin has learned.
- **Weekly load:** hours due per day for 7 days / 4 free hours per day.
- **Habit consistency:** share of habits checked in per day over 14 days.
- **Goal-linked work:** hours of finished work tied to a goal, per day over 7 days.
- **Twin's guess vs your choice + fidelity:** how often the twin predicted her actual decision.
- **Focus hours:** when finished work usually happens, by weekday and hour.
- **How well she knows you:** confidence per domain; the twin asks about the lowest one first.

## Honest limits
Hosted LLM (OpenRouter), not on-device. Simulation and statistics are TypeScript, not the LLM. Sample data. Not perfect prediction. Not a therapy product. Connectors and continuous monitoring are roadmap.
