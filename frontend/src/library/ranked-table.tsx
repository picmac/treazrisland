"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

export type RankedTableRow = {
  id: string;
  order: number;
  title: ReactNode;
  subtitle?: ReactNode;
  note?: ReactNode;
};

export type RankedTableProps = {
  rows: RankedTableRow[];
  orderLabel?: string;
  emptyMessage?: ReactNode;
  className?: string;
};

export function RankedTable({
  rows,
  orderLabel = "Rank",
  emptyMessage = "Nothing to show yet.",
  className
}: RankedTableProps) {
  if (rows.length === 0) {
    return (
      <div className={clsx("rounded-pixel border border-ink/40 bg-night/70 p-6 text-sm text-parchment/70", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "overflow-hidden rounded-pixel border border-ink/40 bg-night/70 shadow-pixel",
        className
      )}
    >
      <table className="min-w-full divide-y divide-ink/30 text-left">
        <thead>
          <tr className="bg-night/60 text-xs uppercase tracking-[0.3em] text-parchment/60">
            <th scope="col" className="px-4 py-3 font-semibold">{orderLabel}</th>
            <th scope="col" className="px-4 py-3 font-semibold">Title</th>
            <th scope="col" className="px-4 py-3 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/20 text-sm text-parchment/80">
          {rows.map((row) => (
            <tr key={row.id} className="transition hover:bg-night/40">
              <td className="px-4 py-3 font-semibold text-parchment">{row.order}</td>
              <td className="px-4 py-3">
                <div className="font-semibold text-parchment">{row.title}</div>
                {row.subtitle ? (
                  <div className="mt-1 text-xs uppercase tracking-widest text-parchment/50">{row.subtitle}</div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-parchment/70">{row.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
