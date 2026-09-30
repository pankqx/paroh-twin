"use client";

// Sandbox for the avatar: /avatar-lab?form=1&state=speaking&action=dance&t=1.3&look=woman&still=1
// Not linked from anywhere. Used to look at poses and colours in isolation.

import { useEffect, useState } from "react";
import TwinAvatar, { type AvatarAction, type AvatarState } from "@/components/TwinAvatar/TwinAvatar";
import { DEFAULT_STYLE, type AvatarStyle } from "@/components/TwinAvatar/looks";

export default function AvatarLab() {
  const [q, setQ] = useState<URLSearchParams | null>(null);
  useEffect(() => setQ(new URLSearchParams(window.location.search)), []);
  if (!q) return <main />;

  const style: AvatarStyle = {
    look: (q.get("look") as AvatarStyle["look"]) ?? DEFAULT_STYLE.look,
    skin: q.get("skin") ?? DEFAULT_STYLE.skin,
    hair: q.get("hair") ?? DEFAULT_STYLE.hair,
    outfit: q.get("outfit") ?? DEFAULT_STYLE.outfit,
  };
  const t = q.get("t");
  return (
    <main
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "#07060d", display: "grid", placeItems: "center" }}
      className={q.get("still") ? "ta-still" : undefined}
    >
      <TwinAvatar
        state={(q.get("state") as AvatarState) ?? "idle"}
        form={Number(q.get("form") ?? 1)}
        action={(q.get("action") as AvatarAction) ?? undefined}
        freezeT={t === null ? undefined : Number(t)}
        style={style}
        level={Number(q.get("level") ?? 0)}
        mouth={q.get("mouth") === null ? undefined : (Number(q.get("mouth")) as 0 | 1 | 2 | 3)}
        className=""
      />
      <style>{`.ta{--face-h:${q.get("h") ?? "96vh"}}`}</style>
    </main>
  );
}
