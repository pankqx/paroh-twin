"use client";

import ChooseTwin from "@/components/TwinStage/ChooseTwin";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { dataService } from "@/app/dataService";
import Doodle from "@/components/Doodle/Doodle";
import { notifyFactsChanged } from "@/components/shell/events";
import type { ConnectorKind } from "@/lib/data/DataService";
import type { ConsentCategory, Fact } from "@/lib/types";
import { connectorSamples } from "@/mock/connectorSamples";
import "./Sources.css";

type Live = { id: "journal" | "voice" | "tasks"; label: string; href: string; consent: ConsentCategory; colour: string };
type Road = { id: ConnectorKind; label: string; colour: string; learns: string[]; permission: string };

const LIVE: Live[] = [
  { id: "journal", label: "Journal", href: "/journal", consent: "journal", colour: "var(--violet)" },
  { id: "voice", label: "Voice answers", href: "/talk", consent: "voice", colour: "var(--teal)" },
  { id: "tasks", label: "Tasks and planner", href: "/rhythm", consent: "tasks", colour: "var(--amber)" },
];

const ROAD: Road[] = [
  {
    id: "gmail",
    label: "Gmail",
    colour: "var(--rose)",
    learns: ["Assignment and exam deadlines mentioned in email", "Dates you commit to (\"I will submit by…\")"],
    permission: "Read-only access to the labels or threads you choose. Nothing is sent, changed or deleted.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    colour: "var(--green)",
    learns: ["Group study plans and meeting times", "Tasks you agree to in chats you pick"],
    permission: "Access to only the chats you choose to share. No other chats are read.",
  },
  {
    id: "telegram",
    label: "Telegram",
    colour: "var(--teal)",
    learns: ["Exam timetables and project deadlines shared in class channels", "Study sessions you plan with friends"],
    permission: "Access to only the channels and chats you choose to share.",
  },
  {
    id: "calendar",
    label: "Calendar",
    colour: "var(--lilac)",
    learns: ["Exam dates, classes and study sessions", "Busy and free hours for realistic plans"],
    permission: "Read-only access to the calendars you choose. Events are never edited.",
  },
];

const CONSENTS: Array<{ key: ConsentCategory; label: string; note: string }> = [
  { key: "journal", label: "Journal", note: "Entries and text you ask her to read for facts." },
  { key: "tasks", label: "Tasks and habits", note: "Tasks, estimates, deadlines and habit check-ins." },
  { key: "mood", label: "Mood and energy", note: "The 1-5 check-ins, used for planning patterns only." },
  { key: "planner", label: "Planner", note: "Goals and calendar-style planning data." },
  { key: "voice", label: "Voice answers", note: "Facts she can suggest from what you say in Talk." },
];

const HONESTY = [
  "Hosted language model via OpenRouter, not on-device. The preview above shows what is sent.",
  "No audio is recorded or stored. Browser speech input may use the browser vendor's speech service.",
  "Monitoring and notifications run on sample data while the app is open. Real, continuous monitoring needs the connectors, which are roadmap.",
  "The twin is an explainable approximation with a fidelity score, not a perfect prediction.",
  "Not a therapy or mental-health product. Mood and energy are planning inputs only.",
  "Everything here is sample data for the student \"Asha\". Nothing is connected to a real account.",
];

// Position of each of the 7 tiles on the orbit, as a share of the stage (matches the SVG viewBox).
const W = 900;
const H = 480;
const RX = 330;
const RY = 172;
const slots = Array.from({ length: LIVE.length + ROAD.length }, (_, i) => {
  const a = (i / (LIVE.length + ROAD.length)) * Math.PI * 2 - Math.PI / 2;
  return { x: W / 2 + RX * Math.cos(a), y: H / 2 + RY * Math.sin(a) };
});

const PREVIEW_TEXT = "I will finish my biology revision by Friday.";

interface Counts {
  journal: number;
  voice: number;
  tasks: number;
}

async function fetchAll() {
  const [c, entries, facts, tasks] = await Promise.all([dataService.getConsent(), dataService.entries.list(), dataService.facts.list(), dataService.tasks.list()]);
  return {
    consent: c as unknown as Record<string, boolean>,
    counts: { journal: entries.length, voice: facts.filter((f) => f.sourceType === "question").length, tasks: tasks.length },
    payload: await dataService.previewPayload("extract", { text: PREVIEW_TEXT, source: "journal", sourceId: "payload-preview" }),
  };
}

export default function Sources() {
  const reduce = useReducedMotion();
  const [consent, setConsent] = useState<Record<string, boolean> | null>(null);
  const [counts, setCounts] = useState<Counts>({ journal: 0, voice: 0, tasks: 0 });
  const [open, setOpen] = useState<ConnectorKind | null>(null);
  const [preview, setPreview] = useState<Partial<Record<ConnectorKind, { facts: Fact[]; waiting: number }>>>({});
  const [busy, setBusy] = useState<ConnectorKind | null>(null);
  const [payload, setPayload] = useState<{ categories: ConsentCategory[]; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [note, setNote] = useState("");

  const apply = useCallback((d: Awaited<ReturnType<typeof fetchAll>>) => {
    setConsent(d.consent);
    setCounts(d.counts);
    setPayload(d.payload);
  }, []);
  const load = useCallback(async () => apply(await fetchAll()), [apply]);

  useEffect(() => {
    let live = true;
    fetchAll()
      .then((d) => live && apply(d))
      .catch(() => live && setNote("I couldn't read your settings. Reload the page to try again."));
    return () => {
      live = false;
    };
  }, [apply]);

  async function toggle(key: ConsentCategory) {
    if (!consent) return;
    const next = { ...consent, [key]: !consent[key] };
    setConsent(next); // the switch moves at once; the service is the source of truth after
    try {
      await dataService.setConsent(next as never);
      await load();
    } catch {
      setNote("I couldn't save that setting.");
      await load().catch(() => {});
    }
  }

  async function runPreview(kind: ConnectorKind) {
    setBusy(kind);
    setNote("");
    try {
      // previewConnector stores its candidates as pending (ids are stable per sample message).
      // Put back anything already decided so re-running a preview never undoes an approval.
      const before = new Map((await dataService.facts.list()).map((f) => [f.id, f]));
      const facts = await dataService.previewConnector(kind);
      let waiting = 0;
      for (const fact of facts) {
        const existing = before.get(fact.id);
        if (existing && existing.status !== "pending") await dataService.facts.upsert(existing);
        else waiting++;
      }
      setPreview((p) => ({ ...p, [kind]: { facts, waiting } }));
      notifyFactsChanged();
    } catch {
      setNote("The preview didn't run. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  }

  async function wipe() {
    try {
      await dataService.resetAll();
      setPreview({});
      setOpen(null);
      setConfirming(false);
      setWiped(true);
      notifyFactsChanged();
      await load();
    } catch {
      setNote("I couldn't delete the data.");
    }
  }

  async function restoreSample() {
    await dataService.loadSampleData();
    setWiped(false);
    notifyFactsChanged();
    await load();
  }

  const pausedOf = (c: ConsentCategory) => (consent ? !consent[c] : false);
  const road = ROAD.find((r) => r.id === open);

  return (
    <main className="page sources">
      <header className="src-head">
        <h1>Sources</h1>
        <p>
          Where your twin learns from, and what you let it see. <strong>Every source ends at the same gate:</strong> you approve before the
          twin learns.
        </p>
      </header>

      <p className="src-banner" role="note">
        Sample messages. Real connectors are roadmap.
      </p>

      {/* The orbit: live sources feed the core, roadmap sources are dashed and not connected. */}
      <section className="src-orbit" aria-label="Sources around your twin">
        <svg className="src-lines" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <ellipse cx={W / 2} cy={H / 2} rx={RX} ry={RY} className="src-track" />
          {slots.map((s, i) => {
            const live = i < LIVE.length;
            const paused = live && pausedOf(LIVE[i].consent);
            return (
              <g key={i}>
                <motion.line
                  x1={s.x}
                  y1={s.y}
                  x2={W / 2}
                  y2={H / 2}
                  className={live ? (paused ? "src-link paused" : "src-link") : "src-link road"}
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, delay: 0.2 + i * 0.08 }}
                />
                {live && !paused && !reduce &&
                  [0, 1].map((k) => (
                    <motion.circle
                      key={k}
                      r="3.5"
                      fill={LIVE[i].colour}
                      initial={{ x: s.x, y: s.y, opacity: 0 }}
                      animate={{ x: [s.x, W / 2], y: [s.y, H / 2], opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 3.2, delay: k * 1.6 + i * 0.4, repeat: Infinity, ease: "easeIn" }}
                    />
                  ))}
              </g>
            );
          })}
        </svg>

        <div className="src-core">
          <span className="src-core-gate" aria-hidden="true" />
          <strong>Your twin</strong>
          <small>approval gate</small>
        </div>

        {slots.map((s, i) => {
          const style = { left: `${(s.x / W) * 100}%`, top: `${(s.y / H) * 100}%` };
          if (i < LIVE.length) {
            const l = LIVE[i];
            const paused = pausedOf(l.consent);
            const n = counts[l.id];
            return (
              <Link key={l.id} href={l.href} className={`src-tile live${paused ? " paused" : ""}`} style={{ ...style, ["--tile" as string]: l.colour }}>
                <span className="src-dot" aria-hidden="true" />
                <span className="src-name">{l.label}</span>
                <span className="src-state">{paused ? "paused: consent off" : l.id === "tasks" ? `live · sample · ${n} tasks` : `live · ${n} ${l.id === "journal" ? "entries" : "answers"}`}</span>
              </Link>
            );
          }
          const r = ROAD[i - LIVE.length];
          return (
            <button
              key={r.id}
              type="button"
              className={`src-tile road${open === r.id ? " open" : ""}`}
              style={{ ...style, ["--tile" as string]: r.colour }}
              aria-expanded={open === r.id}
              onClick={() => setOpen(open === r.id ? null : r.id)}
            >
              <span className="src-name">{r.label}</span>
              <span className="src-state">Roadmap - not connected</span>
            </button>
          );
        })}

        {!open && (
          <div className="src-doodle">
            <Doodle text="tap a dashed tile" arrow="down-left" />
          </div>
        )}
      </section>

      <AnimatePresence mode="wait">
        {road && (
          <motion.section
            key={road.id}
            className="glass src-panel"
            style={{ ["--glass-accent" as string]: road.colour }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            aria-label={`${road.label} connector`}
          >
            <header>
              <h2>{road.label}</h2>
              <span className="src-badge">Roadmap - not connected</span>
            </header>
            <div className="src-cols">
              <div>
                <h3>What it would learn</h3>
                <ul>
                  {road.learns.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <h3>Permission it would ask for</h3>
                <p>{road.permission}</p>
                <p className="src-gate">Every source ends at the same approval gate: nothing joins your twin until you approve it.</p>
                <button type="button" className="btn-primary" onClick={() => runPreview(road.id)} disabled={busy === road.id}>
                  {busy === road.id ? "Reading samples…" : "Preview with sample messages"}
                </button>
              </div>

              <div className="src-sample" aria-live="polite">
                <h3>
                  Sample messages <span className="src-badge soft">sample, not connected</span>
                </h3>
                {preview[road.id] ? (
                  <>
                    <ul className="src-msgs">
                      {connectorSamples[road.id].map((m) => {
                        const kinds = preview[road.id]!.facts.filter((f) => f.text === m).map((f) => f.kind);
                        return (
                          <li key={m}>
                            <q>{m}</q>
                            <span>{kinds.length ? `→ ${kinds.join(", ")}` : "→ nothing to keep"}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <ul className="src-cands" aria-label="Candidate facts">
                      {preview[road.id]!.facts.map((f) => (
                        <li key={f.id}>
                          <span className="kind-pill">{f.kind}</span> {f.text}
                        </li>
                      ))}
                    </ul>
                    <p className="src-sent">
                      {preview[road.id]!.waiting > 0 ? (
                        <>
                          <strong>{preview[road.id]!.waiting} candidate facts</strong> are waiting in Approvals. <Link href="/approvals">Open Approvals</Link>
                        </>
                      ) : (
                        <>These were already decided in Approvals, so nothing new was added. <Link href="/approvals">Open Approvals</Link></>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="src-hint">
                    These are made-up messages, shown so you can see how a source would feed the gate. Nothing is read from a real account.
                  </p>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {note && (
        <p className="src-note" role="alert">
          {note}
        </p>
      )}

      {/* Privacy: consent that really filters, and exactly what would be sent. */}
      <section className="src-privacy" aria-label="Privacy">
        <div className="glass src-card" style={{ ["--glass-accent" as string]: "var(--teal)" }}>
          <h2>What she may use</h2>
          <p className="src-sub">Switch a category off and it is left out of everything sent to the model.</p>
          <ul className="src-toggles">
            {CONSENTS.map((c) => {
              const on = consent ? consent[c.key] : false;
              return (
                <li key={c.key}>
                  <div>
                    <strong>{c.label}</strong>
                    <span>{c.note}</span>
                  </div>
                  <button type="button" role="switch" aria-checked={on} aria-label={c.label} className={`switch${on ? " on" : ""}`} onClick={() => toggle(c.key)} disabled={!consent}>
                    <i />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="glass src-card" style={{ ["--glass-accent" as string]: "var(--violet)" }}>
          <h2>What would be sent to the model</h2>
          <p className="src-sub">
            A preview for this journal line: <q>{PREVIEW_TEXT}</q>
          </p>
          {payload && (
            <>
              <p className="src-cats">
                {payload.categories.length ? (
                  payload.categories.map((c) => (
                    <span key={c} className="kind-pill">
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="src-empty">Nothing would be sent: Journal is off.</span>
                )}
                <span className="src-size num">{payload.text.length} characters</span>
              </p>
              <pre className="src-payload" tabIndex={0}>
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(payload.text), null, 2);
                  } catch {
                    return payload.text;
                  }
                })()}
              </pre>
            </>
          )}
        </div>
      </section>

      <section className="glass src-card src-honesty" aria-label="Honesty notes" style={{ ["--glass-accent" as string]: "var(--amber)" }}>
        <h2>Honesty notes</h2>
        <ul>
          {HONESTY.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className="src-danger" aria-label="Delete data">
        {wiped ? (
          <p>
            All data was deleted from this browser.{" "}
            <button type="button" className="btn-text" onClick={restoreSample}>
              Reload the sample data
            </button>
          </p>
        ) : confirming ? (
          <div className="src-confirm" role="alertdialog" aria-label="Confirm delete">
            <p>
              <strong>Delete all my data?</strong> This removes everything Paroh stored in this browser: entries, tasks, approved facts and
              settings. It cannot be undone.
            </p>
            <button type="button" className="btn-danger" onClick={wipe}>
              Yes, delete everything
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn-ghost btn-danger-ghost" onClick={() => setConfirming(true)}>
            Delete all my data
          </button>
        )}
      </section>
      <section className="src-appearance" aria-label="Twin appearance">
        <h2>Twin appearance</h2>
        <p>How your twin looks and sounds. A woman&rsquo;s look uses a female voice when your browser has one.</p>
        <ChooseTwin />
      </section>
    </main>
  );
}
