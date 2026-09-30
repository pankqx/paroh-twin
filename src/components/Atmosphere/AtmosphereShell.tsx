"use client";

import { usePathname } from "next/navigation";
import Atmosphere from "./Atmosphere";
import { variantForPath } from "./config";

/** Mounted once in the root layout; picks the variant from the route. */
export default function AtmosphereShell() {
  return <Atmosphere variant={variantForPath(usePathname())} />;
}
