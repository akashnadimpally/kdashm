import { NextResponse } from 'next/server';
import { getContexts, setContext, addKubeConfig } from '@/lib/k8s';

export async function GET() {
    try {
        return NextResponse.json(getContexts());
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { context, kubeconfig } = await request.json();

        if (kubeconfig) {
            addKubeConfig(kubeconfig);
            return NextResponse.json({ success: true });
        }

        if (context) {
            setContext(context);
            return NextResponse.json({ success: true, currentContext: context });
        }

        return NextResponse.json({ error: 'Missing context or kubeconfig' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
