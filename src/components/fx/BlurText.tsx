"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ElementType } from "react";
import "./BlurText.css";

/**
 * BlurText. Hand-written equivalent of the React Bits "Blur Text" role, built on
 * `motion`: words (or letters) arrive out of a blur, staggered. The accessible
 * name is always the full text.
 */
export default function BlurText({
  text,
  as: Tag = "h1",
  animateBy = "words",
  direction = "top",
  delay = 0.08,
  className,
}: {
  text: string;
  as?: ElementType;
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom";
  delay?: number; // seconds between pieces
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <Tag className={className}>{text}</Tag>;

  const pieces = animateBy === "words" ? text.split(" ") : Array.from(text);
  const y = direction === "top" ? -14 : 14;

  return (
    <Tag className={`fx-blur-text ${className ?? ""}`} aria-label={text}>
      {pieces.map((piece, i) => (
        <motion.span
          key={`${piece}-${i}`}
          aria-hidden="true"
          className="fx-blur-piece"
          initial={{ opacity: 0, y, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: i * delay, ease: [0.2, 0.7, 0.2, 1] }}
        >
          {piece}
          {animateBy === "words" && i < pieces.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </Tag>
  );
}
