import { NextResponse } from 'next/server';
import { getPodLogs } from '@/lib/k8s';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const namespace = searchParams.get('namespace');

    if (!name || !namespace) {
        return NextResponse.json({ error: 'Missing name or namespace' }, { status: 400 });
    }

    try {
        const logs = await getPodLogs(namespace, name);
        return new NextResponse(logs);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
