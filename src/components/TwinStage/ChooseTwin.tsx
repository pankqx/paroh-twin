"use client";

import { HAIRS, OUTFITS, SKINS, play, setPrefs, usePrefs } from "@/components/TwinAvatar/avatarStore";
import "./ChooseTwin.css";

/** Pick who your twin is: woman or man, a skin tone, hair and outfit. Saved in this browser. */
export default function ChooseTwin() {
  const prefs = usePrefs();
  const swatches = (label: string, items: Array<{ id: string; name: string }>, key: "skin" | "hair" | "outfit") => (
    <div className="ct-row" role="group" aria-label={label}>
      <span className="ct-label">{label}</span>
      <div className="ct-dots">
        {items.map((it) => (
          <button key={it.id} type="button" className={`ct-dot${prefs[key] === it.id ? " on" : ""}`} style={{ background: it.id }} aria-label={`${label}: ${it.name}`} aria-pressed={prefs[key] === it.id} title={it.name} onClick={() => setPrefs({ [key]: it.id })} />
        ))}
      </div>
    </div>
  );
  return (
    <section className="glass ct" aria-label="Choose your twin" style={{ ["--glass-accent" as string]: "var(--violet)" }}>
      <header>
        <h2>Choose your twin</h2>
        <div className="ct-seg" role="group" aria-label="Look">
          {(["woman", "man"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={prefs.look === l} className={prefs.look === l ? "on" : ""} onClick={() => setPrefs({ look: l })}>
              {l}
            </button>
          ))}
        </div>
      </header>
      {swatches("Skin", SKINS, "skin")}
      {swatches("Hair", HAIRS, "hair")}
      {swatches("Outfit", OUTFITS, "outfit")}
      <div className="ct-actions">
        <button type="button" className="btn-ghost btn-small" onClick={() => play("dance")}>
          Dance
        </button>
        <button type="button" className="btn-ghost btn-small" onClick={() => play("wave")}>
          Wave
        </button>
        <button type="button" className="btn-ghost btn-small" onClick={() => play("nod")}>
          Yes
        </button>
        <button type="button" className="btn-ghost btn-small" onClick={() => play("shake")}>
          No
        </button>
      </div>
    </section>
  );
}
