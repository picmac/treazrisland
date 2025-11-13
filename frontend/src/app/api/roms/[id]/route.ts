import { NextResponse } from 'next/server';
import { getMockRomDetails } from '@/data/mockRomFixtures';

interface RomRouteParams {
  params: { id: string };
}

export function GET(_request: Request, { params }: RomRouteParams) {
  const rom = getMockRomDetails(params.id);
  return NextResponse.json({ rom });
}
