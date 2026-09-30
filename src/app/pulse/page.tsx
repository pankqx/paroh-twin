import type { Metadata } from "next";
import ComingNext from "@/components/ComingNext/ComingNext";

export const metadata: Metadata = { title: "Pulse · Paroh" };

export default function Page() {
  return (
    <ComingNext
      title="Pulse"
      blurb="Small heads-ups while the app is open: load spikes, deadlines getting tight, streaks at risk. Runs on sample data for now."
      points={[
        "Whispers computed from your twin",
        "Turn any whisper into a what-if",
        "Works only while this tab is open",
      ]}
    />
  );
}
