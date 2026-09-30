"use client";

import { AVATAR_SPECS, type AvatarLook } from "./geometry";
import { useTwinLook } from "./useTwinLook";
import "./LookPicker.css";

const looks: AvatarLook[] = ["woman", "man", "spirit"];

/** Three compact appearance choices, with the selected look stored by useTwinLook(). */
export default function LookPicker() {
  const [look, setLook] = useTwinLook();
  return (
    <div className="twin-look-picker" role="group" aria-label="Choose twin appearance">
      {looks.map((option) => {
        const palette = AVATAR_SPECS[option].palette;
        return (
          <button key={option} type="button" className={`twin-look-option${look === option ? " selected" : ""}`} aria-pressed={look === option} onClick={() => setLook(option)} title={`Use ${option} appearance`}>
            <span className={`twin-look-preview ${option}`} style={{ ["--preview-skin" as string]: palette.skinLight, ["--preview-hair" as string]: palette.hairLight, ["--preview-rim" as string]: palette.rim }} aria-hidden="true">
              {option === "spirit" ? <svg viewBox="0 0 48 48"><circle className="preview-orbit" cx="24" cy="24" r="17"/><circle className="preview-orbit inner" cx="24" cy="24" r="12"/><circle className="preview-core" cx="24" cy="24" r="5"/></svg> : <svg viewBox="0 0 48 48"><path className="preview-hair" d={option === "woman" ? "M8 43V23C8 9 16 4 24 4s16 5 16 19v20l-7-4H15z" : "M9 26C8 12 15 5 24 5s17 7 15 21l-5-6H14z"}/><path className="preview-face" d="M13 18c0-8 5-12 11-12s11 4 11 12v10c0 8-6 14-11 14s-11-6-11-14z"/><path className="preview-features" d="M17 23h.2m13.6 0h.2M20 34q4 3 8 0"/></svg>}
            </span>
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}
