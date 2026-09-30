"use client";

import type { CSSProperties } from "react";
import { play } from "./avatarStore";

/**
 * Marks where the persistent avatar should stand on a page. The page decides the size and
 * position of this box; the avatar (mounted once in the root layout) glides to it. Clicking
 * or pressing Enter on it makes her wave.
 */
export default function AvatarAnchor({ kind, className, style }: { kind: "home" | "talk"; className?: string; style?: CSSProperties }) {
  return (
    <div
      data-avatar-anchor={kind}
      className={`avatar-anchor${className ? ` ${className}` : ""}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-label="Your twin. Activate to make her wave."
      onClick={() => play("wave")}
      onKeyDown={(e) => {
        if (e.key === "Enter") play("wave");
      }}
    />
  );
}
