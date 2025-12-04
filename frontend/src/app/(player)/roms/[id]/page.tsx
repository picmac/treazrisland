'use client';

import Image from 'next/image';
import { use, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { SkeletonBlock } from '@/components/loading/SkeletonBlock';
import { fetchRomDetails, resolveRomId } from '@/lib/roms';
import { ApiError, toggleRomFavorite } from '@/lib/apiClient';
import { getStoredAccessToken } from '@/lib/authTokens';
import type { RomAsset, RomDetails } from '@/types/rom';
import { PixellabNavigation } from '@/components/chrome';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { SignOutButton } from '@/components/ui/SignOutButton';
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
  const handleToggleFavorite = async () => {
    const accessToken = await getStoredAccessToken();

    if (!accessToken) {
      setFavoriteMessage('Sign in to manage your favorites.');
      return;
    }

    favoriteMutation.mutate();
  };

  const content =
    status === 'loading' ? (
      <LoadingView />
    ) : status === 'error' || !rom ? (
      <div className={styles.page}>
        <Button href="/library" variant="ghost">
          ← Back to library
        </Button>
        <ErrorPanel message={error ?? 'This cartridge is still buffering in the ether.'} />
      </div>
    ) : (
      <article className={styles.layout} aria-label={`${rom.title} briefing`}>
        <div className={styles.headerRow}>
          <div>
            <p className="eyebrow">ROM dossier</p>
            <h1>{rom.title}</h1>
            <p>
              {platformLabel} · {releaseLabel}
            </p>
          </div>
          <div className={styles.pillRow}>
            <StatusPill tone="info">Assets: {rom.assets.length}</StatusPill>
            <StatusPill tone={rom.isFavorite ? 'success' : 'warning'}>
              {rom.isFavorite ? 'Favorite' : 'Not favorited'}
            </StatusPill>
            <StatusPill tone={rom.saveStateSummary ? 'success' : 'info'}>
              {saveStateCopy}
            </StatusPill>
          </div>
        </div>

        <Card as="section" className={styles.hero} glow>
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
            <p className="eyebrow">Pixel command briefing</p>
            {rom.description && <p>{rom.description}</p>}

            {rom.genres.length > 0 && (
              <ul className={styles.genreList} aria-label="Genres">
                {rom.genres.map((genre) => (
                  <li key={genre}>{genre}</li>
                ))}
              </ul>
            )}

            <div className={styles.actions}>
              <Button href={`/play/${rom.id}`} size="lg">
                Play Now
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleToggleFavorite}
                aria-pressed={rom.isFavorite ? 'true' : 'false'}
                loading={favoriteMutation.isPending}
              >
                {rom.isFavorite ? '★ Favorited' : '☆ Add to favorites'}
              </Button>
              <Button href="/library" variant="ghost">
                Library
              </Button>
            </div>
            {favoriteMessage && (
              <p className={styles.favoriteMessage} role="status" aria-live="polite">
                {favoriteMessage}
              </p>
            )}
          </div>
        </Card>

        <section className={styles.grid} aria-label="ROM metadata">
          <Card title="Cartridge stats">
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
          </Card>

          <Card title="Save crystals" description={saveStateCopy}>
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
          </Card>
        </section>
      </article>
    );

  return (
    <div className="page-shell">
      <PixellabNavigation
        links={[
          { href: '/library', label: 'Library' },
          { href: '/onboarding', label: 'Onboarding' },
          { href: '/admin/roms/upload', label: 'Upload' },
        ]}
        eyebrow="Library record"
        description="Metadata, save-state summary, and play entrypoint for the selected ROM."
        actions={<SignOutButton />}
      />
      <main className="page-content" id="main-content">
        <div className={styles.page}>{content}</div>
      </main>
    </div>
  );
}

function LoadingView() {
  return (
    <Card
      title="Loading ROM"
      description="Spinning up a 16-bit dream…"
      data-testid="rom-loading-skeleton"
    >
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
    </Card>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Card title="Glitch detected" description={message} tone="danger" role="alert">
      <p>{message}</p>
    </Card>
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
