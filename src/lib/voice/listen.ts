export interface ListenResult { transcript: string; isFinal: boolean }
export interface ListenOptions { measureLevel?: boolean; autoRestart?: boolean }
export type ListenState = "idle" | "listening" | "error";
export type ListenErrorCode = "not-allowed" | "no-speech" | "network" | "audio-capture" | "service-not-allowed" | string;

type ResultListener = (result: ListenResult) => void;
type TextListener = (text: string) => void;
type EndListener = () => void;
type ErrorListener = (code: ListenErrorCode, friendlyMessage: string) => void;
type LevelListener = (level: number) => void;

interface RecognitionResultLike { isFinal: boolean; [index: number]: { transcript: string } }
interface RecognitionEventLike extends Event { resultIndex?: number; results: ArrayLike<RecognitionResultLike> }
interface RecognitionErrorEventLike extends Event { error?: string }
interface RecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
  start(): void; stop(): void; abort?(): void;
}
type RecognitionConstructor = new () => RecognitionLike;
type WindowWithRecognition = Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };

const resultListeners = new Set<ResultListener>();
const interimListeners = new Set<TextListener>();
const finalListeners = new Set<TextListener>();
const endListeners = new Set<EndListener>();
const errorListeners = new Set<ErrorListener>();
const levelListeners = new Set<LevelListener>();
let recognition: RecognitionLike | undefined;
let audioContext: AudioContext | undefined;
let audioStream: MediaStream | undefined;
let animationFrame = 0;
let silenceTimer: ReturnType<typeof setTimeout> | undefined;
let state: ListenState = "idle";
let generation = 0;
let autoRestart = false;
let meterRequested = false;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as WindowWithRecognition;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function publishState(next: ListenState) { state = next; }
export function getState(): ListenState { return state; }

function stopMeter() {
  if (typeof window !== "undefined" && animationFrame) window.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  audioStream?.getTracks().forEach(track => track.stop());
  audioStream = undefined;
  if (audioContext) void audioContext.close().catch(() => undefined);
  audioContext = undefined;
  for (const callback of levelListeners) callback(0);
}

async function startMeter() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) return;
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioContext.createMediaStreamSource(audioStream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const readLevel = () => {
      if (!audioContext || !audioStream) return;
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) { const amplitude = (sample - 128) / 128; energy += amplitude * amplitude; }
      const level = Math.min(1, Math.sqrt(energy / samples.length) * 3.5);
      for (const callback of levelListeners) callback(level);
      animationFrame = window.requestAnimationFrame(readLevel);
    };
    readLevel();
  } catch { stopMeter(); }
}

function endListenersNow() { for (const callback of endListeners) callback(); }
function clearSilenceTimer() { if (silenceTimer) clearTimeout(silenceTimer); silenceTimer = undefined; }
function stopRecognition(abort: boolean) {
  const active = recognition;
  recognition = undefined;
  if (active) {
    active.onend = null;
    active.onerror = null;
    active.onresult = null;
    try { if (abort && active.abort) active.abort(); else active.stop(); }
    catch { try { active.abort?.(); } catch { /* recognition already ended */ } }
  }
}

function finish(expectedGeneration: number, nextState: ListenState = "idle") {
  if (expectedGeneration !== generation) return;
  clearSilenceTimer();
  stopRecognition(true);
  stopMeter();
  publishState(nextState);
  endListenersNow();
}

function friendlyError(code: string): string {
  if (code === "not-allowed") return "Allow microphone access in your browser settings, then try again.";
  if (code === "no-speech") return "I didn't hear speech. Try again or type instead.";
  if (code === "network" || code === "service-not-allowed") return "Speech service unavailable here; use Chrome or type";
  if (code === "audio-capture") return "No microphone is available. Check its connection or type instead.";
  return "Speech input stopped. Try again or type instead.";
}

function fail(expectedGeneration: number, code: string) {
  if (expectedGeneration !== generation) return;
  for (const callback of errorListeners) callback(code, friendlyError(code));
  finish(expectedGeneration, "error");
}

async function requestPermissionAndStart(Constructor: RecognitionConstructor, expectedGeneration: number) {
  try {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) { fail(expectedGeneration, "audio-capture"); return; }
    const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    permissionStream.getTracks().forEach(track => track.stop());
    if (expectedGeneration !== generation) return;

    const instance = new Constructor();
    instance.lang = "en-IN";
    instance.continuous = false;
    instance.interimResults = true;
    instance.onresult = event => {
      for (let i = Math.max(0, event.resultIndex ?? 0); i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript?.trim();
        if (!transcript) continue;
        const value = { transcript, isFinal: result.isFinal };
        for (const callback of resultListeners) callback(value);
        for (const callback of result.isFinal ? finalListeners : interimListeners) callback(transcript);
        clearSilenceTimer();
        silenceTimer = setTimeout(() => finish(expectedGeneration), 1800);
      }
    };
    instance.onerror = event => fail(expectedGeneration, event.error || "network");
    instance.onend = () => {
      if (expectedGeneration !== generation) return;
      if (autoRestart && state === "listening") {
        recognition = undefined;
        try { instance.start(); recognition = instance; }
        catch { fail(expectedGeneration, "service-not-allowed"); }
        return;
      }
      finish(expectedGeneration);
    };
    recognition = instance;
    try { instance.start(); } catch { fail(expectedGeneration, "service-not-allowed"); return; }
    if (meterRequested) void startMeter();
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "";
    fail(expectedGeneration, name === "NotAllowedError" || name === "PermissionDeniedError" ? "not-allowed" : "audio-capture");
  }
}

/** Speech recognition availability. Safe during server rendering. */
export function isSupported(): boolean { return Boolean(recognitionConstructor()); }

/** Request microphone permission and begin a live transcript; no audio is recorded or stored by Paroh. */
export function start(options: ListenOptions = {}): boolean {
  const Constructor = recognitionConstructor();
  if (!Constructor || state === "listening") return false;
  generation++;
  const currentGeneration = generation;
  autoRestart = options.autoRestart ?? false;
  meterRequested = options.measureLevel ?? false;
  publishState("listening");
  void requestPermissionAndStart(Constructor, currentGeneration);
  return true;
}

/** Abort recognition, release the optional meter, and always notify end subscribers. */
export function stop(): void {
  generation++;
  clearSilenceTimer();
  stopRecognition(true);
  stopMeter();
  publishState("idle");
  endListenersNow();
}

export function onResult(callback: ResultListener): () => void { resultListeners.add(callback); return () => resultListeners.delete(callback); }
export function onInterim(callback: TextListener): () => void { interimListeners.add(callback); return () => interimListeners.delete(callback); }
export function onFinal(callback: TextListener): () => void { finalListeners.add(callback); return () => finalListeners.delete(callback); }
export function onEnd(callback: EndListener): () => void { endListeners.add(callback); return () => endListeners.delete(callback); }
export function onError(callback: ErrorListener): () => void { errorListeners.add(callback); return () => errorListeners.delete(callback); }
/** Optional live input level from 0 (quiet) to 1. The stream is released when listening stops. */
export function onLevel(callback: LevelListener): () => void { levelListeners.add(callback); return () => levelListeners.delete(callback); }
