import { NextResponse } from 'next/server';
import { toggleMockFavorite } from '@/data/mockRomFixtures';

interface FavoriteRouteParams {
  params: { id: string };
}

export function POST(_request: Request, { params }: FavoriteRouteParams) {
  const payload = toggleMockFavorite(params.id);
  return NextResponse.json(payload);
}
