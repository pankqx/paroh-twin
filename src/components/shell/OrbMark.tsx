/** Brand mark: a small orb with one orbit. */
export default function OrbMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="paroh-mark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--teal)" />
          <stop offset="0.6" stopColor="var(--violet)" />
          <stop offset="1" stopColor="var(--amber)" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="4.2" fill="url(#paroh-mark)" />
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="4.4"
        transform="rotate(-24 12 12)"
        stroke="url(#paroh-mark)"
        strokeWidth="1.5"
      />
      <circle cx="20.4" cy="8.3" r="1.3" fill="var(--teal)" />
    </svg>
  );
}
