import type { ReactNode } from "react";

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  empty?: string;
}

/** Ledger rows: no boxes, a hairline above the list and under each row. */
export default function LedgerList<T>({
  items,
  keyOf,
  render,
  empty = "Nothing here yet.",
}: Props<T>) {
  if (items.length === 0) return <p className="empty-state">{empty}</p>;
  return (
    <ul className="ledger">
      {items.map((item) => (
        <li key={keyOf(item)}>{render(item)}</li>
      ))}
    </ul>
  );
}
