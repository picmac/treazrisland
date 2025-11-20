import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RomHero } from '@/components/rom/RomHero';
import { RomMetadataPanel } from '@/components/rom/RomMetadataPanel';
import { fetchRomDetails } from '@/lib/roms';
import { createServerRequestInit } from '@/lib/serverRequestInit';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface RomPageParams {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: RomPageParams): Promise<Metadata> {
  try {
    const rom = await fetchRomDetails(params.id, await createServerRequestInit());
    if (!rom) {
      return {
        title: 'ROM not found | Treazr Island',
      };
    }

    return {
      title: `${rom.title} | Treazr Island`,
      description: rom.description ?? `Treazr Island dossier for ${rom.title}.`,
    };
  } catch (error) {
    return {
      title: 'ROM overview | Treazr Island',
      description: error instanceof Error ? error.message : 'Unable to load ROM metadata.',
    };
  }
}

export default async function RomPage({ params }: RomPageParams) {
  const rom = await fetchRomDetails(params.id, await createServerRequestInit());

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
