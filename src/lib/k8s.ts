import * as k8s from '@kubernetes/client-node';

let kc = new k8s.KubeConfig();
let customConfigs: string[] = [];

try {
    kc.loadFromDefault();
} catch (e) {
    console.warn('Failed to load default kubeconfig at startup:', e);
}

function refreshKubeConfig() {
    const newKc = new k8s.KubeConfig();
    try {
        newKc.loadFromDefault();
    } catch (e) {
        console.warn('Could not reload default kubeconfig:', e);
    }

    for (const configStr of customConfigs) {
        try {
            const tempKc = new k8s.KubeConfig();
            tempKc.loadFromString(configStr);
            newKc.clusters.push(...tempKc.clusters);
            newKc.users.push(...tempKc.users);
            newKc.contexts.push(...tempKc.contexts);
        } catch (e) {
            console.error('Error applying custom kubeconfig:', e);
        }
    }

    const oldContext = kc.getCurrentContext();
    kc = newKc;

    if (oldContext && kc.getContexts().some(c => c.name === oldContext)) {
        kc.setCurrentContext(oldContext);
    } else if (kc.getContexts().length > 0) {
        const defaultContext = kc.getContexts().find(c => 
            c.name.includes('docker-desktop') || 
            c.name.includes('docker-for-desktop') || 
            c.name === 'minikube'
        );
        if (defaultContext) {
            kc.setCurrentContext(defaultContext.name);
        } else {
            kc.setCurrentContext(kc.getContexts()[0].name);
        }
    }
}

export function getKubeConfig() {
    return kc;
}

export function setContext(contextName: string) {
    kc.setCurrentContext(contextName);
}

export function addKubeConfig(configStr: string) {
    customConfigs.push(configStr);
    refreshKubeConfig();
}

export function getContexts() {
    refreshKubeConfig();
    return {
        contexts: kc.getContexts(),
        currentContext: kc.getCurrentContext(),
    };
}

export const coreApi = () => kc.makeApiClient(k8s.CoreV1Api);
export const appsApi = () => kc.makeApiClient(k8s.AppsV1Api);
export const storageApi = () => kc.makeApiClient(k8s.StorageV1Api);
export const networkingApi = () => kc.makeApiClient(k8s.NetworkingV1Api);
export const apiExtensionsApi = () => kc.makeApiClient(k8s.ApiextensionsV1Api);
export const customObjectsApi = () => kc.makeApiClient(k8s.CustomObjectsApi);
export const batchApi = () => kc.makeApiClient(k8s.BatchV1Api);
export const rbacApi = () => kc.makeApiClient(k8s.RbacAuthorizationV1Api);
export const autoscalingApi = () => kc.makeApiClient(k8s.AutoscalingV2Api);

async function safeList(promise: Promise<any>) {
    try {
        const res = await promise;
        return res.items || res.body?.items || [];
    } catch (e) {
        console.error('Failed to list resource:', e);
        return [];
    }
}

export async function getResources() {
    const [
        pods,
        namespaces,
        deployments,
        statefulSets,
        configMaps,
        secrets,
        services,
        nodes,
        pvcs,
        pvs,
        storageClasses,
        networkPolicies,
        crds,
        ingresses,
        jobs,
        cronJobs,
        roles,
        clusterRoles,
        roleBindings,
        clusterRoleBindings,
        serviceAccounts,
        events,
        helmReleases,
        helmCharts,
        hpas,
        replicaSets,
        daemonSets
    ] = await Promise.all([
        safeList(coreApi().listPodForAllNamespaces()),
        safeList(coreApi().listNamespace()),
        safeList(appsApi().listDeploymentForAllNamespaces()),
        safeList(appsApi().listStatefulSetForAllNamespaces()),
        safeList(coreApi().listConfigMapForAllNamespaces()),
        safeList(coreApi().listSecretForAllNamespaces()),
        safeList(coreApi().listServiceForAllNamespaces()),
        safeList(coreApi().listNode()),
        safeList(coreApi().listPersistentVolumeClaimForAllNamespaces()),
        safeList(coreApi().listPersistentVolume()),
        safeList(storageApi().listStorageClass()),
        safeList(networkingApi().listNetworkPolicyForAllNamespaces()),
        safeList(apiExtensionsApi().listCustomResourceDefinition()),
        safeList(networkingApi().listIngressForAllNamespaces()),
        safeList(batchApi().listJobForAllNamespaces()),
        safeList(batchApi().listCronJobForAllNamespaces()),
        safeList(rbacApi().listRoleForAllNamespaces()),
        safeList(rbacApi().listClusterRole()),
        safeList(rbacApi().listRoleBindingForAllNamespaces()),
        safeList(rbacApi().listClusterRoleBinding()),
        safeList(coreApi().listServiceAccountForAllNamespaces()),
        safeList(coreApi().listEventForAllNamespaces()),
        getHelmReleases(),
        getHelmCharts(),
        safeList(autoscalingApi().listHorizontalPodAutoscalerForAllNamespaces()),
        safeList(appsApi().listReplicaSetForAllNamespaces()),
        safeList(appsApi().listDaemonSetForAllNamespaces()),
    ]);

    return {
        pods,
        namespaces,
        deployments,
        statefulSets,
        configMaps,
        secrets,
        services,
        nodes,
        pvcs,
        pvs,
        storageClasses,
        networkPolicies,
        crds,
        ingresses,
        jobs,
        cronJobs,
        roles,
        clusterRoles,
        roleBindings,
        clusterRoleBindings,
        serviceAccounts,
        events,
        helmReleases,
        helmCharts,
        hpas,
        replicaSets,
        daemonSets,
        currentContext: kc.getCurrentContext()
    };
}

export async function getPodLogs(namespace: string, name: string) {
    try {
        const res = await coreApi().readNamespacedPodLog({ name, namespace });
        return typeof res === 'string' ? res : (res as any).body;
    } catch (e) {
        return `Error fetching logs: ${e}`;
    }
}

export async function deleteResource(kind: string, name: string, namespace?: string) {
    const k = kind.toLowerCase();

    if (k === 'pod' && namespace) return coreApi().deleteNamespacedPod({ name, namespace });
    if (k === 'deployment' && namespace) return appsApi().deleteNamespacedDeployment({ name, namespace });
    if (k === 'service' && namespace) return coreApi().deleteNamespacedService({ name, namespace });
    if (k === 'statefulset' && namespace) return appsApi().deleteNamespacedStatefulSet({ name, namespace });
    if (k === 'configmap' && namespace) return coreApi().deleteNamespacedConfigMap({ name, namespace });
    if (k === 'secret' && namespace) return coreApi().deleteNamespacedSecret({ name, namespace });
    if (k === 'namespace') return coreApi().deleteNamespace({ name });

    if (k === 'helmrelease' && namespace) {
        const { exec } = require('child_process');
        return new Promise((resolve, reject) => {
            const cmd = `helm uninstall ${name} -n ${namespace}`;
            console.log(`[Helm] Executing: ${cmd}`);
            exec(cmd, (error: any, stdout: string, stderr: string) => {
                if (error) {
                    console.error('[Helm] Uninstall failed:', stderr);
                    reject(new Error(stderr || error.message));
                    return;
                }
                console.log('[Helm] Uninstall success:', stdout);
                resolve(stdout);
            });
        });
    }

    throw new Error(`Deletion for ${kind} not implemented or namespace missing`);
}

export async function restartDeployment(name: string, namespace: string, strategy?: string, options?: any) {
    const restartedAt = new Date().toISOString();
    console.log(`[Restart] Targeting ${namespace}/${name} with strategy: ${strategy || 'default'}`);

    // Base patch structure
    const patch: any = {
        spec: {
            template: {
                metadata: {
                    annotations: {
                        'kubectl.kubernetes.io/restartedAt': restartedAt
                    }
                }
            }
        }
    };

    // Only add strategy if specifically requested
    if (strategy) {
        patch.spec.strategy = {
            type: (strategy === 'canary' || strategy === 'RollingUpdate') ? 'RollingUpdate' : 'Recreate'
        };

        if (patch.spec.strategy.type === 'RollingUpdate') {
            patch.spec.strategy.rollingUpdate = {
                maxSurge: strategy === 'canary' ? 1 : (options?.maxSurge || '25%'),
                maxUnavailable: strategy === 'canary' ? 0 : (options?.maxUnavailable || '25%')
            };
        }
    }

    const api = appsApi();

    try {
        console.log('[Restart] Sending Strategic Merge Patch');
        await (api as any).patchNamespacedDeployment(
            { name, namespace, body: patch },
            { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
        );
        console.log(`[Success] Restarted ${name}`);
        return { success: true };
    } catch (e: any) {
        console.warn(`[Restart] Strategic patch failed, trying JSON patch:`, e.body || e.message);

        const jsonPatch = [
            {
                op: 'add',
                path: '/spec/template/metadata/annotations/kubectl.kubernetes.io~1restartedAt',
                value: restartedAt
            }
        ];

        try {
            await (api as any).patchNamespacedDeployment(
                { name, namespace, body: jsonPatch },
                { headers: { 'Content-Type': 'application/json-patch+json' } }
            );
            console.log(`[Success] Restarted ${name} via Fallback`);
            return { success: true };
        } catch (err: any) {
            console.error('[Restart] All attempts failed');
            throw err;
        }
    }
}


export async function getMetrics() {
    try {
        const res: any = await customObjectsApi().listClusterCustomObject({ group: 'metrics.k8s.io', version: 'v1beta1', plural: 'pods' });
        const nodeRes: any = await customObjectsApi().listClusterCustomObject({ group: 'metrics.k8s.io', version: 'v1beta1', plural: 'nodes' });
        return {
            pods: res.body?.items || res.items || [],
            nodes: nodeRes.body?.items || nodeRes.items || []
        };
    } catch (e: any) {
        // Metrics Server (metrics.k8s.io) is optional — silently return empty data when not installed
        const isNotFound = e?.body?.includes?.('404') || e?.code === 404 || String(e).includes('404');
        if (!isNotFound) {
            console.warn('[Metrics] Unexpected error fetching metrics:', e?.message ?? e);
        }
        return { pods: [], nodes: [], error: 'Metrics Server not available' };
    }
}

export async function getRawMetrics() {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        exec('kubectl get --raw /metrics', { maxBuffer: 10 * 1024 * 1024 }, (error: any, stdout: string) => {
            if (error) {
                console.error('[Metrics] Kubectl fetch failed:', error);
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

export async function getKubeletMetrics(nodeName: string) {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        exec(`kubectl get --raw /api/v1/nodes/${nodeName}/proxy/metrics`, { maxBuffer: 10 * 1024 * 1024 }, (error: any, stdout: string) => {
            if (error) {
                console.warn(`[Metrics] Kubelet fetch failed for ${nodeName}:`, error.message);
                resolve(''); // Fallback to empty if one node fails
                return;
            }
            resolve(stdout);
        });
    });
}
export async function getHelmReleases() {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        exec('helm list --all-namespaces -o json', (error: any, stdout: string) => {
            if (error) {
                console.error('[Helm] Failed to list releases:', error);
                resolve([]); // Return empty if helm is not installed or errors
                return;
            }
            try {
                resolve(JSON.parse(stdout));
            } catch (e) {
                resolve([]);
            }
        });
    });
}
export async function getHelmCharts() {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        exec('helm search repo -o json', (error: any, stdout: string) => {
            if (error) {
                console.warn('[Helm] Failed to search charts:', error);
                resolve([]);
                return;
            }
            try {
                resolve(JSON.parse(stdout));
            } catch (e) {
                resolve([]);
            }
        });
    });
}
export async function installHelmChart(chartName: string, releaseName: string, namespace: string = 'default') {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        const cmd = `helm install ${releaseName} ${chartName} -n ${namespace} --create-namespace`;
        console.log(`[Helm] Executing: ${cmd}`);
        exec(cmd, (error: any, stdout: string, stderr: string) => {
            if (error) {
                console.error('[Helm] Installation failed:', stderr);
                reject(new Error(stderr || error.message));
                return;
            }
            resolve(stdout);
        });
    });
}

export async function getCustomResourceInstances(group: string, version: string, plural: string) {
    try {
        const res: any = await customObjectsApi().listClusterCustomObject({ group, version, plural });
        return res.body?.items || res.items || [];
    } catch (e: any) {
        // Some CRDs are namespace-scoped; try all namespaces fallback
        try {
            const res: any = await customObjectsApi().listCustomObjectForAllNamespaces({ group, version, plural });
            return res.body?.items || res.items || [];
        } catch {
            console.error(`[CRD] Failed to list ${group}/${version}/${plural}:`, e.message || e);
            return [];
        }
    }
}
