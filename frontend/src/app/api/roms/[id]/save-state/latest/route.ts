import { NextResponse } from 'next/server';
import { getMockLatestSaveState } from '@/data/mockRomFixtures';

interface SaveStateRouteParams {
  params: { id: string };
}

export function GET(_request: Request, { params }: SaveStateRouteParams) {
  const latestSaveState = getMockLatestSaveState(params.id);
  if (!latestSaveState) {
    return NextResponse.json({ error: 'No save state recorded' }, { status: 404 });
  }

  return NextResponse.json(latestSaveState);
}
