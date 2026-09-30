import { MARQUEE } from "./config";

/** A slow ticker of the product's honesty lines. Pauses on hover. */
export default function Marquee() {
  return (
    <div className="atmo-marquee">
      <div className="atmo-marquee-track">
        <span>{MARQUEE} · </span>
        <span>{MARQUEE} · </span>
      </div>
    </div>
  );
}
