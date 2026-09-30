import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

async function loadSettings() {
  let local = {};
  try { local = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8")); } catch { /* local env file is optional */ }
  return {
    key: process.env.OPENROUTER_API_KEY || local.OPENROUTER_API_KEY,
    main: process.env.OPENROUTER_MODEL || local.OPENROUTER_MODEL,
    fallback: process.env.OPENROUTER_FALLBACK_MODEL || local.OPENROUTER_FALLBACK_MODEL,
  };
}

async function requestProbe(key, model, messages, validate) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, max_tokens: 120 }),
      signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error(), { safeReason: `HTTP ${response.status}` });
    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw Object.assign(new Error(), { safeReason: "invalid response" });
    let value;
    try { value = JSON.parse(content); } catch { throw Object.assign(new Error(), { safeReason: "response was not JSON" }); }
    if (!validate(value)) throw Object.assign(new Error(), { safeReason: "response did not match the JSON contract" });
  } catch (error) {
    if (error?.safeReason) throw error;
    if (error?.name === "AbortError") throw Object.assign(new Error(), { safeReason: "request timed out" });
    throw Object.assign(new Error(), { safeReason: "request failed" });
  } finally { clearTimeout(timeout); }
}

async function requestModel(key, model) {
  await requestProbe(key, model, [{ role: "user", content: 'Return JSON only: {"ok":true}' }], value => value?.ok === true);
  await requestProbe(key, model, [
    { role: "system", content: "You are the student's digital twin. Speak in first person, warmly and briefly. Help with productivity and planning only; never use therapy or mental-health wording. Never invent numbers. Ask at most one follow-up. Return JSON only as {\"reply\":\"...\",\"spoken\":\"under 45 words\",\"followUp\":null}." },
    { role: "user", content: JSON.stringify({ intent: "chat", utterance: "What should I plan next?", history: [], approvedTwinContext: { approvedFacts: [] }, nextQuestion: null }) },
  ], value => typeof value?.reply === "string" && typeof value?.spoken === "string" && value.spoken.trim().split(/\s+/).length < 45 && !/\d/.test(`${value.reply} ${value.spoken}`));
}

const settings = await loadSettings();
const converseSuite = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url)), "run", "src/lib/ai/routesFallback.test.ts"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  stdio: "ignore",
});
if (converseSuite.status !== 0) {
  console.log("fallback used (converse route logic check failed)");
  process.exit(1);
}
if (!settings.key) {
  console.log("fallback used (OPENROUTER_API_KEY is unset)");
  process.exit(0);
}
if (!settings.main) {
  console.log("fallback used (OPENROUTER_MODEL is unset)");
  process.exit(0);
}

try {
  await requestModel(settings.key, settings.main);
  console.log(`live OK (model ${settings.main})`);
} catch (error) {
  const reason = error?.safeReason || "request failed";
  if (!settings.fallback || settings.fallback === settings.main) {
    console.log(`fallback used (${reason}; fallback model unavailable)`);
    process.exit(0);
  }
  try {
    await requestModel(settings.key, settings.fallback);
    console.log(`fallback used (${reason})`);
  } catch (fallbackError) {
    const fallbackReason = fallbackError?.safeReason || "fallback request failed";
    console.log(`fallback used (${reason}; ${fallbackReason})`);
  }
}
