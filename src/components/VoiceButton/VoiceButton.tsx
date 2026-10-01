"use client";

// One mic button with clear, animated states:
//   idle      breathing ring, mic icon, "Tap to talk"
//   listening teal core, ripples, a ring that follows your voice level, stop icon
//   busy      orbiting dot while your words are read
//   speaking  the twin is talking: tap to stop her
import "./VoiceButton.css";

export type VoiceState = "idle" | "listening" | "busy" | "speaking";

const LABEL: Record<VoiceState, string> = {
  idle: "Tap to talk",
  listening: "Listening… tap to stop",
  busy: "Got it, reading…",
  speaking: "Tap to stop her",
};

export default function VoiceButton({
  state,
  level = 0,
  onClick,
  disabled,
  size = 64,
}: {
  state: VoiceState;
  level?: number;
  onClick: () => void;
  disabled?: boolean;
  size?: number;
}) {
  const stopIcon = state === "listening" || state === "speaking";
  return (
    <div className={`vb vb-${state}`} style={{ ["--vb-size" as string]: `${size}px`, ["--lvl" as string]: Math.min(1, level) }}>
      <button
        type="button"
        className="vb-btn"
        onClick={onClick}
        disabled={disabled || state === "busy"}
        aria-pressed={state === "listening"}
        aria-label={LABEL[state]}
      >
        <span className="vb-ripple" aria-hidden="true" />
        <span className="vb-ripple r2" aria-hidden="true" />
        <span className="vb-ripple r3" aria-hidden="true" />
        <span className="vb-level" aria-hidden="true" />
        <span className="vb-core" aria-hidden="true">
          {state === "busy" ? (
            <span className="vb-orbit" />
          ) : stopIcon ? (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
            </svg>
          )}
        </span>
      </button>
      <span className="vb-label" aria-live="polite">
        {LABEL[state]}
      </span>
    </div>
  );
}
