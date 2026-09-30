"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LeafMark from "./LeafMark";
import "./Navbar.css";

const LINKS = [
  { href: "/", label: "Twin" },
  { href: "/journal", label: "Journal" },
  { href: "/ask", label: "Ask" },
  { href: "/approvals", label: "Approvals" },
  { href: "/privacy", label: "Privacy" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function Navbar() {
  const pathname = usePathname();
  if (pathname.startsWith("/welcome")) return null;

  return (
    <header className="navbar">
      <Link href="/" className="navbar-brand">
        <LeafMark />
        <span>Paroh</span>
      </Link>

      <nav className="navbar-links" aria-label="Main">
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={isActive(pathname, href) ? "active" : undefined}
            aria-current={isActive(pathname, href) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="navbar-right">
        <span className="navbar-pill">sample data</span>
        <button type="button" className="btn-text">
          Voice on
        </button>
        <button type="button" className="btn-text">
          Reset
        </button>
      </div>
    </header>
  );
}
