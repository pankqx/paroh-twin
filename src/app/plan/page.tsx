import type { Metadata } from "next";
import ComingNext from "@/components/ComingNext/ComingNext";

export const metadata: Metadata = { title: "Plan · Paroh" };

export default function Page() {
  return (
    <ComingNext
      title="Plan"
      blurb="Your month and year drawn as orbits, built from your tasks and goals."
      points={[
        "Month calendar with category dots",
        "Year wheel with goals as arcs and deadlines as pins",
        "Overloaded days called out early",
      ]}
    />
  );
}
