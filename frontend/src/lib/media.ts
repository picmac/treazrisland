export function resolveAssetUrl(
  storageKey: string | null | undefined,
  signedUrl?: string | null
): string | null {
  const mediaBase = process.env.NEXT_PUBLIC_MEDIA_CDN?.replace(/\/+$/, "") ?? null;

  if (signedUrl && signedUrl.length > 0) {
    return signedUrl;
  }
  if (!storageKey || storageKey.length === 0) {
    return null;
  }
  if (!mediaBase) {
    return null;
  }
  const normalizedKey = storageKey.replace(/^\/+/, "");
  return `${mediaBase}/${normalizedKey}`;
}
