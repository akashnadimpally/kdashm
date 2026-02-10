import { NextResponse } from 'next/server';
import { deleteResource, restartDeployment, installHelmChart } from '@/lib/k8s';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, kind, name, namespace, strategy, options, chart, releaseName } = body;

        if (action === 'delete') {
            await deleteResource(kind, name, namespace);
            return NextResponse.json({ success: true });
        }

        if (action === 'restart' && kind.toLowerCase() === 'deployment') {
            await restartDeployment(name, namespace, strategy, options);
            return NextResponse.json({ success: true });
        }

        if (action === 'install' && kind === 'helmChart') {
            await installHelmChart(chart, releaseName, namespace || 'default');
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Action failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
