import { readFile } from "node:fs/promises";

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

async function requestModel(key, model) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: 'Return JSON only: {"ok":true}' }], response_format: { type: "json_object" }, max_tokens: 20 }),
      signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error(), { safeReason: `HTTP ${response.status}` });
    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw Object.assign(new Error(), { safeReason: "invalid response" });
    try { JSON.parse(content); } catch { throw Object.assign(new Error(), { safeReason: "response was not JSON" }); }
    return content;
  } catch (error) {
    if (error?.safeReason) throw error;
    if (error?.name === "AbortError") throw Object.assign(new Error(), { safeReason: "request timed out" });
    throw Object.assign(new Error(), { safeReason: "request failed" });
  } finally { clearTimeout(timeout); }
}

const settings = await loadSettings();
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
