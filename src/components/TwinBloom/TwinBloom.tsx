import "./TwinBloom.css";

export interface BloomDomain {
  key: string;
  label: string;
  confidence: number; // 0-1
}

interface Props {
  domains: BloomDomain[]; // drawn clockwise from the top
  load: number; // weekly workload, percent (0-100+)
  fidelity: number; // 0-1
  /** domain key -> confidence before it grew; those leaves extend once, after the entrance */
  grew?: Record<string, number>;
}

const SIZE = 380;
const C = SIZE / 2;
const HUB = 28; // centre circle radius
const MIN_LEAF = 22; // shortest leaf, so a low domain is still visible
const MAX_LEAF = 92;
const LEAF_HALF_WIDTH = 17;
const LABEL_R = 152;
const RING_R = 176;
const DASHED_BELOW = 0.3;

function loadColour(load: number) {
  if (load > 85) return "var(--rust)";
  if (load >= 60) return "var(--amber)";
  return "var(--forest)";
}

function leafPath(length: number) {
  const y0 = -HUB;
  const y1 = -(HUB + length);
  const w = LEAF_HALF_WIDTH;
  return [
    `M0 ${y0}`,
    `C ${w} ${y0 - length * 0.3} ${w} ${y0 - length * 0.78} 0 ${y1}`,
    `C ${-w} ${y0 - length * 0.78} ${-w} ${y0 - length * 0.3} 0 ${y0}`,
    "Z",
  ].join(" ");
}

export default function TwinBloom({ domains, load, fidelity, grew = {} }: Props) {
  const step = 360 / domains.length;
  const circumference = 2 * Math.PI * RING_R;
  const arc = (Math.min(Math.max(load, 0), 100) / 100) * circumference;
  const fidelityPct = Math.round(fidelity * 100);

  const summary = domains
    .map((d) => `${d.label} ${Math.round(d.confidence * 100)}%`)
    .join(", ");

  return (
    <svg
      className="bloom"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Twin Bloom. Fidelity ${fidelityPct}%. Weekly workload ${Math.round(load)}%. Confidence by area: ${summary}.`}
    >
      {/* weekly workload ring */}
      <g transform={`rotate(-90 ${C} ${C})`}>
        <circle className="bloom-track" cx={C} cy={C} r={RING_R} />
        <circle
          className="bloom-arc"
          cx={C}
          cy={C}
          r={RING_R}
          stroke={loadColour(load)}
          strokeDasharray={`${arc} ${circumference}`}
          style={{ ["--arc-full" as string]: circumference }}
        />
      </g>

      {/* leaves */}
      <g transform={`translate(${C} ${C})`}>
        {domains.map((d, i) => {
          const conf = Math.min(Math.max(d.confidence, 0), 1);
          const length = MIN_LEAF + conf * (MAX_LEAF - MIN_LEAF);
          const sparse = conf < DASHED_BELOW;
          const was = grew[d.key];
          const extend =
            was !== undefined && was < conf
              ? (MIN_LEAF + Math.max(was, 0) * (MAX_LEAF - MIN_LEAF)) / length
              : undefined;
          return (
            <g key={d.key} transform={`rotate(${i * step})`}>
              <g className="bloom-leaf" style={{ animationDelay: `${i * 80}ms` }}>
                <g
                  className={extend !== undefined ? "leaf-extend" : undefined}
                  style={extend !== undefined ? { ["--from" as string]: extend } : undefined}
                >
                  <path
                    d={leafPath(length)}
                    className={sparse ? "leaf leaf-sparse" : "leaf"}
                  />
                </g>
              </g>
            </g>
          );
        })}

        {/* labels */}
        {domains.map((d, i) => {
          const a = ((i * step - 90) * Math.PI) / 180;
          return (
            <text
              key={d.key}
              className="bloom-label"
              x={Math.cos(a) * LABEL_R}
              y={Math.sin(a) * LABEL_R}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {d.label}
            </text>
          );
        })}

        {/* hub */}
        <circle className="bloom-hub" r={HUB} />
        <text className="bloom-fidelity" textAnchor="middle" dominantBaseline="central">
          {fidelityPct}%
        </text>
      </g>
    </svg>
  );
}
