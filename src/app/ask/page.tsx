import type { Metadata } from "next";
import AskStage from "@/components/AskStage/AskStage";

export const metadata: Metadata = { title: "Ask · Paroh" };

export default function Page() {
  return <AskStage />;
}
