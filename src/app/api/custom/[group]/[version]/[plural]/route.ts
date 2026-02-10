import { NextResponse } from 'next/server';
import { getCustomResourceInstances } from '@/lib/k8s';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ group: string; version: string; plural: string }> }
) {
    try {
        const { group, version, plural } = await params;
        const data = await getCustomResourceInstances(group, version, plural);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error fetching custom resources:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
