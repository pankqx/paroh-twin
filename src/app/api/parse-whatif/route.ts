import type { Category, ScenarioSpec, Task, TwinData } from "../../../lib/types";
import { openRouterJson, parseJsonObject } from "../../../lib/ai/openRouter";
import { parseWhatIfCanned } from "../../../lib/twin/scenarios";

export const runtime = "nodejs";

const priorities = new Set<ScenarioSpec["priority"]>(["deadline", "goal", "rest", "health", "neutral"]);
const categories = new Set<Category>(["study", "health", "personal", "career", "other"]);

function safeTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Task => !!item && typeof item === "object" &&
    typeof item.id === "string" && typeof item.title === "string" && typeof item.estHours === "number" &&
    categories.has(item.category as Category) && typeof item.done === "boolean" && item.done === false);
}

function validateSpecs(value: unknown): ScenarioSpec[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const root = value as { horizon?: unknown; scenarios?: unknown };
  if (typeof root.horizon !== "string" || !root.horizon.trim() || !Array.isArray(root.scenarios) || root.scenarios.length !== 2) return undefined;
  const specs: ScenarioSpec[] = [];
  for (const item of root.scenarios) {
    if (!item || typeof item !== "object") return undefined;
    const spec = item as Record<string, unknown>;
    if (typeof spec.id !== "string" || typeof spec.label !== "string" || typeof spec.summary !== "string" ||
        !Array.isArray(spec.tasks) || !priorities.has(spec.priority as ScenarioSpec["priority"])) return undefined;
    const tasks: ScenarioSpec["tasks"] = [];
    for (const candidate of spec.tasks) {
      if (!candidate || typeof candidate !== "object") return undefined;
      const task = candidate as Record<string, unknown>;
      if (typeof task.title !== "string" || (task.hours !== undefined && (typeof task.hours !== "number" || !Number.isFinite(task.hours) || task.hours <= 0)) ||
          (task.taskId !== undefined && typeof task.taskId !== "string") || (task.dueAt !== undefined && typeof task.dueAt !== "string")) return undefined;
      tasks.push({ title: task.title, ...(typeof task.hours === "number" ? { hours: task.hours } : {}), ...(typeof task.taskId === "string" ? { taskId: task.taskId } : {}), ...(typeof task.dueAt === "string" ? { dueAt: task.dueAt } : {}) });
    }
    const hoursShift = spec.hoursShift === undefined ? [] : spec.hoursShift;
    if (!Array.isArray(hoursShift) || hoursShift.some(shift => !shift || typeof shift !== "object" || typeof (shift as { hours?: unknown }).hours !== "number" || !Number.isFinite((shift as { hours: number }).hours))) return undefined;
    specs.push({ id: spec.id, label: spec.label, summary: `${spec.summary} Horizon: ${root.horizon.trim()}.`, tasks, priority: spec.priority as ScenarioSpec["priority"], hoursShift: hoursShift as ScenarioSpec["hoursShift"] });
  }
  return specs;
}

function needsInfo(question = "Which two options should I compare, and how many hours will each take?") {
  return [{ id: "clarify-whatif", label: "Need one detail", summary: "", tasks: [], priority: "neutral" as const, needsInfo: question }];
}

export async function POST(request: Request) {
  let body: { prompt?: unknown; tasks?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Send a valid JSON body." }, { status: 400 }); }
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 2000) return Response.json({ error: "Prompt must be between 1 and 2000 characters." }, { status: 400 });
  const prompt = body.prompt.trim();
  const tasks = safeTasks(body.tasks);
  const data: TwinData = { tasks, goals: [], habits: [], checkins: [], decisions: [] };
  const mentionedWork = /\b(finish|complete|work on|study|revise|review|do|start|plan|instead|rather|option|project|assignment|exam|deadline)\b/i.test(prompt);
  if (!mentionedWork || /^(should i study\??|should i revise\??|what should i do\??)$/i.test(prompt)) {
    return Response.json({ specs: needsInfo("What two options should I compare, and how many hours should I plan for each?") , degraded: true });
  }

  const content = await openRouterJson([
    { role: "system", content: `Turn the student's what-if request into exactly two scenario specs. Return JSON only: {"horizon":"next two days","scenarios":[{"id":"a","label":"...","summary":"...","tasks":[{"title":"...","hours":2,"taskId":"optional existing task id","dueAt":"optional ISO date"}],"hoursShift":[{"hours":1,"from":"optional","to":"optional"}],"priority":"deadline|goal|rest|health|neutral"}]}. Use the supplied open tasks and estimates where available. Do not invent task estimates or deadlines. If the request is ambiguous or required data is missing, return {"clarification":"one focused question"}. Include a time horizon.` },
    { role: "user", content: JSON.stringify({ prompt, openTasks: tasks }) },
  ], value => typeof value.clarification === "string" || validateSpecs(value) !== undefined, 10_000);
  const parsed = content ? parseJsonObject(content) : undefined;
  if (parsed && typeof parsed.clarification === "string" && parsed.clarification.trim()) return Response.json({ specs: needsInfo(parsed.clarification.trim()), degraded: false });
  const validated = parsed ? validateSpecs(parsed) : undefined;
  if (validated) return Response.json({ specs: validated, degraded: false });

  const canned = parseWhatIfCanned(prompt, data);
  if (canned.some(spec => spec.needsInfo) || canned.every(spec => spec.tasks.length === 0)) {
    return Response.json({ specs: needsInfo(canned.find(spec => spec.needsInfo)?.needsInfo), degraded: true });
  }
  return Response.json({ specs: canned.map(spec => ({ ...spec, summary: `${spec.summary} Horizon: next two days.` })), degraded: true });
}
