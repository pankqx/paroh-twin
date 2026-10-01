import type { Metadata } from "next";
import Plan from "@/components/Plan/Plan";

export const metadata: Metadata = { title: "Plan · Paroh" };

export default function Page() {
  return <Plan />;
}
