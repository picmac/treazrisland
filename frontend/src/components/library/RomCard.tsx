import Link from 'next/link';
import type { RomSummary } from '@/types/rom';
import styles from './RomCard.module.css';

interface RomCardProps {
  rom: RomSummary;
}

export function RomCard({ rom }: RomCardProps) {
  const platformLabel = rom.platformId.toUpperCase();
  const releaseLabel = rom.releaseYear ? rom.releaseYear.toString() : 'TBD';
  const previewDescription = rom.description
    ? rom.description.length > 140
      ? `${rom.description.slice(0, 137)}…`
      : rom.description
    : undefined;

  return (
    <article className={styles.card} data-testid="rom-card">
      <h3>{rom.title}</h3>
      <div className={styles.meta}>
        <span className={styles.badge}>{platformLabel}</span>
        <span className={styles.badge}>{releaseLabel}</span>
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
      </div>
    </article>
  );
}
