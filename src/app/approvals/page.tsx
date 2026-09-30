import type { Metadata } from "next";
import ApprovalsPanel from "@/components/ApprovalsPanel/ApprovalsPanel";
import "./approvals.css";

export const metadata: Metadata = { title: "Approvals · Paroh" };

export default function ApprovalsPage() {
  return (
    <main className="page approvals">
      <h1>Approvals</h1>
      <p className="approvals-sub">
        The twin only learns what you approve. Approved cards fly into her memory.
      </p>
      <div className="glass approvals-shell rise">
        <ApprovalsPanel variant="page" />
      </div>
    </main>
  );
}
