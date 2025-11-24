import { RomHero } from '@/components/rom/RomHero';
import { RomMetadataPanel } from '@/components/rom/RomMetadataPanel';
import { fetchRomDetails, resolveRomId } from '@/lib/roms';
import { createServerRequestInit } from '@/lib/serverRequestInit';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type RomPageParams = {
  params: Promise<{ id: string }>;
};

export default async function RomPage({ params }: RomPageParams) {
  const resolvedParams = await params;
  const romId = resolveRomId(resolvedParams.id);

  if (!romId) {
    notFound();
  }

  const requestInit = await createServerRequestInit();
  const rom = await fetchRomDetails(romId, requestInit);

  if (!rom) {
    notFound();
  }

  return (
    <section className="rom-layout" aria-label="ROM overview">
      <RomHero rom={rom} />
      <RomMetadataPanel rom={rom} />
    </section>
  );
}
