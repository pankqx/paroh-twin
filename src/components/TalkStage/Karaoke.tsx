"use client";

import { useEffect, useState } from "react";

/**
 * Her question as a karaoke caption. The sentence she is saying right now is lit, and the
 * lit word advances at about her speaking pace. The speech engine reports the sentence, not
 * each word, so the word position is an estimate that resets on every sentence.
 */
export default function Karaoke({ line, sentence, speaking }: { line: string; sentence: string; speaking: boolean }) {
  const at = speaking && sentence ? line.indexOf(sentence) : -1;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (at < 0) return;
    const words = sentence.split(/\s+/).filter(Boolean);
    let i = 0;
    let timer = 0;
    const step = () => {
      setIdx(i);
      if (i >= words.length) return;
      const ms = 90 + words[i].length * 62;
      i += 1;
      timer = window.setTimeout(step, ms);
    };
    step();
    return () => window.clearTimeout(timer);
  }, [sentence, at < 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (at < 0) return <>{line}</>;

  const parts = sentence.split(/(\s+)/);
  const order: number[] = []; // word number of each part, -1 for spaces
  let n = 0;
  for (const part of parts) order.push(/\S/.test(part) ? n++ : -1);
  return (
    <>
      <span className="k-said">{line.slice(0, at)}</span>
      {parts.map((part, i) => {
        const w = order[i];
        if (w < 0) return part;
        const cls = w < idx ? "k-said" : w === idx ? "k-now" : "k-next";
        return (
          <span key={i} className={cls}>
            {part}
          </span>
        );
      })}
      <span className="k-next">{line.slice(at + sentence.length)}</span>
    </>
  );
}
