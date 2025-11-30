'use client';

import Image from 'next/image';
import Link from 'next/link';
import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RomDetailSkeleton } from '@/components/loading/RomDetailSkeleton';
import { ApiError, toggleRomFavorite } from '@/lib/apiClient';
import { getStoredAccessToken } from '@/lib/authTokens';
import { fetchRomDetails, resolveRomId } from '@/lib/roms';
import type { RomAsset, RomDetails } from '@/types/rom';
import styles from './page.module.css';

interface LibraryRomPageProps {
  params: { romId: string } | Promise<{ romId: string }>;
}

export default function LibraryRomPage({ params }: LibraryRomPageProps) {
  const resolvedParams =
    params && typeof (params as Promise<{ romId: string }>).then === 'function'
      ? use(params as Promise<{ romId: string }>)
      : (params as { romId: string });
  const romId = resolveRomId(resolvedParams?.romId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [favoriteMessage, setFavoriteMessage] = useState<string>();

  const romQuery = useQuery<RomDetails | null, Error>({
    queryKey: ['rom-detail', romId],
    queryFn: () => fetchRomDetails(romId),
    refetchOnMount: true,
    enabled: Boolean(romId),
  });

  const favoriteMutation = useMutation({
    mutationFn: () => toggleRomFavorite(romId),
    onSuccess: (response) => {
      setFavoriteMessage(response.isFavorite ? 'Added to favorites.' : 'Removed from favorites.');
      queryClient.setQueryData<RomDetails | null>(['rom-detail', romId], (previous) => {
        if (!previous) return previous;
        return { ...previous, isFavorite: response.isFavorite };
      });
    },
    onError: (error) => {
      const message =
        error instanceof ApiError && error.status === 401
          ? 'Sign in to manage your favorites.'
          : error instanceof Error
            ? error.message
            : 'Unable to update favorites right now.';
      setFavoriteMessage(message);
    },
  });

  const rom = romQuery.data ?? undefined;
  const isLoading = romQuery.isLoading;

  const coverAsset = useMemo(() => selectCoverAsset(rom?.assets ?? []), [rom?.assets]);
  const lastPlayedLabel = useMemo(() => formatLastPlayed(rom?.lastPlayedAt), [rom?.lastPlayedAt]);

  const handleToggleFavorite = () => {
    if (!getStoredAccessToken()) {
      setFavoriteMessage('Sign in to manage your favorites.');
      return;
    }
    favoriteMutation.mutate();
  };

  const handlePlayNow = () => {
    const search = new URLSearchParams({ saveSlot: '1', inputProfile: 'standard' }).toString();
    router.push(`/play/${romId}?${search}`);
  };

  if (!romId) {
    return (
      <main className={styles.page} id="main-content">
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <p role="alert">ROM identifier missing from the request.</p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className={styles.page} id="main-content">
        <RomDetailSkeleton />
        <p className={styles.status} role="status">
          Loading ROM dossier…
        </p>
      </main>
    );
  }

  if (!rom) {
    return (
      <main className={styles.page} id="main-content">
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <p role="alert">Unable to load this ROM right now.</p>
      </main>
    );
  }

  return (
    <main className={styles.page} id="main-content">
      <Link href="/library" className={styles.backLink}>
        ← Back to library
      </Link>

      <article className={styles.layout} aria-label={`${rom.title} dossier`}>
        <div className={styles.coverWrapper} aria-hidden={!coverAsset}>
          {coverAsset ? (
            <Image
              src={coverAsset.url}
              alt={`${rom.title} cover art`}
              width={640}
              height={360}
              className={styles.coverImage}
              sizes="(min-width: 1024px) 420px, 100vw"
              priority
            />
          ) : (
            <div className={styles.coverFallback}>
              <p>Cover art coming soon.</p>
            </div>
          )}
        </div>

        <div className={styles.content}>
          <div className={styles.titleRow}>
            <p className="eyebrow">ROM dossier</p>
            <span className={styles.tag}>{rom.platformId.toUpperCase()}</span>
          </div>
          <h1>{rom.title}</h1>
          <p className={styles.meta}>
            <span>{rom.releaseYear ? rom.releaseYear : 'Unreleased'}</span>
            <span aria-hidden>•</span>
            <span>Last played: {lastPlayedLabel}</span>
          </p>
          {rom.description && <p className={styles.description}>{rom.description}</p>}

          {rom.genres.length > 0 && (
            <ul className={styles.genres} aria-label="Genres">
              {rom.genres.map((genre) => (
                <li key={genre} className={styles.genre}>
                  {genre}
                </li>
              ))}
            </ul>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.primaryCta} onClick={handlePlayNow}>
              ▶ Play now
            </button>
            <button
              type="button"
              className={styles.secondaryCta}
              onClick={handleToggleFavorite}
              aria-pressed={rom.isFavorite ? 'true' : 'false'}
              disabled={favoriteMutation.isPending}
            >
              {favoriteMutation.isPending
                ? 'Saving…'
                : rom.isFavorite
                  ? '★ Favorited'
                  : '☆ Add to favorites'}
            </button>
          </div>

          {favoriteMessage && (
            <p className={styles.favoriteMessage} role="status" aria-live="polite">
              {favoriteMessage}
            </p>
          )}

          <section aria-label="ROM metadata" className={styles.grid}>
            <dl className={styles.stat}>
              <dt>Checksum</dt>
              <dd>{rom.assets[0] ? truncateChecksum(rom.assets[0].checksum) : '—'}</dd>
            </dl>
            <dl className={styles.stat}>
              <dt>Assets</dt>
              <dd>{rom.assets.length}</dd>
            </dl>
            <dl className={styles.stat}>
              <dt>Updated</dt>
              <dd>{formatDate(rom.updatedAt)}</dd>
            </dl>
            <dl className={styles.stat}>
              <dt>Created</dt>
              <dd>{formatDate(rom.createdAt)}</dd>
            </dl>
          </section>

          <section aria-label="Assets">
            <h2>Assets</h2>
            {rom.assets.length === 0 ? (
              <p className={styles.status}>No assets registered yet.</p>
            ) : (
              <ul className={styles.assetList}>
                {rom.assets.map((asset) => (
                  <li key={asset.id} className={styles.assetItem}>
                    <div>
                      <p>{asset.type}</p>
                      <p className={styles.assetMeta}>
                        {asset.contentType} · {formatBytes(asset.size)}
                      </p>
                    </div>
                    <a href={asset.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </article>

      {romQuery.isFetching && !romQuery.isLoading && (
        <p className={styles.status} role="status">
          Refreshing dossier…
        </p>
      )}
    </main>
  );
}

function selectCoverAsset(assets: RomAsset[]): RomAsset | undefined {
  const images = assets.filter((asset) => /^image\//i.test(asset.contentType));
  return (
    images.find((asset) => asset.type === 'COVER') ||
    images.find((asset) => asset.type === 'ARTWORK') ||
    images[0]
  );
}

function formatLastPlayed(value?: string) {
  if (!value) {
    return 'Never played';
  }
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateChecksum(checksum: string) {
  return checksum.length > 12 ? `${checksum.slice(0, 12)}…` : checksum;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
