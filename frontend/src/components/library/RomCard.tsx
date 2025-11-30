import Link from 'next/link';
import { useMemo } from 'react';

import type { RomSummary } from '@/types/rom';
import styles from './RomCard.module.css';

interface RomCardProps {
  rom: RomSummary;
  onToggleFavorite?: (romId: string) => void;
  favoritePending?: boolean;
}

const isRecent = (lastPlayedAt?: string) => {
  if (!lastPlayedAt) return false;
  const playedTime = new Date(lastPlayedAt).getTime();
  const daysAgo = (Date.now() - playedTime) / (1000 * 60 * 60 * 24);
  return daysAgo <= 14;
};

const describeLastPlayed = (lastPlayedAt?: string) => {
  if (!lastPlayedAt) return 'Unplayed';
  const playedDate = new Date(lastPlayedAt);
  const diffMs = Date.now() - playedDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Played today';
  if (diffDays === 1) return 'Played yesterday';
  return `Played ${diffDays}d ago`;
};

export function RomCard({ rom, onToggleFavorite, favoritePending }: RomCardProps) {
  const platformLabel = rom.platformId.toUpperCase();
  const releaseLabel = rom.releaseYear ? rom.releaseYear.toString() : 'TBD';
  const previewDescription = rom.description
    ? rom.description.length > 140
      ? `${rom.description.slice(0, 137)}…`
      : rom.description
    : undefined;

  const lastPlayedLabel = useMemo(() => describeLastPlayed(rom.lastPlayedAt), [rom.lastPlayedAt]);
  const recent = useMemo(() => isRecent(rom.lastPlayedAt), [rom.lastPlayedAt]);

  return (
    <article className={styles.card} data-testid="rom-card">
      <div className={styles.headingRow}>
        <h3>{rom.title}</h3>
        {recent && <span className={styles.recentBadge}>Recent</span>}
      </div>
      <div className={styles.meta}>
        <span className={styles.badge}>{platformLabel}</span>
        <span className={styles.badge}>{releaseLabel}</span>
        <span className={styles.badge} aria-live="polite">
          {lastPlayedLabel}
        </span>
      </div>
      {previewDescription && <p className={styles.description}>{previewDescription}</p>}
      {rom.genres.length > 0 && (
        <div className={styles.genres} aria-label="Genres">
          {rom.genres.map((genre) => (
            <span key={genre}>{genre}</span>
          ))}
        </div>
      )}
      <div className={styles.actions}>
        <Link href={`/play/${rom.id}`} className={styles.play}>
          Play now
        </Link>
        <Link href={`/rom/${rom.id}`} className={styles.details}>
          Details
        </Link>
        <button
          type="button"
          className={styles.favorite}
          onClick={() => onToggleFavorite?.(rom.id)}
          aria-pressed={rom.isFavorite ? 'true' : 'false'}
          aria-label={rom.isFavorite ? 'Remove from favorites' : 'Save to favorites'}
          disabled={favoritePending}
          data-testid="favorite-toggle"
        >
          {favoritePending ? '…' : rom.isFavorite ? '★ Favorited' : '☆ Favorite'}
        </button>
      </div>
    </article>
  );
}
