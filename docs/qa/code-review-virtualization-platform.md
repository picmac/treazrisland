# Concrete follow-ups for library & platform experience

This document details actionable implementation steps for the issues highlighted in the latest library/platform review. Each section lists the recommended change, the affected modules, and suggested validation.

## 1. Preserve virtualized grid scroll position during pagination
- **Where:** `frontend/src/components/library/VirtualizedGrid.tsx` and `frontend/src/hooks/useVirtualizedGrid.ts`.
- **What to change:**
  - Track a stable `contentKey` derived from the active filter/sort state instead of the items array reference.
  - Gate the `scrollRef.current.scrollTop = 0` reset behind a comparison between the previous and next keys.
  - When appending pages, keep the key constant so pagination no longer forces a jump to the top.
- **Implementation sketch:**
  ```tsx
  const resetKey = useMemo(() => [activePlatformSlug, searchQuery, sortOrder].join("|"), [/* deps */]);
  const prevResetKey = usePrevious(resetKey);

  useEffect(() => {
    if (resetKey !== prevResetKey) {
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [resetKey, prevResetKey]);
  ```
- **Regression test:** Extend `frontend/src/components/library/__tests__/VirtualizedGrid.test.tsx` (create if missing) to append a second page and assert `scrollTo` is *not* called when the key stays the same.

## 2. Provide a backend slug lookup for platform detail pages
- **Where:**
  - Fastify route: `backend/src/routes/platforms/index.ts` (add `GET /platforms/:slug`).
  - Client fetch: `frontend/src/app/platforms/[slug]/page.tsx`.
- **What to change:**
  - Add a Prisma query `prisma.platform.findUnique({ where: { slug } })` guarded by the existing `requireAuth` policy.
  - Reuse the existing response transformer to keep payload parity with the list route.
  - Update the Next.js loader to call the new endpoint instead of fetching the entire catalog and filtering client-side.
- **Validation:**
  - Unit test the route handler with Vitest to cover 200 and 404 cases.
  - Update the page integration test to assert the fetch is a single request to `/platforms/{slug}`.

## 3. Trim ROM listing payloads
- **Where:** `backend/src/services/library/listRoms.ts` and `frontend/src/lib/api/library.ts`.
- **What to change:**
  - Limit `metadataHistory` to `take: 1` (the latest entry) and request only the fields rendered in the grid (title, region, revision, size).
  - Restrict `assets` to the primary box art and screenshot (`take: 2`, filtered by type) to keep thumbnails intact while cutting unused blobs.
  - Expose optional query params (`includeHistory`, `assetTypes`) for the admin panel so deep-inspection flows can opt back into the larger payload when needed.
- **Validation:**
  - Add a regression test that asserts the serialized JSON omits extra metadata records by default.
  - Observe the size reduction locally via the `X-Response-Bytes` metric exported by the observability plugin.

## 4. Align platform search with UI expectations
- **Where:** `backend/src/services/platforms/searchPlatforms.ts`.
- **What to change:**
  - Extend the Prisma `OR` clause to include `{ slug: { contains: query, mode: 'insensitive' } }`.
  - Keep the existing search ranking order; only the matching predicate changes.
- **Validation:**
  - Update the service unit tests to cover slug-only matches.
  - Smoke-test from the frontend search box to ensure slug queries now resolve.

## 5. Harden virtualization tests
- **Where:** `frontend/src/components/library/__tests__/VirtualizedGrid.test.tsx`.
- **What to change:**
  - Create a regression test suite that mounts the grid, triggers pagination, and verifies scroll preservation (ties into item 1).
  - Use React Testing Library with fake timers to simulate the virtualization window updates.
- **Validation:** Execute `npm test -- --runInBand` in the frontend package to ensure deterministic snapshots.
