import { NextResponse } from 'next/server';
import { getRawMetrics } from '@/lib/k8s';

export async function GET() {
  try {
    const metrics = await getRawMetrics();
    return new NextResponse(metrics as string, {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
