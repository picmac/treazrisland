'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { RomAsset, RomDetails } from '@/types/rom';
import { ApiError, toggleRomFavorite } from '@/lib/apiClient';
import { getStoredAccessToken } from '@/lib/authTokens';
import { fetchRomDetails } from '@/lib/roms';

interface RomHeroProps {
  rom: RomDetails;
}

type FavoriteStatus = 'idle' | 'saving' | 'success' | 'error';

export function RomHero({ rom }: RomHeroProps) {
  const [isFavorite, setIsFavorite] = useState<boolean>(rom.isFavorite ?? false);
  const [favoriteStatus, setFavoriteStatus] = useState<FavoriteStatus>('idle');
  const [favoriteMessage, setFavoriteMessage] = useState<string>();
  const mutationVersionRef = useRef(0);

  useEffect(() => {
    setIsFavorite(rom.isFavorite ?? false);
  }, [rom.id, rom.isFavorite]);

  useEffect(() => {
    mutationVersionRef.current = 0;
  }, [rom.id]);

  useEffect(() => {
    let cancelled = false;
    const accessToken = getStoredAccessToken();

    if (!accessToken) {
      return () => {
        cancelled = true;
      };
    }

    const refreshVersion = mutationVersionRef.current;
    const refreshFavoriteState = async () => {
      try {
        const freshRom = await fetchRomDetails(rom.id);
        if (!cancelled && refreshVersion === mutationVersionRef.current && freshRom) {
          setIsFavorite(freshRom.isFavorite ?? false);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Unable to refresh favorite state for ROM', rom.id, error);
        }
      }
    };

    void refreshFavoriteState();

    return () => {
      cancelled = true;
    };
  }, [rom.id]);

  const heroAsset = selectHeroAsset(rom.assets);
  const platformLabel = rom.platformId.toUpperCase();
  const releaseLabel = rom.releaseYear ? rom.releaseYear.toString() : 'Unreleased';

  const handleToggleFavorite = async () => {
    if (!getStoredAccessToken()) {
      setFavoriteStatus('error');
      setFavoriteMessage('Sign in to manage your favorites.');
      return;
    }

    mutationVersionRef.current += 1;
    const previousValue = isFavorite;
    setFavoriteStatus('saving');
    setFavoriteMessage(undefined);

    try {
      const response = await toggleRomFavorite(rom.id);
      setIsFavorite(response.isFavorite);
      setFavoriteStatus('success');
      setFavoriteMessage(response.isFavorite ? 'Added to favorites.' : 'Removed from favorites.');
    } catch (error) {
      setIsFavorite(previousValue);
      setFavoriteStatus('error');
      setFavoriteMessage(
        error instanceof ApiError && error.status === 401
          ? 'Sign in to manage your favorites.'
          : error instanceof Error
            ? error.message
            : 'Unable to update favorites right now.',
      );
    }
  };

  const favoriteButtonLabel = isFavorite ? '★ Favorited' : '☆ Add to favorites';
  const favoriteButtonPressed = isFavorite ? 'true' : 'false';

  return (
    <article className="rom-hero">
      <div className="rom-hero__media" aria-hidden={!heroAsset}>
        {heroAsset ? (
          <Image
            src={heroAsset.url}
            alt={`${rom.title} artwork`}
            width={640}
            height={360}
            sizes="(min-width: 1024px) 480px, 100vw"
            className="rom-hero__media-image"
            priority={false}
          />
        ) : (
          <div className="rom-hero__placeholder">
            <p>Artwork coming soon</p>
          </div>
        )}
      </div>

      <div className="rom-hero__content">
        <p className="eyebrow">ROM dossier</p>
        <h1>{rom.title}</h1>
        <p className="rom-hero__meta">
          {platformLabel} · {releaseLabel}
        </p>
        {rom.description && <p className="rom-hero__description">{rom.description}</p>}

        {rom.genres.length > 0 && (
          <ul className="rom-hero__genres" aria-label="Genres">
            {rom.genres.map((genre) => (
              <li key={genre}>{genre}</li>
            ))}
          </ul>
        )}

        <div className="rom-hero__actions">
          <a className="rom-hero__cta" href={`/play/${rom.id}`}>
            Play Now
          </a>
          <button
            type="button"
            className="rom-hero__favorite"
            onClick={handleToggleFavorite}
            aria-pressed={favoriteButtonPressed}
            disabled={favoriteStatus === 'saving'}
          >
            {favoriteButtonLabel}
          </button>
        </div>

        {favoriteMessage && (
          <p
            className={`rom-hero__favorite-message rom-hero__favorite-message--${favoriteStatus}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {favoriteMessage}
          </p>
        )}
      </div>
    </article>
  );
}

function selectHeroAsset(assets: RomAsset[]): RomAsset | undefined {
  return (
    assets.find((asset) => asset.type === 'COVER') ||
    assets.find((asset) => asset.type === 'ARTWORK') ||
    assets[0]
  );
}
