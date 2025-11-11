"use client";

import type { ChangeEvent } from "react";
import clsx from "clsx";

export type LibraryAssetType =
  | "COVER"
  | "LOGO"
  | "SCREENSHOT"
  | "VIDEO"
  | "MANUAL"
  | "WHEEL"
  | "MARQUEE"
  | "MAP"
  | "OTHER";

export type LibraryFilterState = {
  search: string;
  publisher: string;
  year: string;
  sort: "title" | "releaseYear" | "publisher" | "createdAt";
  direction: "asc" | "desc";
  assetTypes: LibraryAssetType[];
};

type LibraryFilterControlsProps = {
  value: LibraryFilterState;
  onChange: (value: Partial<LibraryFilterState>) => void;
  onReset?: () => void;
  showPublisher?: boolean;
  showYear?: boolean;
  className?: string;
};

const sortOptions: Array<{ label: string; value: LibraryFilterState["sort"] }> = [
  { label: "Title", value: "title" },
  { label: "Release year", value: "releaseYear" },
  { label: "Publisher", value: "publisher" },
  { label: "Recently added", value: "createdAt" }
];

export function LibraryFilterControls({
  value,
  onChange,
  onReset,
  showPublisher = true,
  showYear = true,
  className
}: LibraryFilterControlsProps) {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value: next } = event.target;
    onChange({ [name]: next } as Partial<LibraryFilterState>);
  };

  return (
    <div
      className={clsx(
        "flex flex-col gap-4 rounded-pixel border border-ink/40 bg-night/70 p-4 text-sm text-parchment",
        className
      )}
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-parchment/70">Search</span>
          <input
            name="search"
            value={value.search}
            onChange={handleInputChange}
            placeholder="Search ROMs or summaries"
            className="rounded border border-ink/40 bg-ink/40 px-3 py-2 text-parchment placeholder:text-parchment/40 focus:border-lagoon focus:outline-none"
          />
        </label>

        {showPublisher && (
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-parchment/70">Publisher</span>
            <input
              name="publisher"
              value={value.publisher}
              onChange={handleInputChange}
              placeholder="Nintendo, Capcom, Square…"
              className="rounded border border-ink/40 bg-ink/40 px-3 py-2 text-parchment placeholder:text-parchment/40 focus:border-lagoon focus:outline-none"
            />
          </label>
        )}

        {showYear && (
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-parchment/70">Release year</span>
            <input
              name="year"
              value={value.year}
              onChange={handleInputChange}
              placeholder="1994"
              inputMode="numeric"
              className="rounded border border-ink/40 bg-ink/40 px-3 py-2 text-parchment placeholder:text-parchment/40 focus:border-lagoon focus:outline-none"
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-parchment/70">Sort</span>
          <select
            name="sort"
            value={value.sort}
            onChange={(event) =>
              onChange({ sort: event.target.value as LibraryFilterState["sort"] })
            }
            className="rounded border border-ink/40 bg-ink/40 px-3 py-2 text-parchment focus:border-lagoon focus:outline-none"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-parchment/70">Direction</span>
          <select
            name="direction"
            value={value.direction}
            onChange={(event) =>
              onChange({ direction: event.target.value as LibraryFilterState["direction"] })
            }
            className="rounded border border-ink/40 bg-ink/40 px-3 py-2 text-parchment focus:border-lagoon focus:outline-none"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>

      {onReset && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="rounded border border-ink/50 px-4 py-2 text-xs uppercase tracking-widest text-parchment/80 transition hover:bg-ink/40"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
