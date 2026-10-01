"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ApprovalsPanel from "@/components/ApprovalsPanel/ApprovalsPanel";
import OrbMark from "@/components/shell/OrbMark";
import { usePendingCount } from "@/components/shell/usePendingCount";
import { useVoicePref } from "@/components/shell/useVoicePref";
import { SAMPLE_STUDENT_NAME } from "@/mock/sample";
import "./Navbar.css";

const LINKS = [
  { href: "/", label: "Twin" },
  { href: "/talk", label: "Talk" },
  { href: "/journal", label: "Journal" },
  { href: "/ask", label: "Ask" },
  { href: "/rhythm", label: "Rhythm" },
  { href: "/plan", label: "Plan" },
  { href: "/pulse", label: "Pulse" },
  { href: "/memory", label: "Memory" },
  { href: "/sources", label: "Sources" },
];

// Mobile: four main tabs, the rest in a sheet.
const MAIN_TABS = ["/", "/talk", "/journal", "/ask"];

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

function TabIcon({ href }: { href: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (href) {
    case "/":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-24 12 12)" />
        </svg>
      );
    case "/talk":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
        </svg>
      );
    case "/ask":
      return (
        <svg {...common}>
          <path d="M12 21V13M12 13 6 5M12 13l6-8" />
          <circle cx="6" cy="4.5" r="1.5" />
          <circle cx="18" cy="4.5" r="1.5" />
        </svg>
      );
    case "/journal":
      return (
        <svg {...common}>
          <path d="M6 3h10a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2z" />
          <path d="M9 8h6M9 12h4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1.2" />
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="19" cy="12" r="1.2" />
        </svg>
      );
  }
}

export default function Navbar() {
  const pathname = usePathname();
  const pending = usePendingCount();
  const [voiceOn, setVoiceOn] = useVoicePref();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);

  // Close the sheet and the tray whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setSheetOpen(false);
    setTrayOpen(false);
  }

  useEffect(() => {
    if (!sheetOpen && !trayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSheetOpen(false);
      setTrayOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, trayOpen]);

  if (pathname.startsWith("/welcome")) return null;

  const name = SAMPLE_STUDENT_NAME.split(" ")[0];
  const approvalsLabel = `Approvals, ${pending} waiting`;
  const moreLinks = LINKS.filter((l) => !MAIN_TABS.includes(l.href));

  return (
    <>
      <header className="topbar">
        <Link href="/" className="topbar-brand">
          <OrbMark />
          <span>Paroh</span>
        </Link>

        <nav className="topbar-links" aria-label="Main">
          {LINKS.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="topbar-active"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="topbar-label">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="topbar-right">
          <span className="topbar-pill">
            {name} <span aria-hidden="true">·</span> sample data
          </span>
          <button
            type="button"
            className={`topbar-voice ${voiceOn ? "on" : ""}`}
            aria-pressed={voiceOn}
            onClick={() => setVoiceOn(!voiceOn)}
          >
            <span className="topbar-voice-dot" aria-hidden="true" />
            Voice {voiceOn ? "on" : "off"}
          </button>
          <button
            type="button"
            className={`topbar-approvals ${trayOpen || isActive(pathname, "/approvals") ? "active" : ""}`}
            aria-label={approvalsLabel}
            aria-expanded={trayOpen}
            aria-controls="approvals-tray"
            onClick={() => {
              setSheetOpen(false);
              setTrayOpen((o) => !o);
            }}
          >
            Approvals
            <AnimatePresence initial={false} mode="popLayout">
              {pending > 0 && (
                <motion.span
                  key={pending}
                  className="topbar-badge num"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                >
                  {pending}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {trayOpen && (
          <>
            <motion.div
              className="tray-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTrayOpen(false)}
            />
            <motion.aside
              id="approvals-tray"
              className="glass glass-blur tray"
              role="dialog"
              aria-label="Approvals"
              initial={{ y: "-105%", opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-105%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              <div className="tray-head">
                <h2>Approvals</h2>
                <Link href="/approvals" className="btn-text">
                  Open as a page
                </Link>
                <button type="button" className="tray-close" aria-label="Close approvals" onClick={() => setTrayOpen(false)}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
                </button>
              </div>
              <ApprovalsPanel variant="tray" />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile bottom tab bar */}
      <nav className="tabbar" aria-label="Main (mobile)">
        {MAIN_TABS.map((href) => {
          const link = LINKS.find((l) => l.href === href)!;
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
            >
              <TabIcon href={href} />
              <span>{link.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={sheetOpen}
          aria-controls="more-sheet"
          className={moreLinks.some((l) => isActive(pathname, l.href)) ? "active" : undefined}
          onClick={() => setSheetOpen((o) => !o)}
        >
          <TabIcon href="more" />
          <span>More</span>
          {pending > 0 && <span className="tabbar-dot" aria-hidden="true" />}
        </button>
      </nav>

      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              className="sheet-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              id="more-sheet"
              className="sheet glass glass-blur"
              role="dialog"
              aria-label="More screens"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
            >
              {moreLinks.map(({ href, label }) => (
                <Link key={href} href={href} className={isActive(pathname, href) ? "active" : undefined}>
                  {label}
                </Link>
              ))}
              <button
                type="button"
                className="sheet-approvals"
                onClick={() => {
                  setSheetOpen(false);
                  setTrayOpen(true);
                }}
              >
                Approvals
                {pending > 0 && <span className="topbar-badge num">{pending}</span>}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
