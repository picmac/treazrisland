"use client";

import { PixelButton } from "@/src/components/pixel";

type FavoriteToggleProps = {
  romId: string;
  favorite: boolean;
  pending?: boolean;
  onToggle: (romId: string) => void;
};

export function FavoriteToggle({ romId, favorite, pending = false, onToggle }: FavoriteToggleProps) {
  const label = pending ? "Saving…" : favorite ? "Favorited" : "Favorite";

  return (
    <PixelButton
      variant={favorite ? "secondary" : "primary"}
      disabled={pending}
      onClick={() => onToggle(romId)}
    >
      {label}
    </PixelButton>
  );
}

export default FavoriteToggle;
