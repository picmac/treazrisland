/* eslint-disable import/no-unresolved */
import LibraryRomPage from '../(player)/library/[romId]/page';

type LegacyRomPageProps = { params: { id: string } | Promise<{ id: string }> };

export default function LegacyRomPage({ params }: LegacyRomPageProps) {
  // The library page expects `romId`; map the legacy `id` param and reuse the existing view.
  return (
    <LibraryRomPage
      params={
        typeof (params as Promise<{ id: string }>).then === 'function'
          ? (params as Promise<{ id: string }>).then((resolved) => ({ romId: resolved.id }))
          : { romId: (params as { id: string }).id }
      }
    />
  );
}
