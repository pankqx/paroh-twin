export type Risk = "on track" | "tight" | "at risk";

/** Risk band from an on-time probability (0-1). */
export function riskOf(onTime: number): Risk {
  if (onTime >= 0.75) return "on track";
  if (onTime >= 0.5) return "tight";
  return "at risk";
}

// Risk colours: on track = teal, tight = amber, at risk = rose.
export const RISK_CLASS: Record<Risk, string> = {
  "on track": "risk-ok",
  tight: "risk-tight",
  "at risk": "risk-high",
};

export default function RiskPill({ onTime }: { onTime: number }) {
  const risk = riskOf(onTime);
  return (
    <span className={`risk-pill ${RISK_CLASS[risk]}`}>
      {risk} · {Math.round(onTime * 100)}%
    </span>
  );
}
