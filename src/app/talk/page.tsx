import type { Metadata } from "next";
import ComingNext from "@/components/ComingNext/ComingNext";

export const metadata: Metadata = { title: "Talk · Paroh" };

export default function Page() {
  return (
    <ComingNext
      title="Talk"
      blurb="Your twin asks a short question out loud, you answer by voice or a tap, and what it hears becomes a fact card you approve."
      points={[
        "Questions about what the twin knows least",
        "Answer by voice or quick-reply chips",
        "Approve a card and watch it fly into the orb",
      ]}
    />
  );
}
