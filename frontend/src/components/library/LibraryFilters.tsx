'use client';

import { useId } from 'react';
import styles from './LibraryFilters.module.css';

interface LibraryFiltersProps {
  platformOptions: string[];
  genreOptions: string[];
  selectedPlatform?: string;
  selectedGenre?: string;
  favoritesOnly: boolean;
  sortOrder: 'newest' | 'recent';
  onPlatformChange: (platform?: string) => void;
  onGenreChange: (genre?: string) => void;
  onFavoritesToggle: (nextValue: boolean) => void;
  onSortChange: (order: 'newest' | 'recent') => void;
}

export function LibraryFilters({
  platformOptions,
  genreOptions,
  selectedPlatform,
  selectedGenre,
  favoritesOnly,
  sortOrder,
  onPlatformChange,
  onGenreChange,
  onFavoritesToggle,
  onSortChange,
}: LibraryFiltersProps) {
  const platformId = useId();
  const genreId = useId();
  const orderId = useId();

  return (
    <section
      className={styles.filterBar}
      aria-label="Library filters"
      data-testid="library-filter-bar"
    >
      <label className={styles.filterGroup} htmlFor={platformId}>
        <span className={styles.label}>Platform</span>
        <select
          id={platformId}
          className={styles.select}
          value={selectedPlatform ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            onPlatformChange(value.length ? value : undefined);
          }}
        >
          <option value="">All platforms</option>
          {platformOptions.map((platform) => (
            <option key={platform} value={platform}>
              {platform.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.filterGroup} aria-labelledby={genreId}>
        <span id={genreId} className={styles.label}>
          Genres
        </span>
        <div className={styles.genreList}>
          <button
            type="button"
            className={styles.genreButton}
            data-active={selectedGenre ? 'false' : 'true'}
            aria-pressed={!selectedGenre}
            onClick={() => onGenreChange(undefined)}
          >
            All genres
          </button>
          {genreOptions.map((genre) => (
            <button
              key={genre}
              type="button"
              className={styles.genreButton}
              data-active={selectedGenre === genre ? 'true' : 'false'}
              aria-pressed={selectedGenre === genre}
              onClick={() => onGenreChange(genre)}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      <fieldset className={styles.filterGroup} aria-labelledby={orderId}>
        <legend id={orderId} className={styles.label}>
          Order
        </legend>
        <div className={styles.orderGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="library-order"
              value="recent"
              checked={sortOrder === 'recent'}
              onChange={() => onSortChange('recent')}
            />
            Recent activity
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="library-order"
              value="newest"
              checked={sortOrder === 'newest'}
              onChange={() => onSortChange('newest')}
            />
            Newest uploads
          </label>
        </div>
      </fieldset>

      <button
        type="button"
        className={styles.toggleButton}
        aria-pressed={favoritesOnly}
        data-active={favoritesOnly ? 'true' : 'false'}
        onClick={() => onFavoritesToggle(!favoritesOnly)}
      >
        {favoritesOnly ? 'Showing favorites' : 'Favorites only'}
      </button>
    </section>
  );
}
