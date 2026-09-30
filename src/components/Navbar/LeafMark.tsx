export default function LeafMark({ size = "1.2rem" }: { size?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#paroh-mark)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="paroh-mark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--violet)" />
          <stop offset="1" stopColor="var(--teal)" />
        </linearGradient>
      </defs>
      <path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z" />
      <path d="M5 19L14 10" />
    </svg>
  );
}
