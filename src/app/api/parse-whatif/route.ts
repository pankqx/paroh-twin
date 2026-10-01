import type { Category, ScenarioSpec, Task, TwinData } from "../../../lib/types";
import { buildTwinContext, type TwinContext } from "../../../lib/ai/buildTwinContext";
import { openRouterJson, parseJsonObject } from "../../../lib/ai/openRouter";
import { parseWhatIfCanned } from "../../../lib/twin/scenarios";

export const runtime = "nodejs";

const categories = new Set<Category>(["study", "health", "personal", "career", "other"]);
const priorities = new Set<ScenarioSpec["priority"]>(["deadline", "goal", "rest", "health", "neutral"]);

function safeTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Task => !!item && typeof item === "object" &&
    typeof item.id === "string" && typeof item.title === "string" && typeof item.estHours === "number" &&
    categories.has(item.category as Category) && item.done === false);
}

function validPlans(value: unknown): Array<{ label: string; summary: string; priority: ScenarioSpec["priority"]; tasks: ScenarioSpec["tasks"] }> | undefined {
  if (!value || typeof value !== "object" || !Array.isArray((value as { scenarios?: unknown }).scenarios)) return undefined;
  const plans = (value as { scenarios: unknown[] }).scenarios;
  if (plans.length !== 2) return undefined;
  const result: Array<{ label: string; summary: string; priority: ScenarioSpec["priority"]; tasks: ScenarioSpec["tasks"] }> = [];
  for (const item of plans) {
    if (!item || typeof item !== "object") return undefined;
    const plan = item as Record<string, unknown>;
    if (typeof plan.label !== "string" || !plan.label.trim() || !Array.isArray(plan.tasks) ||
        (plan.priority !== undefined && !priorities.has(plan.priority as ScenarioSpec["priority"])) ||
        (plan.summary !== undefined && typeof plan.summary !== "string")) return undefined;
    const tasks: ScenarioSpec["tasks"] = [];
    for (const candidate of plan.tasks) {
      if (!candidate || typeof candidate !== "object") return undefined;
      const task = candidate as Record<string, unknown>;
      if (typeof task.title !== "string" || !task.title.trim() ||
          (task.hours !== undefined && (typeof task.hours !== "number" || !Number.isFinite(task.hours) || task.hours <= 0)) ||
          (task.hours === undefined && typeof task.taskId !== "string") ||
          (task.taskId !== undefined && typeof task.taskId !== "string") ||
          (task.dueAt !== undefined && typeof task.dueAt !== "string") ||
          (task.goalId !== undefined && typeof task.goalId !== "string")) return undefined;
      tasks.push({ title: task.title, ...(typeof task.hours === "number" ? { hours: task.hours } : {}), ...(typeof task.taskId === "string" ? { taskId: task.taskId } : {}), ...(typeof task.dueAt === "string" ? { dueAt: task.dueAt } : {}), ...(typeof task.goalId === "string" ? { goalId: task.goalId } : {}) });
    }
    if (!tasks.length) return undefined;
    result.push({ label: plan.label.trim(), summary: typeof plan.summary === "string" ? plan.summary : plan.label.trim(), priority: (plan.priority as ScenarioSpec["priority"] | undefined) ?? "neutral", tasks });
  }
  return result;
}

function clarification(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const text = (value as { clarify?: unknown }).clarify;
  return typeof text === "string" && text.trim() ? text.trim().slice(0, 180) : undefined;
}

function canned(text: string, data: TwinData) {
  const specs = parseWhatIfCanned(text, data);
  const clarify = specs.find(spec => spec.needsInfo)?.needsInfo;
  if (clarify || specs.every(spec => spec.tasks.length === 0)) {
    return { scenarios: [], clarify: clarify ?? "Which two options should I compare, and how many hours should I plan for each?", degraded: true };
  }
  return {
    scenarios: specs.map(spec => ({ label: spec.label, summary: spec.summary, priority: spec.priority, tasks: spec.tasks })),
    degraded: true,
  };
}

function safeContext(value: unknown): TwinContext | undefined {
  if (!value || typeof value !== "object") return undefined;
  const context = value as Partial<TwinContext>;
  return {
    approvedFacts: Array.isArray(context.approvedFacts) ? context.approvedFacts.filter(fact => fact && typeof fact.id === "string" && typeof fact.text === "string").slice(0, 12) : [],
    ...(typeof context.habitConsistency === "number" ? { habitConsistency: context.habitConsistency } : {}),
    ...(context.estimationBias && typeof context.estimationBias === "object" ? { estimationBias: context.estimationBias } : {}),
    ...(context.averages && typeof context.averages === "object" ? { averages: context.averages } : {}),
  };
}

export async function POST(request: Request) {
  let body: { text?: unknown; context?: unknown; consent?: unknown; tasks?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }
  if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 2000) return Response.json({ error: "Text must be between 1 and 2000 characters." }, { status: 400 });
  const text = body.text.trim();
  const tasks = safeTasks(body.tasks);
  const data: TwinData = { tasks, goals: [], habits: [], checkins: [], decisions: [] };
  // Catch clearly incomplete questions without spending a model call.
  if (/^(should i study|should i revise|what should i do|should i work)\??$/i.test(text) || !/\b(instead|rather|or|what if|if i|choose between|compare)\b/i.test(text)) {
    return Response.json({ scenarios: [], clarify: "Which two options should I compare, and how many hours for each?", degraded: true });
  }

  // Our own rules first: if they match the sentence to two sets of real open tasks, answer at once
  // (instant and reliable for the demo); the model is only needed for sentences they cannot place.
  const local = canned(text, data);
  if (local.scenarios.length >= 2) return Response.json(local);

  const context = safeContext(body.context) ?? (body.consent && typeof body.consent === "object" ? await buildTwinContext(body.consent as Parameters<typeof buildTwinContext>[0]) : undefined);
  const content = await openRouterJson([
    { role: "system", content: `Parse a student what-if sentence into exactly two scenario plans. Return only JSON: {"scenarios":[{"label":"...","summary":"...","priority":"deadline|goal|rest|health|neutral","tasks":[{"title":"...","hours":2,"taskId":"optional known task id","dueAt":"optional known ISO date","goalId":"optional known goal id"}]}]} or {"clarify":"one short focused question"}. Use the supplied open tasks and approved context. Never invent hours, deadlines, or tasks. Every task must have a known taskId or a stated numeric hours estimate. A vague sentence should ask for the two options and/or one missing estimate.` },
    { role: "user", content: JSON.stringify({ text, context, openTasks: tasks }) },
  ], value => Boolean(clarification(value)) || Boolean(validPlans(value)));
  const parsed = content ? parseJsonObject(content) : undefined;
  if (parsed) {
    const clarify = clarification(parsed);
    if (clarify) return Response.json({ scenarios: [], clarify, degraded: false });
    const scenarios = validPlans(parsed);
    if (scenarios) {
      const missingTask = scenarios.flatMap(scenario => scenario.tasks).find(task => task.taskId && !tasks.some(known => known.id === task.taskId));
      if (missingTask) return Response.json({ scenarios: [], clarify: `I can't find ${missingTask.title} in your open tasks. How many hours should I use?`, degraded: false });
      return Response.json({ scenarios, degraded: false });
    }
  }
  return Response.json(canned(text, data));
}
