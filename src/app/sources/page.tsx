import type { Metadata } from "next";
import ComingNext from "@/components/ComingNext/ComingNext";

export const metadata: Metadata = { title: "Sources · Paroh" };

export default function Page() {
  return (
    <ComingNext
      title="Sources"
      blurb="Where your twin learns from, and what you let it see. Every source ends at the same gate: you approve before the twin learns."
      points={[
        "Live: Journal, voice answers, tasks and planner (sample data)",
        "Roadmap: Gmail, WhatsApp, Telegram, Calendar",
        "Consent toggles and a preview of what is sent to the model",
      ]}
    />
  );
}
