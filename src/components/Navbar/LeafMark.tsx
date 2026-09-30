export default function LeafMark({ size = "1.1rem" }: { size?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--forest)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z" />
      <path d="M5 19L14 10" />
    </svg>
  );
}
