import { NextResponse } from 'next/server';

export function GET() {
  // Lightweight health endpoint for container and deploy checks.
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
