import { NextResponse } from 'next/server';
import { persistMockSaveState } from '@/data/mockRomFixtures';
import type { SaveStatePayload } from '@/lib/saveStates';

interface SaveStateRouteParams {
  params: { id: string };
}

export async function POST(request: Request, { params }: SaveStateRouteParams) {
  const body = (await request.json()) as SaveStatePayload;
  if (!body?.data || !body.contentType) {
    return NextResponse.json({ error: 'Missing save payload' }, { status: 400 });
  }

  const saveState = persistMockSaveState(params.id, body);
  return NextResponse.json({ saveState });
}
