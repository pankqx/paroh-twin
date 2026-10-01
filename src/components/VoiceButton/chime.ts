// Tiny UI chimes made with an oscillator (nothing is recorded; no audio files).
let ctx: AudioContext | undefined;

export function chime(kind: "start" | "stop" | "done") {
  if (typeof window === "undefined" || !window.AudioContext) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && kind === "done") return;
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    const notes = kind === "start" ? [660, 990] : kind === "stop" ? [880, 520] : [523, 659, 784];
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = now + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.25);
    });
  } catch {
    /* audio unavailable: silent */
  }
}
