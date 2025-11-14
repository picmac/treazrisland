import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { RomHero } from '@/components/rom/RomHero';
import { RomMetadataPanel } from '@/components/rom/RomMetadataPanel';
import { fetchRomDetails } from '@/lib/roms';

interface RomPageParams {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: RomPageParams): Promise<Metadata> {
  try {
    const rom = await fetchRomDetails(params.id, createServerRequestInit());
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
  const rom = await fetchRomDetails(params.id, createServerRequestInit());

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

function createServerRequestInit(): RequestInit | undefined {
  const headerList = headers();
  const cookieStore = cookies();
  const forwardedHeaders = new Headers();
  let hasForwardedHeaders = false;

  const cookieHeader = cookieStore.toString();
  if (cookieHeader.length > 0) {
    forwardedHeaders.set('cookie', cookieHeader);
    hasForwardedHeaders = true;
  }

  const authHeader = headerList.get('authorization');
  if (authHeader) {
    forwardedHeaders.set('authorization', authHeader);
    hasForwardedHeaders = true;
  }

  const forwardedHost = headerList.get('x-forwarded-host');
  if (forwardedHost) {
    forwardedHeaders.set('x-forwarded-host', forwardedHost);
    hasForwardedHeaders = true;
  }

  const forwardedProto = headerList.get('x-forwarded-proto');
  if (forwardedProto) {
    forwardedHeaders.set('x-forwarded-proto', forwardedProto);
    hasForwardedHeaders = true;
  }

  return hasForwardedHeaders ? { headers: forwardedHeaders } : undefined;
}
