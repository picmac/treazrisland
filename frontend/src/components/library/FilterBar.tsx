'use client';

import { ChangeEvent, useMemo } from 'react';

import {
  RomLibraryFilters,
  getRomLibraryFilterDefaults
} from '@/hooks/useRomLibrary';

import styles from './FilterBar.module.css';

interface FilterBarProps {
  filters: RomLibraryFilters;
  onChange: (next: RomLibraryFilters) => void;
  availablePlatforms?: string[];
  availableGenres?: string[];
  totalRoms?: number;
  isBusy?: boolean;
}

const ensureOptions = (values?: string[]) => (values ?? []).filter(Boolean);

export function FilterBar({
  filters,
  onChange,
  availablePlatforms,
  availableGenres,
  totalRoms,
  isBusy
}: FilterBarProps) {
  const defaults = useMemo(() => getRomLibraryFilterDefaults(), []);

  const isPristine =
    (filters.search ?? '') === (defaults.search ?? '') &&
    (filters.platform ?? 'all') === (defaults.platform ?? 'all') &&
    (filters.genre ?? 'all') === (defaults.genre ?? 'all') &&
    Boolean(filters.favoritesOnly) === Boolean(defaults.favoritesOnly);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: event.target.value });
  };

  const handleSelectChange = (field: 'platform' | 'genre') =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...filters, [field]: event.target.value });
    };

  const handleFavoritesChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, favoritesOnly: event.target.checked });
  };

  const handleReset = () => {
    onChange(getRomLibraryFilterDefaults());
  };

  const summary = (() => {
    if (isBusy) {
      return 'Loading ROMs…';
    }

    if (typeof totalRoms === 'number') {
      return `${totalRoms} ROM${totalRoms === 1 ? '' : 's'}`;
    }

    return 'ROM library';
  })();

  return (
    <section className={styles.wrapper} aria-label="Library filters">
      <div className={styles.headerRow}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search ROM titles, publishers or tags"
          value={filters.search ?? ''}
          onChange={handleSearchChange}
        />
        <div className={styles.selectGroup}>
          <select
            value={filters.platform ?? 'all'}
            onChange={handleSelectChange('platform')}
            aria-label="Filter by platform"
          >
            <option value="all">All platforms</option>
            {ensureOptions(availablePlatforms).map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
          <select
            value={filters.genre ?? 'all'}
            onChange={handleSelectChange('genre')}
            aria-label="Filter by genre"
          >
            <option value="all">All genres</option>
            {ensureOptions(availableGenres).map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.footerRow}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={Boolean(filters.favoritesOnly)}
            onChange={handleFavoritesChange}
          />
          Favorites only
        </label>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.resetButton}
            onClick={handleReset}
            disabled={isPristine}
          >
            Reset filters
          </button>
          <span className={styles.summary}>{summary}</span>
        </div>
      </div>
    </section>
  );
}

export default FilterBar;
