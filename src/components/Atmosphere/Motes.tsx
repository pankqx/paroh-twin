// Motes for the Twin page, where the Aurora is already the heavy effect (so no canvas here).
// Plain divs: each is its own composited layer moved by transform/opacity only.
// Deterministic positions so server and client agree.
const MOTES = Array.from({ length: 18 }, (_, i) => {
  const s = (i * 9301 + 49297) % 233280;
  const t = (i * 7411 + 12345) % 233280;
  return {
    x: 4 + (s / 233280) * 92,
    y: 8 + (t / 233280) * 84,
    size: 3 + (i % 4),
    dur: 14 + (i % 6) * 3,
    delay: -(i * 1.7),
    dx: (i % 2 ? 1 : -1) * (14 + (i % 5) * 6),
    dy: (i % 3 ? -1 : 1) * (18 + (i % 4) * 8),
  };
});

export default function Motes({ accent }: { accent: [string, string] }) {
  return (
    <div className="atmo-motes">
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="atmo-mote"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: m.size,
            height: m.size,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
            ["--c" as string]: accent[i % 2],
            ["--dx" as string]: `${m.dx}px`,
            ["--dy" as string]: `${m.dy}px`,
          }}
        />
      ))}
    </div>
  );
}
