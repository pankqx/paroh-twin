import type { ReactNode } from "react";
import EmptyOrbit from "@/components/EmptyOrbit/EmptyOrbit";

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  empty?: string;
  emptyDoodle?: string;
}

/** Ledger rows: no boxes, a hairline above the list and under each row. */
export default function LedgerList<T>({
  items,
  keyOf,
  render,
  empty = "Nothing here yet.",
  emptyDoodle,
}: Props<T>) {
  if (items.length === 0) return <EmptyOrbit title={empty} doodle={emptyDoodle} />;
  return (
    <ul className="ledger">
      {items.map((item) => (
        <li key={keyOf(item)}>{render(item)}</li>
      ))}
    </ul>
  );
}
