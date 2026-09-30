"use client";

import { useEffect, useState } from "react";

/**
 * True once the Home to Talk view-transition morph has finished. The transition is started by
 * React after this page commits, so we look for the browser's ::view-transition animations for
 * a few frames and wait for them to finish. If none appear (direct load, unsupported browser,
 * reduced motion) it is true straight away, with a hard cap so the page never waits for long.
 */
export function useMorphEnd(): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      return;
    }
    let dead = false;
    let frames = 0;
    let raf = 0;
    const cap = window.setTimeout(() => !dead && setDone(true), 1600);
    const finish = () => !dead && setDone(true);
    const look = () => {
      const running = document.getAnimations().filter((a) => {
        const p = (a.effect as KeyframeEffect | null)?.pseudoElement ?? "";
        return p.startsWith("::view-transition");
      });
      if (running.length) {
        Promise.allSettled(running.map((a) => a.finished)).then(finish);
        return;
      }
      if (++frames > 12) return finish();
      raf = requestAnimationFrame(look);
    };
    raf = requestAnimationFrame(look);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(cap);
    };
  }, []);
  return done;
}

/** Reveals `text` a word at a time whenever it changes. All at once under reduced motion. */
export function useTypedWords(text: string, msPerWord = 70): string {
  const [n, setN] = useState(0);
  const words = text.split(/(\s+)/);
  const total = words.filter((w) => /\S/.test(w)).length;
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(total);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= total) window.clearInterval(id);
    }, msPerWord);
    return () => window.clearInterval(id);
  }, [text, total, msPerWord]);
  if (n >= total) return text;
  let seen = 0;
  let out = "";
  for (const w of words) {
    if (/\S/.test(w)) {
      if (seen >= n) break;
      seen += 1;
    }
    out += w;
  }
  return out;
}
