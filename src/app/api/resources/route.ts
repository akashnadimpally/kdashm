import { NextResponse } from 'next/server';
import { getResources } from '@/lib/k8s';

export async function GET() {
  try {
    const data = await getResources();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching K8s resources:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
