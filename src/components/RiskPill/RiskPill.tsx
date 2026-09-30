export type Risk = "on track" | "tight" | "at risk";

/** Risk band from an on-time probability (0-1). */
export function riskOf(onTime: number): Risk {
  if (onTime >= 0.75) return "on track";
  if (onTime >= 0.5) return "tight";
  return "at risk";
}

// Reuses the shared status colours: forest / amber / rust.
const CLASS: Record<Risk, string> = {
  "on track": "status-approved",
  tight: "status-pending",
  "at risk": "status-rejected",
};

export default function RiskPill({ onTime }: { onTime: number }) {
  const risk = riskOf(onTime);
  return (
    <span className={`status-pill ${CLASS[risk]}`}>
      {risk} · {Math.round(onTime * 100)}%
    </span>
  );
}
