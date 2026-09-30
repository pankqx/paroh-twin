"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dataService } from "@/app/dataService";
import { notifyFactsChanged } from "@/components/shell/events";
import type { MemoryGraph as Graph, MemoryNodeKind } from "@/lib/twin/memoryGraph";
import type { Fact } from "@/lib/types";
import "./MemoryGraph.css";

const W = 1000;
const H = 640;
const COLOUR: Record<MemoryNodeKind, string> = {
  fact: "var(--teal)",
  domain: "var(--violet)",
  task: "var(--amber)",
  goal: "var(--green)",
  habit: "var(--rose)",
};
const KINDS = Object.keys(COLOUR) as MemoryNodeKind[];
const radius = (kind: MemoryNodeKind, weight: number) => (kind === "domain" ? 15 : 7) + weight * 5;

interface Sim {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
}

function seed(graph: Graph): Sim[] {
  const n = graph.nodes.length;
  return graph.nodes.map((node, i) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2;
    const r = 120 + ((i * 37) % 160);
    return { id: node.id, x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r * 0.7, vx: 0, vy: 0, fixed: false };
  });
}

/** One step of a simple spring system. Returns the largest speed so the caller can settle. */
function step(sims: Sim[], index: Map<string, number>, links: Graph["links"], alpha: number): number {
  for (let i = 0; i < sims.length; i++) {
    for (let j = i + 1; j < sims.length; j++) {
      const a = sims[i];
      const b = sims[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const d2 = Math.max(dx * dx + dy * dy, 36);
      const d = Math.sqrt(d2);
      const f = (2600 / d2) * alpha;
      dx /= d;
      dy /= d;
      a.vx += dx * f;
      a.vy += dy * f;
      b.vx -= dx * f;
      b.vy -= dy * f;
    }
  }
  for (const l of links) {
    const a = sims[index.get(l.source)!];
    const b = sims[index.get(l.target)!];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.max(Math.hypot(dx, dy), 1);
    const f = (d - 95) * 0.02 * alpha;
    a.vx += (dx / d) * f;
    a.vy += (dy / d) * f;
    b.vx -= (dx / d) * f;
    b.vy -= (dy / d) * f;
  }
  let max = 0;
  for (const s of sims) {
    s.vx += (W / 2 - s.x) * 0.004 * alpha;
    s.vy += (H / 2 - s.y) * 0.006 * alpha;
    if (s.fixed) {
      s.vx = s.vy = 0;
      continue;
    }
    s.vx *= 0.82;
    s.vy *= 0.82;
    s.x = Math.min(W - 24, Math.max(24, s.x + s.vx));
    s.y = Math.min(H - 24, Math.max(24, s.y + s.vy));
    max = Math.max(max, Math.hypot(s.vx, s.vy));
  }
  return max;
}

export default function MemoryGraph() {
  const reduce = useReducedMotion();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<Fact | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const svg = useRef<SVGSVGElement>(null);
  const sims = useRef<Sim[]>([]);
  const index = useRef(new Map<string, number>());
  const nodeEls = useRef(new Map<string, SVGGElement>());
  const linkEls = useRef<Array<SVGLineElement | null>>([]);
  const raf = useRef(0);
  const alpha = useRef(1);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const reduceRef = useRef(false);
  reduceRef.current = !!reduce;

  const load = useCallback(async () => {
    try {
      setGraph(await dataService.getMemoryGraph());
    } catch {
      setError("I couldn't read the memory graph.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const paint = useCallback(() => {
    const g = graph;
    if (!g) return;
    for (const s of sims.current) nodeEls.current.get(s.id)?.setAttribute("transform", `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`);
    g.links.forEach((l, i) => {
      const a = sims.current[index.current.get(l.source)!];
      const b = sims.current[index.current.get(l.target)!];
      const el = linkEls.current[i];
      if (!a || !b || !el) return;
      el.setAttribute("x1", a.x.toFixed(1));
      el.setAttribute("y1", a.y.toFixed(1));
      el.setAttribute("x2", b.x.toFixed(1));
      el.setAttribute("y2", b.y.toFixed(1));
    });
  }, [graph]);

  const run = useCallback(() => {
    if (!graph || raf.current) return;
    const tick = () => {
      alpha.current = Math.max(alpha.current * 0.985, 0.02);
      const speed = step(sims.current, index.current, graph.links, alpha.current);
      paint();
      if (speed < 0.05 && !drag.current && alpha.current <= 0.03) {
        raf.current = 0; // settled: stop the loop
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [graph, paint]);

  // (Re)build the simulation whenever the graph changes.
  useEffect(() => {
    if (!graph) return;
    sims.current = seed(graph);
    index.current = new Map(graph.nodes.map((n, i) => [n.id, i]));
    alpha.current = 1;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    if (reduceRef.current) {
      // Static layout: settle off-screen, draw once.
      for (let i = 0; i < 320; i++) step(sims.current, index.current, graph.links, Math.max(1 - i / 320, 0.05));
      paint();
    } else {
      paint();
      run();
    }
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [graph, paint, run]);

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of graph?.links ?? []) {
      (m.get(l.source) ?? m.set(l.source, new Set()).get(l.source)!).add(l.target);
      (m.get(l.target) ?? m.set(l.target, new Set()).get(l.target)!).add(l.source);
    }
    return m;
  }, [graph]);

  const toSvg = (e: React.PointerEvent) => {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onDown = (e: React.PointerEvent, id: string) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { id, moved: false };
    const s = sims.current[index.current.get(id)!];
    if (s) s.fixed = true;
    alpha.current = Math.max(alpha.current, 0.4);
    if (!reduce) run();
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const s = sims.current[index.current.get(d.id)!];
    if (!s) return;
    const p = toSvg(e);
    s.x = Math.min(W - 24, Math.max(24, p.x));
    s.y = Math.min(H - 24, Math.max(24, p.y));
    d.moved = true;
    if (reduce) paint();
  };
  const onUp = async (id: string) => {
    const d = drag.current;
    drag.current = null;
    const s = sims.current[index.current.get(id)!];
    if (s) s.fixed = false;
    if (d && !d.moved) await open(id);
  };

  async function open(id: string) {
    if (!id.startsWith("fact:")) return;
    const fact = await dataService.facts.get(id.slice(5));
    if (!fact) return;
    setSelected(fact);
    setEditing(false);
    setDraft(fact.text);
    setError("");
  }

  async function saveEdit() {
    if (!selected || !draft.trim()) return;
    try {
      const f = await dataService.setFactStatus!(selected.id, "edit", { text: draft.trim() });
      setSelected(f);
      setEditing(false);
      notifyFactsChanged();
      load();
    } catch {
      setError("I couldn't save that edit.");
    }
  }
  async function reject() {
    if (!selected) return;
    try {
      await dataService.setFactStatus!(selected.id, "reject");
      setSelected(null);
      notifyFactsChanged();
      load();
    } catch {
      setError("I couldn't reject that fact.");
    }
  }

  const dim = (id: string) => hover && hover !== id && !neighbours.get(hover)?.has(id);

  return (
    <main className="page memory">
      <header className="mg-head">
        <h1>Memory</h1>
        <p>What your twin holds and how it connects. Drag a node, hover to see its neighbours, click a fact to open it.</p>
        <ul className="mg-legend" aria-label="Legend">
          {KINDS.map((k) => (
            <li key={k}>
              <i style={{ background: COLOUR[k] }} />
              {k}
            </li>
          ))}
        </ul>
      </header>

      <div className={`mg-wrap${selected ? " with-panel" : ""}`}>
        <div className="glass mg-stage">
          {graph && graph.nodes.length === 0 && <p className="mg-empty">Nothing in memory yet. Approve a fact in Talk or Journal and it appears here.</p>}
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Memory graph" onPointerMove={onMove}>
            <defs>
              <filter id="mg-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {graph?.links.map((l, i) => {
              const on = hover && (l.source === hover || l.target === hover);
              return <line key={`${l.source}|${l.target}`} ref={(el) => void (linkEls.current[i] = el)} className={`mg-link${on ? " on" : ""}${hover && !on ? " dim" : ""}`} />;
            })}
            {graph?.nodes.map((n, i) => {
              const r = radius(n.kind, n.weight);
              const isSel = selected && n.id === `fact:${selected.id}`;
              return (
                <motion.g
                  key={n.id}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: dim(n.id) ? 0.22 : 1 }}
                  transition={{ duration: 0.25, delay: hover ? 0 : i * 0.012 }}
                >
                  <g
                    ref={(el) => {
                      if (el) nodeEls.current.set(n.id, el);
                      else nodeEls.current.delete(n.id);
                    }}
                    className={`mg-node ${n.kind}${isSel ? " sel" : ""}`}
                    tabIndex={0}
                    role={n.kind === "fact" ? "button" : "img"}
                    aria-label={`${n.kind}: ${n.label}`}
                    onPointerDown={(e) => onDown(e, n.id)}
                    onPointerUp={() => onUp(n.id)}
                    onPointerEnter={() => setHover(n.id)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(n.id)}
                    onBlur={() => setHover(null)}
                    onKeyDown={(e) => e.key === "Enter" && open(n.id)}
                  >
                    <circle r={r} fill={COLOUR[n.kind]} fillOpacity={0.35 + n.weight * 0.4} stroke={COLOUR[n.kind]} strokeWidth={isSel ? 3 : 1.5} filter="url(#mg-glow)" />
                    {(n.kind === "domain" || hover === n.id || isSel) && (
                      <text y={r + 14} textAnchor="middle">
                        {n.label.length > 36 ? `${n.label.slice(0, 34)}…` : n.label}
                      </text>
                    )}
                  </g>
                </motion.g>
              );
            })}
          </svg>
        </div>

        {selected && (
          <aside className="glass mg-panel" aria-label="Fact details">
            <header>
              <h2>Fact</h2>
              <button type="button" className="btn-text" onClick={() => setSelected(null)} aria-label="Close">
                Close
              </button>
            </header>
            {editing ? (
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} aria-label="Edit fact text" />
            ) : (
              <p className="mg-text">{selected.text}</p>
            )}
            <dl>
              <div>
                <dt>Kind</dt>
                <dd>{selected.kind}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{selected.sourceType === "question" ? "Voice answer" : selected.sourceType}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd className="num">{Math.round(selected.confidence * 100)}%</dd>
              </div>
            </dl>
            <div className="mg-actions">
              {editing ? (
                <>
                  <button type="button" className="btn-primary btn-small" onClick={saveEdit} disabled={!draft.trim()}>
                    Save
                  </button>
                  <button type="button" className="btn-ghost btn-small" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-ghost btn-small" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button type="button" className="btn-ghost btn-small" onClick={reject}>
                    Reject
                  </button>
                </>
              )}
            </div>
            {error && <p role="alert">{error}</p>}
          </aside>
        )}
      </div>
      {!selected && error && <p role="alert">{error}</p>}
    </main>
  );
}
