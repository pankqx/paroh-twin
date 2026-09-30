export interface ListenResult {
  transcript: string;
  isFinal: boolean;
}

export interface ListenOptions {
  /** Request a separate live-only microphone level meter using Web Audio. */
  measureLevel?: boolean;
}

type ResultListener = (result: ListenResult) => void;
type EndListener = () => void;
type LevelListener = (level: number) => void;

interface RecognitionResultLike { isFinal: boolean; [index: number]: { transcript: string } }
interface RecognitionEventLike extends Event { results: ArrayLike<RecognitionResultLike> }
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
}
type RecognitionConstructor = new () => RecognitionLike;
type WindowWithRecognition = Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };

const resultListeners = new Set<ResultListener>();
const endListeners = new Set<EndListener>();
const levelListeners = new Set<LevelListener>();
let recognition: RecognitionLike | undefined;
let audioContext: AudioContext | undefined;
let audioStream: MediaStream | undefined;
let animationFrame = 0;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as WindowWithRecognition;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

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
      for (const sample of samples) {
        const amplitude = (sample - 128) / 128;
        energy += amplitude * amplitude;
      }
      const level = Math.min(1, Math.sqrt(energy / samples.length) * 3.5);
      for (const callback of levelListeners) callback(level);
      animationFrame = window.requestAnimationFrame(readLevel);
    };
    readLevel();
  } catch {
    stopMeter();
  }
}

/** Returns whether this browser exposes the Web Speech recognition API. Safe during SSR. */
export function isSupported(): boolean {
  return Boolean(recognitionConstructor());
}

/** Start browser speech recognition. Call from a user gesture; no audio is recorded or stored. */
export function start(options: ListenOptions = {}): boolean {
  const Constructor = recognitionConstructor();
  if (!Constructor || recognition) return false;
  try {
    const instance = new Constructor();
    instance.lang = "en-IN";
    instance.continuous = false;
    instance.interimResults = true;
    instance.onresult = event => {
      for (let i = event.results.length - 1; i >= 0; i--) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript?.trim();
        if (transcript) for (const callback of resultListeners) callback({ transcript, isFinal: result.isFinal });
        break;
      }
    };
    const finish = () => {
      if (recognition !== instance) return;
      recognition = undefined;
      stopMeter();
      for (const callback of endListeners) callback();
    };
    instance.onend = finish;
    instance.onerror = finish;
    instance.start();
    recognition = instance;
    if (options.measureLevel) void startMeter();
    return true;
  } catch {
    recognition = undefined;
    stopMeter();
    return false;
  }
}

/** Stop speech recognition and release any live microphone level meter. */
export function stop(): void {
  const active = recognition;
  recognition = undefined;
  if (active) {
    active.onend = null;
    active.onerror = null;
    try { active.stop(); } catch { active.abort?.(); }
  }
  stopMeter();
}

export function onResult(callback: ResultListener): () => void {
  resultListeners.add(callback);
  return () => resultListeners.delete(callback);
}

export function onEnd(callback: EndListener): () => void {
  endListeners.add(callback);
  return () => endListeners.delete(callback);
}

/** Subscribe to the optional live input level; values range from 0 (quiet) to 1. */
export function onLevel(callback: LevelListener): () => void {
  levelListeners.add(callback);
  return () => levelListeners.delete(callback);
}
