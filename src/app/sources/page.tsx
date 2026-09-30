import type { Metadata } from "next";
import Sources from "@/components/Sources/Sources";

export const metadata: Metadata = { title: "Sources · Paroh" };

export default function Page() {
  return <Sources />;
}
