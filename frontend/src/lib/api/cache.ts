type SwrSubscriber = () => void;

export type SwrSnapshot<T> = {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
};

export type SwrCacheEntry<T> = {
  data?: T;
  error?: Error;
  promise?: Promise<T> | null;
  subscribers: Set<SwrSubscriber>;
};

export function ensureCacheEntry<T>(
  map: Map<string, SwrCacheEntry<T>>,
  key: string
): SwrCacheEntry<T> {
  let entry = map.get(key);
  if (!entry) {
    entry = { subscribers: new Set() };
    map.set(key, entry);
  }
  return entry;
}

export function toSnapshot<T>(entry: SwrCacheEntry<T>): SwrSnapshot<T> {
  const data = (entry.data ?? null) as T | null;
  const error = (entry.error ?? null) as Error | null;
  const isValidating = Boolean(entry.promise);
  const isLoading = data === null && error === null;
  return {
    data,
    error,
    isLoading,
    isValidating
  };
}

function notifySubscribers<T>(entry: SwrCacheEntry<T>) {
  for (const subscriber of entry.subscribers) {
    subscriber();
  }
}

export async function revalidateEntry<T>(
  entry: SwrCacheEntry<T>,
  fetcher: () => Promise<T>
): Promise<T> {
  if (entry.promise) {
    return entry.promise;
  }

  const promise = fetcher()
    .then((result) => {
      entry.data = result;
      entry.error = undefined;
      entry.promise = null;
      notifySubscribers(entry);
      return result;
    })
    .catch((error) => {
      entry.error = error instanceof Error ? error : new Error(String(error));
      entry.promise = null;
      notifySubscribers(entry);
      throw entry.error;
    });

  entry.promise = promise;
  notifySubscribers(entry);

  return promise;
}

export function mutateEntry<T>(
  entry: SwrCacheEntry<T>,
  updater: (current: T | null) => T | null | undefined
) {
  const current = (entry.data ?? null) as T | null;
  const next = updater(current);
  if (next === null || next === undefined) {
    entry.data = undefined;
  } else {
    entry.data = next;
  }
  entry.error = undefined;
  entry.promise = null;
  notifySubscribers(entry);
}
