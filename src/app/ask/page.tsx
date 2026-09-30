import type { Metadata } from "next";
import ComingNext from "@/components/ComingNext/ComingNext";

export const metadata: Metadata = { title: "Ask · Paroh" };

export default function Page() {
  return (
    <ComingNext
      title="Ask"
      blurb="Ask “what if?” and see two paths side by side, with odds from your own history. The twin reads its recommendation aloud."
      points={[
        "Two scenarios drawn as a fork",
        "On-time odds from real simulation",
        "Spoken recommendation with captions",
      ]}
    />
  );
}
