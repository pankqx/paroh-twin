import type { Metadata } from "next";
import MemoryGraph from "@/components/MemoryGraph/MemoryGraph";

export const metadata: Metadata = { title: "Memory · Paroh" };

export default function Page() {
  return <MemoryGraph />;
}
