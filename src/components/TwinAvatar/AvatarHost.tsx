"use client";

import { animate, motion, useMotionValue } from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import StageFX from "@/components/TwinStage/StageFX";
import { useLive, usePrefs } from "./avatarStore";
import TwinAvatar from "./TwinAvatar";
import "./AvatarHost.css";

type Route = "home" | "talk" | "off";
const routeOf = (p: string): Route => (p === "/" ? "home" : p.startsWith("/talk") ? "talk" : "off");
const ASPECT = 600 / 900;
const EASE = [0.2, 0.7, 0.2, 1] as const;

interface Spot {
  x: number;
  y: number;
  s: number;
  cx: number;
  top: number;
  h: number;
}

/**
 * The one avatar. It lives in the root layout so it is never remounted: changing route only
 * moves her to the next page's anchor box and, on /talk, blooms her from line art into colour.
 */
export default function AvatarHost() {
  const pathname = usePathname();
  const route = routeOf(pathname);
  const live = useLive();
  const prefs = usePrefs();

  const hostRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(0);
  const prevRoute = useRef<Route | null>(null);
  const moving = useRef(false);
  const routeRef = useRef(route);
  useEffect(() => {
    routeRef.current = route;
  });

  const measure = useCallback((kind: "home" | "talk"): Spot | null => {
    const el = document.querySelector(`[data-avatar-anchor="${kind}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.height < 10) return null;
    const vh = window.innerHeight;
    const s = r.height / vh;
    const w0 = vh * ASPECT;
    const cx = r.left + r.width / 2;
    return { x: cx - (w0 * s) / 2, y: r.top, s, cx, top: r.top, h: r.height };
  }, []);

  const writeStage = useCallback((m: Spot) => {
    const host = hostRef.current;
    if (!host) return;
    host.style.setProperty("--cx", `${m.cx}px`);
    host.style.setProperty("--top", `${m.top}px`);
    host.style.setProperty("--h", `${m.h}px`);
  }, []);

  // Route changes: find the new anchor, then glide to it (form animates inside the avatar).
  useEffect(() => {
    const prev = prevRoute.current;
    prevRoute.current = route;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controls: Array<{ stop: () => void }> = [];
    let raf = 0;
    let tries = 0;

    if (route === "off") {
      controls.push(animate(opacity, 0, { duration: reduce ? 0 : 0.45 }));
      return () => controls.forEach((c) => c.stop());
    }

    const go = () => {
      const m = measure(route);
      if (!m) {
        if (tries++ < 90) raf = requestAnimationFrame(go);
        return;
      }
      writeStage(m);
      const fresh = prev === null || prev === "off" || reduce;
      if (fresh) {
        x.set(m.x);
        y.set(m.y);
        scale.set(m.s);
        controls.push(animate(opacity, 1, { duration: reduce ? 0 : 0.6 }));
      } else {
        moving.current = true;
        const opts = { duration: 1.6, ease: EASE };
        const all = [animate(x, m.x, opts), animate(y, m.y, opts), animate(scale, m.s, opts), animate(opacity, 1, { duration: 0.4 })];
        controls.push(...all);
        Promise.all(all.map((a) => a.finished)).then(() => {
          moving.current = false;
        });
      }
    };
    go();
    return () => {
      cancelAnimationFrame(raf);
      controls.forEach((c) => c.stop());
      moving.current = false;
    };
  }, [route, measure, writeStage, x, y, scale, opacity]);

  // While she is settled, keep her glued to the anchor as the page scrolls or resizes.
  useEffect(() => {
    if (route === "off") return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      if (moving.current) return;
      const m = measure(route);
      if (!m) return;
      x.set(m.x);
      y.set(m.y);
      scale.set(m.s);
      writeStage(m);
      // Fade out once her box has scrolled off the top or bottom of the screen.
      const vh = window.innerHeight;
      const visible = m.top + m.h * 0.3 < vh && m.top + m.h > 60;
      opacity.set(visible ? 1 : 0);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    const a = document.querySelector(`[data-avatar-anchor="${route}"]`);
    if (a) ro.observe(a);
    const t = window.setTimeout(schedule, 400);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [route, measure, writeStage, x, y, scale, opacity]);

  const expression = live.state === "thinking" ? "curious" : "smile";

  return (
    <div ref={hostRef} className={`avatar-host route-${route}`} aria-hidden={route === "off" ? true : undefined}>
      <StageFX active={route === "talk"} state={live.state} level={live.level} />
      <motion.div className="avatar-mover" style={{ x, y, scale, opacity, originX: 0, originY: 0 }}>
        <TwinAvatar
          form={route === "talk" ? 1 : 0}
          state={live.state}
          mouth={live.mouth}
          level={live.level}
          look={prefs.look}
          skin={prefs.skin}
          hair={prefs.hair}
          outfit={prefs.outfit}
          expression={expression}
          paused={route === "off"}
        />
      </motion.div>
    </div>
  );
}
