"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

type LinkHref = Parameters<typeof Link>[0]["href"];

export type CuratedListCardProps = {
  href: LinkHref;
  title: string;
  description?: string | null;
  meta?: ReactNode;
  highlight?: {
    label: string;
    value: string;
  } | null;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function CuratedListCard({
  href,
  title,
  description,
  meta,
  highlight,
  footer,
  className,
  children
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
      {children ? (
        <div className="mt-4 space-y-2 text-sm leading-relaxed text-parchment/70">{children}</div>
      ) : null}
      {footer ? (
        <div className={clsx("text-xs text-parchment/60", children ? "mt-3" : "mt-4")}>{footer}</div>
      ) : null}
    </Link>
  );
}
