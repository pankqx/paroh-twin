import { RINGS } from "./config";

/**
 * Big hairline orbits, partly off-screen, each slowly turning with small planets on it.
 * Built from divs (not SVG) so each ring is its own composited layer: the browser only moves
 * it on the GPU, it never repaints. An ellipse is a circle inside a squished wrapper, so its
 * planet travels along the ellipse. Coordinates are in a 1600 x 1000 space scaled to cover.
 */
export default function OrbitLines({ rings, accent }: { rings: number[]; accent: [string, string] }) {
  return (
    <div className="atmo-orbits">
      {rings.map((idx, n) => {
        const ring = RINGS[idx];
        const colour = accent[n % 2];
        return (
          <div
            key={idx}
            className={`atmo-ring ring-${n}`}
            style={{
              ["--cx" as string]: ring.cx,
              ["--cy" as string]: ring.cy,
              ["--r" as string]: ring.r,
              ["--tilt" as string]: `${ring.tilt}deg`,
              ["--sq" as string]: ring.squish,
            }}
          >
            <div
              className="atmo-spin"
              style={{ animationDuration: `${ring.dur}s`, animationDirection: ring.reverse ? "reverse" : "normal" }}
            >
              {Array.from({ length: ring.dots }, (_, d) => (
                <span
                  key={d}
                  className="atmo-dot"
                  style={{ ["--a" as string]: `${((d / ring.dots) * 360 + idx * 57) % 360}deg`, ["--dot" as string]: colour }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
