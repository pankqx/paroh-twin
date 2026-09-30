import type { Metadata } from "next";
import ComingNext from "@/components/ComingNext/ComingNext";

export const metadata: Metadata = { title: "Rhythm · Paroh" };

export default function Page() {
  return (
    <ComingNext
      title="Rhythm"
      blurb="Habits, tasks and a simple energy check-in in one place, so the twin can plan around how you actually work."
      points={[
        "Habit chains with streaks",
        "Tasks with estimate vs actual hours",
        "A 7-day energy and mood ribbon for planning",
      ]}
    />
  );
}
