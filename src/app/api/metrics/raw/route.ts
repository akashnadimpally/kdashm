import { NextResponse } from 'next/server';
import { getRawMetrics, getKubeletMetrics, coreApi } from '@/lib/k8s';

export async function GET() {
    try {
        // 1. Get Node List
        const nodeRes = await coreApi().listNode() as any;
        const nodes = nodeRes.items || nodeRes.body?.items || [];
        const nodeNames = nodes.map((n: any) => n.metadata?.name).filter(Boolean) as string[];

        // 2. Fetch all sources in parallel
        const sources = await Promise.all([
            getRawMetrics(),
            ...nodeNames.map(name => getKubeletMetrics(name))
        ]);

        const totalRaw = sources.join('\n');
        const lines = totalRaw.split('\n');
        
        const metricsMap = new Map<string, any>();
        let lastHelpLine: { name: string, help: string } | null = null;
        let lastTypeLine: { name: string, type: string } | null = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                if (trimmed.startsWith('# HELP ')) {
                    const parts = trimmed.split(' ');
                    if (parts.length >= 3) lastHelpLine = { name: parts[2], help: parts.slice(3).join(' ') };
                } else if (trimmed.startsWith('# TYPE ')) {
                    const parts = trimmed.split(' ');
                    if (parts.length >= 3) lastTypeLine = { name: parts[2], type: parts[3] };
                }
                continue;
            }

            // Parse metric line: name{labels} value
            const lastSpace = trimmed.lastIndexOf(' ');
            if (lastSpace === -1) continue;

            const nameAndLabels = trimmed.substring(0, lastSpace);
            const valueStr = trimmed.substring(lastSpace + 1);

            let name = nameAndLabels;
            const labels: any = {};

            if (nameAndLabels.includes('{')) {
                const braceIdx = nameAndLabels.indexOf('{');
                name = nameAndLabels.substring(0, braceIdx);
                const labelStr = nameAndLabels.substring(braceIdx + 1, nameAndLabels.length - 1);

                // Better label parser for quoted values
                let currentKey = '';
                let currentValue = '';
                let inQuotes = false;
                let buildingValue = false;

                for (let i = 0; i < labelStr.length; i++) {
                    const char = labelStr[i];
                    if (char === '=') { buildingValue = true; continue; }
                    if (char === '"') { inQuotes = !inQuotes; continue; }
                    if (char === ',' && !inQuotes) {
                        labels[currentKey.trim()] = currentValue;
                        currentKey = ''; currentValue = ''; buildingValue = false;
                        continue;
                    }

                    if (buildingValue) currentValue += char;
                    else currentKey += char;
                }
                if (currentKey) labels[currentKey.trim()] = currentValue;
            }

            if (!metricsMap.has(name)) {
                metricsMap.set(name, {
                    name,
                    help: (lastHelpLine && lastHelpLine.name === name) ? lastHelpLine.help : '',
                    type: (lastTypeLine && lastTypeLine.name === name) ? lastTypeLine.type : 'untyped',
                    values: []
                });
            }

            metricsMap.get(name).values.push({
                labels,
                value: parseFloat(valueStr)
            });
        }

        return NextResponse.json(Array.from(metricsMap.values()));
    } catch (error: any) {
        console.error('[Aggregator Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
