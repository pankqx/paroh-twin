import type { Metadata } from "next";
import Pulse from "@/components/Pulse/Pulse";

export const metadata: Metadata = { title: "Pulse · Paroh" };

export default function Page() {
  return <Pulse />;
}
