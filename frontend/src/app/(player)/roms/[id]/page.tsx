'use client';

import Image from 'next/image';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { SkeletonBlock } from '@/components/loading/SkeletonBlock';
import { fetchRomDetails, resolveRomId } from '@/lib/roms';
import { ApiError, toggleRomFavorite } from '@/lib/apiClient';
import { getStoredAccessToken } from '@/lib/authTokens';
import type { RomAsset, RomDetails } from '@/types/rom';
import styles from './page.module.css';

type PlayerRomPageProps = { params: { id: string } | Promise<{ id: string }> };

type PageStatus = 'idle' | 'loading' | 'error';

export default function PlayerRomPage({ params }: PlayerRomPageProps) {
  const resolvedParams =
    params && typeof (params as Promise<{ id: string }>).then === 'function'
      ? use(params as Promise<{ id: string }>)
      : (params as { id: string });
  const romId = resolveRomId(resolvedParams?.id);
  const [rom, setRom] = useState<RomDetails | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [error, setError] = useState<string>();
  const [favoriteMessage, setFavoriteMessage] = useState<string>();

  const favoriteMutation = useMutation({
    mutationFn: () => toggleRomFavorite(romId),
    onSuccess: (response) => {
      setFavoriteMessage(response.isFavorite ? 'Added to favorites.' : 'Removed from favorites.');
      setRom((previous) =>
        previous ? { ...previous, isFavorite: response.isFavorite } : previous,
      );
    },
    onError: (mutationError) => {
      if (mutationError instanceof ApiError && mutationError.status === 401) {
        setFavoriteMessage('Sign in to manage your favorites.');
      } else if (mutationError instanceof Error) {
        setFavoriteMessage(mutationError.message);
      } else {
        setFavoriteMessage('Unable to update favorites right now.');
      }
    },
  });

  useEffect(() => {
    let cancelled = false;

    const loadRom = async () => {
      if (!romId) {
        setRom(null);
        setStatus('error');
        setError('This cartridge slot is empty.');
        return;
      }

      setStatus('loading');
      setError(undefined);

      try {
        const details = await fetchRomDetails(romId);

        if (cancelled) {
          return;
        }

        if (!details) {
          setRom(null);
          setStatus('error');
          setError('We could not find that cartridge in the vault.');
          return;
        }

        setRom(details);
        setStatus('idle');
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setStatus('error');
        const message =
          loadError instanceof Error
            ? loadError.message
            : 'The signal dropped while loading this ROM.';
        setError(message);
      }
    };

    void loadRom();

    return () => {
      cancelled = true;
    };
  }, [romId]);

  const heroAsset = useMemo(() => selectHeroAsset(rom?.assets ?? []), [rom?.assets]);
  const platformLabel = rom?.platform?.name ?? rom?.platformId ?? 'Unknown platform';
  const releaseLabel = rom?.releaseYear ?? 'Unreleased';
  const saveStateCopy = useMemo(() => formatSaveStateCopy(rom?.saveStateSummary), [rom]);
  const handleToggleFavorite = () => {
    if (!getStoredAccessToken()) {
      setFavoriteMessage('Sign in to manage your favorites.');
      return;
    }

    favoriteMutation.mutate();
  };

  if (status === 'loading') {
    return <LoadingView />;
  }

  if (status === 'error' || !rom) {
    return (
      <main className={styles.page} id="main-content">
        <Link href="/library" className={styles.backLink}>
          ← Back to library
        </Link>
        <ErrorPanel message={error ?? 'This cartridge is still buffering in the ether.'} />
      </main>
    );
  }

  return (
    <main className={styles.page} id="main-content">
      <Link href="/library" className={styles.backLink}>
        ← Back to library
      </Link>

      <article className={styles.layout} aria-label={`${rom.title} briefing`}>
        <section className={styles.hero}>
          <div className={styles.heroArt} aria-hidden={!heroAsset}>
            {heroAsset ? (
              <Image
                src={heroAsset.url}
                alt={`${rom.title} hero art`}
                width={840}
                height={480}
                className={styles.heroImage}
                sizes="(min-width: 1024px) 640px, 100vw"
                priority
              />
            ) : (
              <div className={styles.heroPlaceholder}>
                <p>No artwork? No problem. Boot and blaze ahead.</p>
              </div>
            )}
          </div>

          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>ROM dossier</p>
            <p className={styles.heroLabel}>Pixel command briefing</p>
            <h1 className={styles.title}>{rom.title}</h1>
            <p className={styles.subtitle}>
              {platformLabel} · {releaseLabel}
            </p>
            {rom.description && <p className={styles.description}>{rom.description}</p>}

            {rom.genres.length > 0 && (
              <ul className={styles.genreList} aria-label="Genres">
                {rom.genres.map((genre) => (
                  <li key={genre}>{genre}</li>
                ))}
              </ul>
            )}

            <div className={styles.actions}>
              <Link className={styles.primaryCta} href={`/play/${rom.id}`}>
                Play Now
              </Link>
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
          </div>
        </section>

        <section className={styles.grid} aria-label="ROM metadata">
          <div className={styles.panel}>
            <h2>Cartridge stats</h2>
            <dl className={styles.metaList}>
              <div>
                <dt>Platform</dt>
                <dd>{platformLabel}</dd>
              </div>
              <div>
                <dt>Release year</dt>
                <dd>{releaseLabel}</dd>
              </div>
              <div>
                <dt>Assets loaded</dt>
                <dd>{rom.assets.length} file(s)</dd>
              </div>
              <div>
                <dt>Favorite state</dt>
                <dd>{rom.isFavorite ? 'Starred in your dock' : 'Not favorited yet'}</dd>
              </div>
            </dl>
          </div>

          <div className={styles.panel}>
            <h2>Save crystals</h2>
            <p className={styles.panelCopy}>{saveStateCopy}</p>
            {rom.saveStateSummary?.latest && (
              <dl className={styles.metaList}>
                <div>
                  <dt>Latest slot</dt>
                  <dd>Slot {rom.saveStateSummary.latest.slot}</dd>
                </div>
                <div>
                  <dt>Label</dt>
                  <dd>{rom.saveStateSummary.latest.label ?? 'Untitled shard'}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDate(rom.saveStateSummary.latest.updatedAt)}</dd>
                </div>
              </dl>
            )}
          </div>
        </section>
      </article>
    </main>
  );
}

function LoadingView() {
  return (
    <main className={styles.page} id="main-content" data-testid="rom-loading-skeleton">
      <div className={styles.loadingHero}>
        <SkeletonBlock width="100%" height={320} />
        <div className={styles.loadingText}>
          <SkeletonBlock width="40%" height={22} />
          <SkeletonBlock width="70%" height={18} />
          <SkeletonBlock width="60%" height={16} />
        </div>
      </div>
      <div className={styles.loadingPanels}>
        <SkeletonBlock width="100%" height={140} />
        <SkeletonBlock width="100%" height={140} />
      </div>
      <p className={styles.loadingCopy} role="status">
        Spinning up a 16-bit dream…
      </p>
    </main>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className={styles.errorPanel} role="alert">
      <p className={styles.errorTitle}>Glitch detected</p>
      <p>{message}</p>
    </div>
  );
}

function selectHeroAsset(assets: RomAsset[]): RomAsset | undefined {
  const imageAssets = assets.filter((asset) => /^image\//i.test(asset.contentType));
  return (
    imageAssets.find((asset) => asset.type === 'COVER') ||
    imageAssets.find((asset) => asset.type === 'ARTWORK') ||
    imageAssets[0]
  );
}

function formatSaveStateCopy(summary: RomDetails['saveStateSummary'] | undefined): string {
  if (summary === null) {
    return 'Sign in to sync your save crystals.';
  }

  if (!summary) {
    return 'Save slots unlock once you start playing.';
  }

  if (summary.total === 0) {
    return 'No save crystals forged yet—slot zero awaits.';
  }

  const latest = summary.latest;
  const slotLabel = latest ? `slot ${latest.slot}` : 'a fresh slot';
  const timeLabel = latest ? ` · ${formatDate(latest.updatedAt)}` : '';

  return `${summary.total} save crystal${summary.total === 1 ? '' : 's'} ready (${slotLabel}${timeLabel}).`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
