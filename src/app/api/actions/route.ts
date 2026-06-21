import { NextRequest, NextResponse } from 'next/server';
import { deleteResource, restartDeployment, installHelmChart } from '@/lib/k8s';
import { verifySessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const sessionCookie = request.cookies.get("kdashm_session")?.value;
        const payload = sessionCookie ? await verifySessionToken(sessionCookie) : null;

        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { role } = payload;
        const body = await request.json();
        const { action, kind, name, namespace, strategy, options, chart, releaseName } = body;

        // 1. Reader role is read-only
        if (role === 'reader') {
            return NextResponse.json(
                { error: 'Forbidden: Readers do not have write access to cluster resources' }, 
                { status: 403 }
            );
        }

        // 2. Contributor role can do CRUD, except for granting permissions (RBAC kinds)
        if (role === 'contributor') {
            const lowerKind = kind?.toLowerCase() || '';
            const isRbacKind = [
                'role',
                'clusterrole',
                'rolebinding',
                'clusterrolebinding',
                'serviceaccount'
            ].includes(lowerKind);

            if (isRbacKind) {
                return NextResponse.json(
                    { error: 'Forbidden: Contributors are not permitted to manage or grant cluster permissions (RBAC)' }, 
                    { status: 403 }
                );
            }
        }

        // Execute action
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
