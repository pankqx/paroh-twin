export interface SpeakingState {
  isSpeaking: boolean;
  currentSentence: string;
  speaking: boolean;
  sentence: string;
  mouth: 0 | 1 | 2 | 3;
}

export type SpeakingListener = (state: SpeakingState) => void;

const ENABLED_KEY = "paroh-voice-enabled";
const listeners = new Set<SpeakingListener>();
const idleState: SpeakingState = { isSpeaking: false, currentSentence: "", speaking: false, sentence: "", mouth: 0 };
let state: SpeakingState = idleState;
let enabledCache: boolean | undefined;
let queue: string[] = [];
let generation = 0;
let fallbackTimer: ReturnType<typeof setInterval> | undefined;
let mouthReleaseTimer: ReturnType<typeof setTimeout> | undefined;
let voiceLook: "woman" | "man" = "woman";

function clearMouthTimers() {
  if (fallbackTimer) clearInterval(fallbackTimer);
  if (mouthReleaseTimer) clearTimeout(mouthReleaseTimer);
  fallbackTimer = undefined;
  mouthReleaseTimer = undefined;
}

function emit(next: SpeakingState) {
  state = next;
  for (const listener of listeners) listener({ ...state });
}

function sentences(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [])
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

const FEMALE = /\b(?:female|woman|girl)\b|samantha|zira|aria|jenny|heera|neerja|veena|kalpana|swara|karen|moira|tessa|fiona|susan|hazel|libby|sonia|natasha|serena|victoria|allison|ava|google us english|google uk english female/i;
const MALE = /\b(?:male|man|boy)\b|daniel|david|guy|ravi|prabhat|george|ryan|thomas|alex|fred|google uk english male/i;

/** True when the chosen voice is known to match the look (otherwise we shift pitch a little). */
let voiceMatchesLook = false;

function preferredVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const normalized = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().replace("_", "-");
  const languages = ["en-in", "en-gb", "en-us"];
  const want = voiceLook === "woman" ? FEMALE : MALE;
  const avoid = voiceLook === "woman" ? MALE : FEMALE;
  const fits = (v: SpeechSynthesisVoice) => want.test(v.name) && !(voiceLook === "woman" && /google uk english male/i.test(v.name));
  for (const language of languages) {
    const match = voices.find((v) => normalized(v) === language && fits(v));
    if (match) { voiceMatchesLook = true; return match; }
  }
  const anyEnglish = voices.find((v) => normalized(v).startsWith("en") && fits(v));
  if (anyEnglish) { voiceMatchesLook = true; return anyEnglish; }
  voiceMatchesLook = false;
  // No voice of the right kind: pick an English one that is at least not the other kind.
  return (
    voices.find((v) => languages.includes(normalized(v)) && !avoid.test(v.name)) ??
    voices.find((v) => languages.includes(normalized(v)))
  );
}

function playNext(run: number) {
  if (run !== generation || typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
  clearMouthTimers();
  const sentence = queue.shift();
  if (!sentence || !getEnabled()) {
    queue = [];
    emit(idleState);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(sentence);
  const voice = preferredVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  // Without a matching voice, shift pitch so a woman's look does not speak in a deep voice.
  if (!voiceMatchesLook) utterance.pitch = voiceLook === "woman" ? 1.35 : 0.85;
  else if (voiceLook === "woman") utterance.pitch = 1.08;
  let receivedWordBoundary = false;
  let fallbackMouth: 0 | 1 | 2 | 3 = 0;
  const publishMouth = (mouth: 0 | 1 | 2 | 3) => emit({ isSpeaking: true, currentSentence: sentence, speaking: true, sentence, mouth });
  utterance.onboundary = event => {
    if (run !== generation || (event.name && event.name !== "word")) return;
    const word = sentence.slice(event.charIndex).match(/^[\p{L}\p{N}'’-]+/u)?.[0] ?? "";
    if (!word) return;
    receivedWordBoundary = true;
    if (fallbackTimer) clearInterval(fallbackTimer);
    fallbackTimer = undefined;
    // Word length is only a loose visual cue, not phoneme tracking.
    const mouth: 1 | 2 | 3 = word.length <= 2 ? 1 : word.length <= 5 ? 2 : 3;
    publishMouth(mouth);
    if (mouthReleaseTimer) clearTimeout(mouthReleaseTimer);
    mouthReleaseTimer = setTimeout(() => { if (run === generation) publishMouth(0); }, 120);
  };
  utterance.onend = () => { if (run === generation) playNext(run); };
  utterance.onerror = () => { if (run === generation) playNext(run); };
  emit({ isSpeaking: true, currentSentence: sentence, speaking: true, sentence, mouth: 0 });
  // Some speech engines omit boundary events; cycle gently while a sentence is active.
  fallbackTimer = setInterval(() => {
    if (receivedWordBoundary || run !== generation) return;
    fallbackMouth = ((fallbackMouth + 1) % 4) as 0 | 1 | 2 | 3;
    publishMouth(fallbackMouth);
  }, 170);
  window.speechSynthesis.speak(utterance);
}

/** Returns whether speech synthesis is available in this browser. Safe during SSR. */
export function isSupported(): boolean {
  return typeof window !== "undefined"
    && typeof window.speechSynthesis !== "undefined"
    && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Speak sentence by sentence. Call directly from a user gesture such as a button click. */
export function speak(text: string): void {
  if (!isSupported() || !getEnabled()) return;
  const parts = sentences(text);
  if (!parts.length) return;
  generation += 1;
  const run = generation;
  window.speechSynthesis.cancel();
  queue = parts;
  playNext(run);
}

/** Stop queued and currently spoken text, and clear the visible caption. */
export function stop(): void {
  generation += 1;
  queue = [];
  clearMouthTimers();
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  emit(idleState);
}

/** Immediately cancel current synthesis and discard queued speech, for example when dictation starts. */
export function cancel(): void { stop(); }

/** Set a best-effort voice persona; language and available voices vary by device. */
export function setVoiceLook(look: "woman" | "man" | "spirit"): void {
  voiceLook = look === "man" ? "man" : "woman";
}

export function setEnabled(enabled: boolean): void {
  enabledCache = enabled;
  try { if (typeof localStorage !== "undefined") localStorage.setItem(ENABLED_KEY, String(enabled)); } catch { /* storage can be disabled */ }
  if (!enabled) stop();
}

export function getEnabled(): boolean {
  if (enabledCache !== undefined) return enabledCache;
  try {
    const value = typeof localStorage !== "undefined" ? localStorage.getItem(ENABLED_KEY) : null;
    enabledCache = value === "true";
  } catch { enabledCache = false; }
  return enabledCache;
}

/** Subscribe to speaking state and the current sentence caption. */
export function subscribe(callback: SpeakingListener): () => void {
  listeners.add(callback);
  callback({ ...state });
  return () => listeners.delete(callback);
}
