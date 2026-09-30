// Hands "a domain just grew" from /approvals to the Living Core on /, via
// localStorage so it also survives a full page load. Read once, then cleared.
const KEY = "paroh-bloom-grew";

/** domain key -> confidence before the change */
export type Growth = Record<string, number>;

export function recordGrowth(
  before: Record<string, number>,
  after: Record<string, number>,
) {
  try {
    const pending: Growth = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    for (const [domain, was] of Object.entries(before)) {
      if ((after[domain] ?? 0) > was && !(domain in pending)) pending[domain] = was;
    }
    window.localStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    /* storage unavailable: the animation is a nicety */
  }
}

export function takeGrowth(): Growth {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    window.localStorage.removeItem(KEY);
    return JSON.parse(raw) as Growth;
  } catch {
    return {};
  }
}
