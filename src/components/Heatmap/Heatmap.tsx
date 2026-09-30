"use client";

import { useState } from "react";
import "./Heatmap.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FIRST_HOUR = 6;
const LAST_HOUR = 23; // last cell is 23:00-24:00
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
const LEVEL_LABELS = ["very light", "light", "moderate", "strong", "peak"];

const IDLE_CAPTION = "Hover or focus a cell to see how focused you usually are then.";

function levelOf(v: number) {
  return Math.min(4, Math.max(0, Math.floor(v * 5)));
}

function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

/** data: 7 rows (Mon-Sun) x 24 hours, values 0-1. */
export default function Heatmap({ data }: { data: number[][] }) {
  const [caption, setCaption] = useState(IDLE_CAPTION);

  return (
    <div className="heatmap">
      <div className="heatmap-grid" role="group" aria-label="Focus hours by weekday and hour">
        <span />
        {HOURS.map((h) => (
          <span key={h} className="heatmap-hour">
            {(h - FIRST_HOUR) % 3 === 0 ? h : ""}
          </span>
        ))}

        {DAYS.map((day, d) => (
          <Row key={day} day={day} row={d} values={data[d] ?? []} onPick={setCaption} />
        ))}
      </div>
      <p className="heatmap-caption" aria-live="polite">
        {caption}
      </p>
    </div>
  );
}

function Row({
  day,
  row,
  values,
  onPick,
}: {
  day: string;
  row: number;
  values: number[];
  onPick: (caption: string) => void;
}) {
  return (
    <>
      <span className="heatmap-day">{day}</span>
      {HOURS.map((h) => {
        const v = values[h] ?? 0;
        const level = levelOf(v);
        const text = `${day} ${hourLabel(h)}: ${LEVEL_LABELS[level]} focus (${Math.round(v * 100)}%)`;
        return (
          <span
            key={h}
            className={`heatmap-cell level-${level}`}
            // diagonal light-up wave
            style={{ ["--d" as string]: `${(h - FIRST_HOUR + row) * 28}ms` }}
            tabIndex={0}
            aria-label={text}
            onMouseEnter={() => onPick(text)}
            onFocus={() => onPick(text)}
          />
        );
      })}
    </>
  );
}
