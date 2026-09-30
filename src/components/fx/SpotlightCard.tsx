"use client";

import { useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import "./SpotlightCard.css";

/**
 * SpotlightCard. Hand-written equivalent of the React Bits "Spotlight Card"
 * role: a glass card with a soft light that follows the pointer. The light is a
 * separate layer moved with transform and faded with opacity.
 */
export default function SpotlightCard({
  as: Tag = "div",
  spotlightColor = "color-mix(in srgb, var(--violet) 22%, transparent)",
  className,
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  spotlightColor?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  [key: string]: unknown;
}) {
  const ref = useRef<HTMLElement>(null);
  const light = useRef<HTMLSpanElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    const spot = light.current;
    if (!el || !spot) return;
    const r = el.getBoundingClientRect();
    spot.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
  };

  return (
    <Tag
      ref={ref}
      className={`glass fx-spotlight ${className ?? ""}`}
      style={{ ["--spot" as string]: spotlightColor, ...style }}
      onPointerMove={onMove}
      {...rest}
    >
      <span ref={light} className="fx-spotlight-light" aria-hidden="true" />
      {children}
    </Tag>
  );
}
