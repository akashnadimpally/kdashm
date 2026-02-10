import { NextResponse } from 'next/server';
import { getMetrics } from '@/lib/k8s';

export async function GET() {
    try {
        const data = await getMetrics();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
