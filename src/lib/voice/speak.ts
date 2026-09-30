export interface SpeakingState {
  isSpeaking: boolean;
  currentSentence: string;
}

export type SpeakingListener = (state: SpeakingState) => void;

const ENABLED_KEY = "paroh-voice-enabled";
const listeners = new Set<SpeakingListener>();
const idleState: SpeakingState = { isSpeaking: false, currentSentence: "" };
let state: SpeakingState = idleState;
let enabledCache: boolean | undefined;
let queue: string[] = [];
let generation = 0;

function emit(next: SpeakingState) {
  state = next;
  for (const listener of listeners) listener({ ...state });
}

function sentences(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [])
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function preferredVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const normalized = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().replace("_", "-");
  return voices.find(voice => normalized(voice) === "en-in")
    ?? voices.find(voice => normalized(voice) === "en-gb")
    ?? voices.find(voice => normalized(voice) === "en-us");
}

function playNext(run: number) {
  if (run !== generation || typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
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
  utterance.onend = () => { if (run === generation) playNext(run); };
  utterance.onerror = () => { if (run === generation) playNext(run); };
  emit({ isSpeaking: true, currentSentence: sentence });
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
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  emit(idleState);
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
