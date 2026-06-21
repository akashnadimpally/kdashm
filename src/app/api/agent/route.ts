import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getResources } from '@/lib/k8s';
import { verifySessionToken } from '@/lib/auth';

interface ModelConfig {
  API_ENDPOINT: string;
  MODEL_NAME: string;
  API_VERSION: string;
  ACCESS_KEY: string;
}

interface AgentModels {
  [key: string]: ModelConfig;
}

function loadModelConfig(): AgentModels {
  const configPath = join(process.cwd(), 'agent_models.json');
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

function buildSystemPrompt(clusterContext: any, role: string): string {
  const {
    contextName = 'unknown',
    pods = [],
    nodes = [],
    events = [],
    namespace = 'all',
  } = clusterContext || {};

  const runningPods = pods.filter((p: any) => p.status?.phase === 'Running').length;
  const failedPods = pods.filter((p: any) => p.status?.phase === 'Failed').length;
  const pendingPods = pods.filter((p: any) => p.status?.phase === 'Pending').length;
  const unknownPods = pods.filter((p: any) => !['Running', 'Failed', 'Pending', 'Succeeded'].includes(p.status?.phase)).length;

  const crashLoopPods = pods.filter((p: any) =>
    p.status?.containerStatuses?.some((c: any) =>
      c.state?.waiting?.reason === 'CrashLoopBackOff'
    )
  ).map((p: any) => `  - ${p.metadata.namespace}/${p.metadata.name}`).join('\n');

  const highRestartPods = pods
    .filter((p: any) => {
      const restarts = p.status?.containerStatuses?.reduce((acc: number, c: any) => acc + (c.restartCount || 0), 0) || 0;
      return restarts > 5;
    })
    .map((p: any) => {
      const restarts = p.status?.containerStatuses?.reduce((acc: number, c: any) => acc + (c.restartCount || 0), 0) || 0;
      return `  - ${p.metadata.namespace}/${p.metadata.name} (${restarts} restarts)`;
    }).join('\n');

  const readyNodes = nodes.filter((n: any) =>
    n.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True'
  ).length;
  const notReadyNodes = nodes.length - readyNodes;

  const warningEvents = events
    .filter((e: any) => e.type === 'Warning')
    .slice(0, 10)
    .map((e: any) => `  - [${e.involvedObject.kind}/${e.involvedObject.name}] ${e.reason}: ${e.message}`)
    .join('\n');

  // Enforce role-based behavior instructions inside the system prompt
  let roleInstructions = "";
  if (role === "reader") {
    roleInstructions = `
## IMPORTANT: Authorization Constraint (Reader)
You are authorized under the 'reader' role. You only have READ access to the Kubernetes cluster.
- You CANNOT perform write, modify, or delete operations (e.g., you cannot scale workloads, restart deployments, delete pods, create configmaps, or install helm charts).
- Do not suggest commands that perform modifications (e.g. avoid 'kubectl delete', 'kubectl apply', 'helm install'). Only suggest read-only operations (e.g. 'kubectl get', 'kubectl describe', 'kubectl logs', 'kubectl auth can-i').
- If the user asks you to perform a modification, scale, restart, or delete a resource, refuse politely. State clearly that you are running under a read-only 'reader' role session and do not have write/CRUD permissions.
`;
  } else if (role === "contributor") {
    roleInstructions = `
## IMPORTANT: Authorization Constraint (Contributor)
You are authorized under the 'contributor' role. You have CRUD permissions for cluster workloads but CANNOT grant access or modify security controls.
- You can create, update, delete, scale, or restart workloads (e.g., suggest 'kubectl delete pod', 'kubectl rollout restart deployment', 'helm install').
- You CANNOT create, update, delete, or modify RBAC permissions, roles, role bindings, cluster roles, cluster role bindings, or service accounts.
- If the user asks you to grant permissions, create a role/binding, or manage service accounts, refuse politely. State clearly that you are running under a 'contributor' role session and do not have access-granting (RBAC) permissions.
`;
  } else {
    roleInstructions = `
## IMPORTANT: Authorization Constraint (Admin)
You are authorized under the 'admin' role. You have full access to the cluster, including creating, updating, and deleting all resources, as well as granting/modifying security permissions, roles, and bindings.
`;
  }

  return `You are an expert Kubernetes Site Reliability Engineer (SRE) and Cloud-Native AI Agent embedded in a Kubernetes dashboard called kDashM.

## Your Role
- Analyze the Kubernetes cluster in real-time and provide actionable insights
- Detect security breaches, misconfigurations, resource issues, and operational problems
- Suggest specific kubectl commands, YAML patches, and Helm operations to resolve issues
- Be concise, precise, and always back your analysis with the cluster data provided
- When asked to "fix" something, provide the exact steps, commands, or YAML needed
- Use markdown formatting with code blocks for commands and YAML snippets
${roleInstructions}

## Current Cluster State (${new Date().toUTCString()})

**Cluster Context:** \`${contextName}\`
**Active Namespace Filter:** \`${namespace}\`

### Pod Health Summary
- ✅ Running: ${runningPods}
- ⚠️ Pending: ${pendingPods}
- ❌ Failed: ${failedPods}
- ❓ Unknown/Other: ${unknownPods}
- 📦 Total Pods: ${pods.length}

### Node Health
- ✅ Ready Nodes: ${readyNodes}
- ❌ Not Ready Nodes: ${notReadyNodes}
- 📡 Total Nodes: ${nodes.length}

${crashLoopPods ? `### 🔴 CrashLoopBackOff Pods\n${crashLoopPods}` : '### ✅ No CrashLoopBackOff pods detected'}

${highRestartPods ? `### ⚠️ High Restart Count Pods\n${highRestartPods}` : '### ✅ No pods with excessive restarts'}

${warningEvents ? `### Recent Warning Events\n${warningEvents}` : '### ✅ No recent warning events'}

## Instructions
- Always reference specific pod/node names from the cluster data above when relevant
- Format kubectl commands in \`\`\`bash code blocks
- Format YAML in \`\`\`yaml code blocks
- If you detect a critical issue, start your response with 🚨 CRITICAL
- If there are warnings, start relevant sections with ⚠️ WARNING
- For healthy states, confirm with ✅
`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Decode role from session token
    const sessionCookie = req.cookies.get("kdashm_session")?.value;
    const payload = sessionCookie ? await verifySessionToken(sessionCookie) : null;

    if (!payload) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { model = 'openai_gpt', messages = [], clusterSummary } = body;

    // Load model config server-side
    const allModels = loadModelConfig();
    const modelConfig = allModels[model];

    if (!modelConfig) {
      return new Response(
        JSON.stringify({ error: `Model "${model}" not found in agent_models.json` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!modelConfig.API_ENDPOINT || !modelConfig.MODEL_NAME || !modelConfig.ACCESS_KEY) {
      return new Response(
        JSON.stringify({ error: `Model "${model}" is not fully configured. Please fill in agent_models.json.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch live cluster context
    let clusterContext = clusterSummary || {};
    try {
      const resources = await getResources();
      clusterContext = {
        contextName: resources.currentContext,
        pods: resources.pods || [],
        nodes: resources.nodes || [],
        events: resources.events || [],
        namespace: clusterSummary?.namespace || 'all',
      };
    } catch (e) {
      console.warn('[Agent] Could not fetch live cluster data, using provided summary:', e);
    }

    const systemPrompt = buildSystemPrompt(clusterContext, payload.role);

    // Build OpenAI-compatible messages
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Build Azure AI Foundry URL
    const baseUrl = modelConfig.API_ENDPOINT.replace(/\/$/, '');
    const apiVersion = modelConfig.API_VERSION || '2024-02-01';
    const url = `${baseUrl}/openai/deployments/${modelConfig.MODEL_NAME}/chat/completions?api-version=${apiVersion}`;

    const azureResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': modelConfig.ACCESS_KEY,
      },
      body: JSON.stringify({
        messages: chatMessages,
        stream: true,
        max_tokens: 2048,
        temperature: 0.3, // Lower temp for more precise SRE answers
      }),
    });

    if (!azureResponse.ok) {
      const errText = await azureResponse.text();
      console.error('[Agent] Azure AI Foundry error:', errText);
      return new Response(
        JSON.stringify({ error: `Azure AI Foundry error (${azureResponse.status}): ${errText}` }),
        { status: azureResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Stream the response back to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = azureResponse.body!.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter((line) => line.trim());

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch {
                  // Skip malformed SSE lines
                }
              }
            }
          }
        } catch (e) {
          console.error('[Agent] Stream error:', e);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (e: any) {
    console.error('[Agent] Unexpected error:', e);
    return new Response(
      JSON.stringify({ error: e.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
