"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

export type CuratedListCardProps = {
  href: string;
  title: string;
  description?: string | null;
  meta?: ReactNode;
  highlight?: {
    label: string;
    value: string;
  } | null;
  footer?: ReactNode;
  className?: string;
};

export function CuratedListCard({
  href,
  title,
  description,
  meta,
  highlight,
  footer,
  className
}: CuratedListCardProps) {
  return (
    <Link
      href={href}
      className={clsx(
        "group block rounded-pixel border border-ink/40 bg-night/70 p-5 shadow-pixel transition hover:border-lagoon hover:bg-night/80",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-parchment/50">
        <span>{meta}</span>
        {highlight ? (
          <span className="rounded-pixel bg-lagoon/20 px-2 py-1 text-[0.7rem] font-semibold text-lagoon">
            {highlight.label}: {highlight.value}
          </span>
        ) : null}
      </div>
      <h2 className="mt-3 text-2xl font-semibold text-parchment transition group-hover:text-lagoon">{title}</h2>
      {description ? (
        <p className="mt-3 text-sm leading-relaxed text-parchment/75">{description}</p>
      ) : null}
      {footer ? <div className="mt-4 text-xs text-parchment/60">{footer}</div> : null}
    </Link>
  );
}
