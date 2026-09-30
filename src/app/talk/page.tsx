import type { Metadata } from "next";
import TalkStage from "@/components/TalkStage/TalkStage";

export const metadata: Metadata = { title: "Talk · Paroh" };

export default function TalkPage() {
  return <TalkStage />;
}
