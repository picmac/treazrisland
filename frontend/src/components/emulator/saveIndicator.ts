export function formatSaveIndicatorLabel(saveCount: number = 0, lastSavedAt?: Date | null) {
  const normalizedCount = Math.max(0, saveCount);
  if (normalizedCount <= 0) {
    return 'No save yet';
  }

  const saveTime = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return saveTime ? `Saved ${normalizedCount} (${saveTime})` : `Saved ${normalizedCount}`;
}
