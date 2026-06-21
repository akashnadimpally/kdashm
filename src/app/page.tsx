'use client';
import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import AgentPanel from '@/components/AgentPanel';
import { Box, Layers, Network, Shield, Settings, Server, Database, Cpu, Activity, RefreshCw, ChevronRight, ChevronUp, ChevronDown, X, Terminal, Eye, Lock, Unlock, RefreshCcw, Trash2, FileCode, User, Store, Plus, GitBranch, ShipWheel, Bot } from 'lucide-react';
import yaml from 'js-yaml';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const metricsFetcher = async (url: string) => {
  const text = await fetch(url).then(res => res.text());
  const lines = text.split('\n');
  const metrics: any = {};
  let currentHelp = '';
  let currentType = '';

  lines.forEach(line => {
    line = line.trim();
    if (!line) return;
    if (line.startsWith('# HELP')) {
      const parts = line.split(' ');
      const name = parts[2];
      currentHelp = parts.slice(3).join(' ');
      if (!metrics[name]) metrics[name] = { name, help: currentHelp, samples: [] };
      else metrics[name].help = currentHelp;
    } else if (line.startsWith('# TYPE')) {
      const parts = line.split(' ');
      const name = parts[2];
      currentType = parts[3];
      if (!metrics[name]) metrics[name] = { name, type: currentType, samples: [] };
      else metrics[name].type = currentType;
    } else if (!line.startsWith('#')) {
      const match = line.match(/^([a-zA-Z0-9_:]+)(?:\{([^}]+)\})?\s+(.+)$/);
      if (match) {
        const name = match[1];
        const labelStr = match[2];
        const value = parseFloat(match[3]) || match[3];
        const labels: any = {};
        if (labelStr) {
          labelStr.replace(/([a-zA-Z0-9_]+)="([^"]+)"/g, (m, k, v) => {
            labels[k] = v;
            return '';
          });
        }

        if (!metrics[name]) metrics[name] = { name, samples: [] };
        metrics[name].samples.push({ labels, value });
        // Also populate 'values' property for backward compatibility with Analytics charts
        if (!metrics[name].values) metrics[name].values = [];
        metrics[name].values.push({ value, timestamp: Date.now() });
      }
    }
  });
  return Object.values(metrics);
};

export default function Home() {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCrd, setSelectedCrd] = useState<any>(null);
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [showLogs, setShowLogs] = useState<any>(null);
  const [showDescribe, setShowDescribe] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showYaml, setShowYaml] = useState<any>(null);
  const [showRestartModal, setShowRestartModal] = useState<any>(null);
  const [metricsSearch, setMetricsSearch] = useState('');
  const [showPodMetrics, setShowPodMetrics] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [analyticsLabelSearch, setAnalyticsLabelSearch] = useState('');
  const [selectedMetricForChart, setSelectedMetricForChart] = useState<any>(null);
  const [metricHistory, setMetricHistory] = useState<any[]>([]);
  const [showEvents, setShowEvents] = useState<any>(null);
  const [helmSearch, setHelmSearch] = useState('');
  const [localPositions, setLocalPositions] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState<any>(null);
  const [installConfig, setInstallConfig] = useState({ releaseName: '', namespace: 'default', isNew: false });
  const [metricsNamespaceFilter, setMetricsNamespaceFilter] = useState('all');
  const [metricsExplorerSearch, setMetricsExplorerSearch] = useState('');
  const [selectedExplorerMetric, setSelectedExplorerMetric] = useState<any>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showAgentPanel, setShowAgentPanel] = useState(false);

  const { data, error, isLoading, mutate } = useSWR('/api/resources', fetcher, {
    refreshInterval: 10000,
  });

  const { data: metricsData } = useSWR('/api/metrics', fetcher, {
    refreshInterval: 5000,
  });

  // Unified high-frequency metrics stream for Analytics and Explorer
  const { data: unifiedRawMetrics, isLoading: loadingRawMetrics } = useSWR(
    (activeTab === 'metrics' || activeTab === 'analytics' || activeTab === 'all') ? '/api/metrics/raw' : null,
    metricsFetcher,
    { refreshInterval: 5000 }
  );

  const { data: logData, isLoading: loadingLogs } = useSWR(
    showLogs ? `/api/logs?name=${showLogs.metadata.name}&namespace=${showLogs.metadata.namespace}` : null,
    (url: string) => fetch(url).then(res => res.text())
  );

  const rawMetrics = unifiedRawMetrics; // Alias for backward compatibility in render

  useEffect(() => {
    if (unifiedRawMetrics && Array.isArray(unifiedRawMetrics)) {
      const timestamp = new Date().toLocaleTimeString();

      // Get filtered pods first to correlate with metrics
      const filteredPods = (data?.pods || []).filter((p: any) => {
        const matchesNamespace = selectedNamespace === 'all' || p.metadata.namespace === selectedNamespace;
        const labelsStr = JSON.stringify(p.metadata.labels || {}).toLowerCase();
        const matchesLabels = !analyticsLabelSearch || labelsStr.includes(analyticsLabelSearch.toLowerCase());
        return matchesNamespace && matchesLabels;
      });

      const podMap = new Set(filteredPods.map((p: any) => `${p.metadata.namespace}/${p.metadata.name}`));

      let cpuTotal = 0;
      let memTotal = 0;
      let podRunning = 0;
      let podPending = 0;

      if (metricsData?.pods) {
        metricsData.pods.forEach((p: any) => {
          if (podMap.has(`${p.metadata.namespace}/${p.metadata.name}`)) {
            p.containers?.forEach((c: any) => {
              cpuTotal += parseInt(c.usage?.cpu?.replace('n', '')) / 1000000 || 0;
              memTotal += parseInt(c.usage?.memory?.replace('Ki', '')) / 1024 || 0;
            });
          }
        });
      }

      filteredPods.forEach((p: any) => {
        if (p.status?.phase === 'Running') podRunning++;
        else podPending++;
      });

      let podRequests = 0;
      let serviceRequests = 0;

      if (unifiedRawMetrics) {
        const reqMetric = unifiedRawMetrics.find((m: any) => m.name === 'apiserver_request_total');
        if (reqMetric) {
          (reqMetric as any).values.forEach((v: any) => {
            if (v.labels?.resource === 'pods') podRequests += typeof v.value === 'number' ? v.value : 0;
            if (v.labels?.resource === 'services') serviceRequests += typeof v.value === 'number' ? v.value : 0;
          });
        }
      }

      const currentPoint = { timestamp, cpu: cpuTotal, memory: memTotal, running: podRunning, pending: podPending, podRequests, serviceRequests };
      setHistory(prev => [...prev, currentPoint].slice(-30));

      // Also track the "Pinned" metric for explorer chart
      if (selectedMetricForChart) {
        const liveMetric = (unifiedRawMetrics || []).find((m: any) => m.name === selectedMetricForChart.name);
        if (liveMetric) {
          const sumValue = (liveMetric as any).values.reduce((acc: number, v: any) => acc + (typeof v.value === 'number' ? v.value : 0), 0);
          setMetricHistory(prev => [...prev, { timestamp, value: sumValue }].slice(-30));
        }
      }
    }
  }, [unifiedRawMetrics, data, metricsData, selectedNamespace, analyticsLabelSearch, selectedMetricForChart]);


  // Clear history when filter significantly changes to avoid mixed data points
  useEffect(() => {
    setHistory([]);
    setLocalPositions(null); // Reset visualizer positions on filter change
  }, [selectedNamespace, analyticsLabelSearch, activeTab]);

  // Visualizer Layout Effect
  useEffect(() => {
    if (activeTab === 'visualizer' && data && !localPositions) {
      const ns = selectedNamespace === 'all' ? 'default' : selectedNamespace;
      const pods = (data.pods || []).filter((p: any) => p.metadata.namespace === ns);
      const svcs = (data.services || []).filter((s: any) => s.metadata.namespace === ns);
      const deploys = (data.deployments || []).filter((d: any) => d.metadata.namespace === ns);
      const ingresses = (data.ingresses || []).filter((i: any) => i.metadata.namespace === ns);

      const nodes = [
        ...ingresses,
        ...svcs,
        ...deploys,
        ...pods
      ];

      if (nodes.length > 0) {
        const initial: any = {};
        nodes.forEach((node, i) => {
          const angle = (i / nodes.length) * 2 * Math.PI;
          const radius = nodes.length > 5 ? 350 : 250;
          initial[node.metadata.uid || node.metadata.name] = {
            x: Math.cos(angle) * radius + 550,
            y: Math.sin(angle) * radius + 400
          };
        });
        setLocalPositions(initial);
      }
    }
  }, [activeTab, data, selectedNamespace, localPositions]);

  const performAction = async (action: string, res: any, strategy?: string, options?: any) => {
    const kind = res.kind || (activeTab === 'helmCharts' ? 'helmChart' : activeTab.slice(0, -1));
    const id = `${action}-${res.metadata.uid}`;
    setActionLoading(id);
    try {
      const body: any = {
        action,
        kind,
        name: res.metadata.name,
        namespace: options?.targetNamespace || (selectedNamespace === 'all' ? 'default' : selectedNamespace),
        strategy,
        options
      };

      if (action === 'install' && activeTab === 'helmCharts') {
        body.chart = res.name;
        body.releaseName = options?.releaseName;
      }

      const response = await fetch('/api/actions', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Action failed');
      }

      mutate();
      if (action === 'install') {
        setActiveTab('helmReleases');
      }
    } catch (e: any) {
      alert(`Action failed: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstall = (chart: any) => {
    setShowInstallModal(chart);
    setInstallConfig({
      releaseName: chart.name.split('/').pop(),
      namespace: selectedNamespace === 'all' ? 'default' : selectedNamespace,
      isNew: false
    });
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const stats = useMemo(() => {
    if (!data) return [];
    return [
      { id: 'pods', label: 'Pods', count: data.pods?.length || 0, icon: Box, color: '#3b82f6' },
      { id: 'deployments', label: 'Deployments', count: data.deployments?.length || 0, icon: Layers, color: '#6366f1' },
      { id: 'services', label: 'Services', count: data.services?.length || 0, icon: Network, color: '#8b5cf6' },
      { id: 'serviceAccounts', label: 'Service Accounts', count: data.serviceAccounts?.length || 0, icon: User, color: '#ec4899' },
      { id: 'nodes', label: 'Nodes', count: data.nodes?.length || 0, icon: Server, color: '#22c55e' },
    ];
  }, [data]);

  const namespaces = useMemo(() => {
    if (!data?.namespaces) return [];
    return data.namespaces.map((ns: any) => ns.metadata.name);
  }, [data]);

  const filteredResources = useMemo(() => {
    if (!data || activeTab === 'all') return [];

    if (['nodes', 'pvs', 'storageClasses', 'clusterRoles', 'clusterRoleBindings', 'crds'].includes(activeTab)) {
      return data[activeTab] || [];
    }

    if (activeTab === 'helmCharts') {
      const charts = (data.helmCharts || []).map((c: any) => ({
        ...c,
        metadata: {
          name: c.name,
          uid: `chart-${c.name}-${c.version}`
        }
      }));
      if (!helmSearch) return charts;
      return charts.filter((c: any) =>
        c.name.toLowerCase().includes(helmSearch.toLowerCase()) ||
        c.description.toLowerCase().includes(helmSearch.toLowerCase())
      );
    }

    if (activeTab === 'helmReleases') {
      const releases = (data.helmReleases || []).map((r: any) => ({
        ...r,
        kind: 'helmRelease',
        metadata: {
          name: r.name,
          namespace: r.namespace,
          uid: `${r.name}-${r.namespace}-${r.revision}`
        }
      }));
      if (selectedNamespace === 'all') return releases;
      return releases.filter((res: any) => res.metadata.namespace === selectedNamespace);
    }

    if (activeTab === 'hpas') {
      const hpas = (data.hpas || []).map((h: any) => ({
        ...h,
        kind: 'HorizontalPodAutoscaler'
      }));
      if (selectedNamespace === 'all') return hpas;
      return hpas.filter((res: any) => res.metadata.namespace === selectedNamespace);
    }

    const resources = data[activeTab] || [];
    if (selectedNamespace === 'all') return resources;
    return resources.filter((res: any) => res.metadata.namespace === selectedNamespace);
  }, [data, activeTab, selectedNamespace, helmSearch]);

  const parseK8sResource = (val: string) => {
    if (!val) return 0;
    const num = parseFloat(val);
    const unit = val.toLowerCase();
    if (unit.endsWith('n')) return num / 1000000; // nano to milli
    if (unit.endsWith('m')) return num; // milli
    if (unit.endsWith('ki')) return num / 1024;
    if (unit.endsWith('mi')) return num;
    if (unit.endsWith('gi')) return num * 1024;
    if (unit.endsWith('ti')) return num * 1024 * 1024;
    // Core units (e.g. "1")
    if (/^\d+(\.\d+)?$/.test(val)) return num * 1000; // Convert cores to milli
    return num;
  };

  const getMetricsForPod = (pod: any) => {
    const podMetrics = metricsData?.pods?.find((p: any) => p.metadata.name === pod.metadata.name && p.metadata.namespace === pod.metadata.namespace);
    if (!podMetrics) return null;

    const cpuUsage = podMetrics.containers.reduce((acc: number, c: any) => acc + (parseK8sResource(c.usage.cpu) || 0), 0);
    const memUsage = podMetrics.containers.reduce((acc: number, c: any) => acc + (parseK8sResource(c.usage.memory) || 0), 0);

    // Calculate total limits
    let cpuLimit = 0;
    let memLimit = 0;
    pod.spec.containers.forEach((c: any) => {
      if (c.resources?.limits?.cpu) cpuLimit += parseK8sResource(c.resources.limits.cpu);
      if (c.resources?.limits?.memory) memLimit += parseK8sResource(c.resources.limits.memory);
    });

    // Fallback to node capacity if no limits
    let isNodeLimit = false;
    if (cpuLimit === 0 || memLimit === 0) {
      const node = data?.nodes?.find((n: any) => n.metadata.name === pod.spec.nodeName);
      if (node) {
        if (cpuLimit === 0) cpuLimit = parseK8sResource(node.status.allocatable.cpu);
        if (memLimit === 0) memLimit = parseK8sResource(node.status.allocatable.memory);
        isNodeLimit = true;
      }
    }

    const cpuPct = cpuLimit > 0 ? (cpuUsage / cpuLimit) * 100 : null;
    const memPct = memLimit > 0 ? (memUsage / memLimit) * 100 : null;

    return { cpuUsage, memUsage, cpuPct, memPct, isNodeLimit };
  };

  const formatUptime = (timestamp: string) => {
    const started = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - started) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const decodeBase64 = (str: string) => {
    try { return atob(str); } catch (e) { return 'Error decoding'; }
  };


  const getLatestEvent = (res: any) => {
    const evts = getAllEvents(res);
    return evts.length > 0 ? evts[0] : null;
  };

  const getAllEvents = (res: any) => {
    if (!data?.events) return [];
    return data.events.filter((e: any) =>
      e.involvedObject.uid === res.metadata.uid ||
      (e.involvedObject.name === res.metadata.name && e.involvedObject.namespace === res.metadata.namespace)
    ).sort((a: any, b: any) =>
      new Date(b.lastTimestamp || b.eventTime || 0).getTime() -
      new Date(a.lastTimestamp || a.eventTime || 0).getTime()
    );
  };



  const sortedResources = useMemo(() => {
    let sortableItems = [...filteredResources];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        let aValue: any = '', bValue: any = '';

        if (sortConfig.key === 'name') {
          aValue = a.metadata?.name || '';
          bValue = b.metadata?.name || '';
        } else if (sortConfig.key === 'namespace') {
          aValue = a.metadata?.namespace || '';
          bValue = b.metadata?.namespace || '';
        } else if (sortConfig.key === 'age') { // We map 'uptime' to 'age' logic roughly or add Age column
          aValue = new Date(a.metadata?.creationTimestamp || 0).getTime();
          bValue = new Date(b.metadata?.creationTimestamp || 0).getTime();
        } else if (sortConfig.key === 'cpu') {
          aValue = getMetricsForPod(a)?.cpuUsage || 0;
          bValue = getMetricsForPod(b)?.cpuUsage || 0;
        } else if (sortConfig.key === 'memory') {
          aValue = getMetricsForPod(a)?.memUsage || 0;
          bValue = getMetricsForPod(b)?.memUsage || 0;
        } else if (sortConfig.key === 'restarts') {
          aValue = a.status?.containerStatuses?.reduce((acc: number, s: any) => acc + s.restartCount, 0) || 0;
          bValue = b.status?.containerStatuses?.reduce((acc: number, s: any) => acc + s.restartCount, 0) || 0;
        } else if (sortConfig.key === 'status') {
          aValue = a.status?.phase || '';
          bValue = b.status?.phase || '';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredResources, sortConfig, metricsData]);

  const filteredRawMetrics = useMemo(() => {
    if (!rawMetrics) return [];
    let filtered = rawMetrics;

    // Apply search filter
    if (metricsSearch) {
      filtered = filtered.filter((m: any) =>
        m.name.toLowerCase().includes(metricsSearch.toLowerCase()) ||
        m.help?.toLowerCase().includes(metricsSearch.toLowerCase())
      );
    }

    // Apply namespace filter
    if (metricsNamespaceFilter !== 'all') {
      filtered = filtered.map((m: any) => {
        const filteredValues = m.values.filter((v: any) =>
          v.labels?.namespace === metricsNamespaceFilter
        );
        return filteredValues.length > 0 ? { ...m, values: filteredValues } : null;
      }).filter(Boolean);
    }

    return filtered;
  }, [rawMetrics, metricsSearch, metricsNamespaceFilter]);

  const nodeStats = useMemo(() => {
    if (!data?.nodes) return [];
    return data.nodes.map((n: any) => {
      const metrics = metricsData?.nodes?.find((m: any) => m.metadata.name === n.metadata.name);
      const cpuUsage = parseK8sResource(metrics?.usage?.cpu || '0');
      const memUsage = parseK8sResource(metrics?.usage?.memory || '0');
      const cpuCap = parseK8sResource(n.status.allocatable?.cpu || '0');
      const memCap = parseK8sResource(n.status.allocatable?.memory || '0');
      return {
        name: n.metadata.name,
        ready: n.status.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True',
        cpu: { usage: cpuUsage, capacity: cpuCap, pct: cpuCap > 0 ? (cpuUsage / cpuCap) * 100 : 0 },
        memory: { usage: memUsage, capacity: memCap, pct: memCap > 0 ? (memUsage / memCap) * 100 : 0 },
        conditions: n.status.conditions || []
      };
    });
  }, [data, metricsData]);

  const renderContent = () => {
    if (isLoading && !data) return <div style={{ padding: '4rem', textAlign: 'center' }}><Activity className="animate-spin" /> Initializing...</div>;
    if (error) return <div style={{ padding: '4rem', color: 'var(--danger)' }}>Error: {error.message}</div>;
    if (!data) return null;

    if (activeTab === 'all') {
      return (
        <div className="animate-fade-in">
          <header style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800' }}>Dashboard</h2>
            <p style={{ opacity: 0.6, fontSize: '1.1rem' }}>{data.currentContext || 'Kubernetes Cluster'} Overview</p>
          </header>

          <div className="dashboard-grid">
            {stats.map((stat) => (
              <motion.div
                key={stat.id}
                whileHover={{ y: -5 }}
                className="card glass"
                onClick={() => setActiveTab(stat.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '0.5rem', fontWeight: 600 }}>{stat.label.toUpperCase()}</p>
                    <h3 style={{ fontSize: '2.5rem', fontWeight: '800' }}>{stat.count}</h3>
                  </div>
                  <div style={{ background: `${stat.color}20`, padding: '1.25rem', borderRadius: '20px' }}>
                    <stat.icon color={stat.color} size={36} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'analytics') {
      const podStatusData = [
        { name: 'Running', value: history[history.length - 1]?.running || 0, color: '#22c55e' },
        { name: 'Pending', value: history[history.length - 1]?.pending || 0, color: '#f59e0b' }
      ];

      return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', paddingBottom: '2rem' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>Cluster Analytics</h2>
              <p style={{ opacity: 0.6 }}>Grafana-style time-series visualization</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <select
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                className="glass"
                style={{ padding: '0.75rem 1rem', borderRadius: '14px', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <option value="all">All Namespaces</option>
                {namespaces.map((ns: string) => <option key={ns} value={ns}>{ns}</option>)}
              </select>
              <input
                type="text"
                placeholder="Filter by labels (e.g. app=nginx)..."
                className="glass"
                value={analyticsLabelSearch}
                onChange={(e) => setAnalyticsLabelSearch(e.target.value)}
                style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', border: 'none', color: '#fff', width: '300px' }}
              />
            </div>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', flex: 1 }}>
            {/* CPU Trend */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Cpu size={18} /> CPU Usage</h3>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#3b82f6' }}>{Math.round(history[history.length - 1]?.cpu || 0)}m</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>CURRENT TOTAL</div>
                </div>
              </div>
              <div style={{ flex: 1, width: '100%', minHeight: '180px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} unit="m" />
                    <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Memory Trend */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Database size={18} /> Memory Usage</h3>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#a855f7' }}>{(history[history.length - 1]?.memory / 1024 || 0).toFixed(2)} GB</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>CURRENT TOTAL</div>
                </div>
              </div>
              <div style={{ flex: 1, width: '100%', minHeight: '180px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} unit="Mi" />
                    <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="memory" stroke="#a855f7" fillOpacity={1} fill="url(#colorMem)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pod Distribution */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700 }}>Pod Lifecycle Health</h3>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#22c55e' }}>{(history[history.length - 1]?.running || 0)}</div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>RUNNING PODS</div>
                </div>
              </div>
              <div style={{ flex: 1, width: '100%', minHeight: '210px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{(history[history.length - 1]?.running || 0) + (history[history.length - 1]?.pending || 0)}</div>
                  <div style={{ fontSize: '0.5rem', opacity: 0.5 }}>TOTAL</div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={podStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {podStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Node Performance */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700 }}>Pod Scaling (Live)</h3>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '1.2rem', fontWeight: 900 }}>
                    <span style={{ color: '#22c55e' }}>{history[history.length - 1]?.running || 0}R</span>
                    <span style={{ color: '#f59e0b' }}>{history[history.length - 1]?.pending || 0}P</span>
                  </div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>RUNNING / PENDING</div>
                </div>
              </div>
              <div style={{ flex: 1, width: '100%', minHeight: '180px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Bar dataKey="running" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Container Restart Rate */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCcw size={18} /> Container Restarts</h3>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>
                    {data.pods?.reduce((acc: number, p: any) =>
                      acc + (p.status?.containerStatuses?.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0) || 0), 0
                    ) || 0}
                  </div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>TOTAL RESTARTS</div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto' }}>
                {data.pods?.filter((p: any) =>
                  p.status?.containerStatuses?.some((c: any) => c.restartCount > 0)
                ).slice(0, 5).map((pod: any, i: number) => {
                  const restarts = pod.status?.containerStatuses?.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0) || 0;
                  return (
                    <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{pod.metadata.name}</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{pod.metadata.namespace}</div>
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ef4444' }}>{restarts}</div>
                    </div>
                  );
                })}
                {(!data.pods || data.pods.filter((p: any) => p.status?.containerStatuses?.some((c: any) => c.restartCount > 0)).length === 0) && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✓</div>
                      <div style={{ fontSize: '0.8rem' }}>No restarts detected</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cluster Health & Nodes */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', gridColumn: 'span 2', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Server size={18} /> Node Health & Metrics</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className="status-dot status-running" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{nodeStats.filter((n: any) => n.ready).length} Ready</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className="status-dot status-failed" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{nodeStats.filter((n: any) => !n.ready).length} Not Ready</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: '350px' }}>
                {nodeStats.map((n: any) => (
                  <div key={n.name} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className={`status-dot ${n.ready ? 'status-running' : 'status-failed'}`} />
                        {n.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{n.cpu.usage.toFixed(0)}m / {n.memory.usage.toFixed(0)}Mi</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px' }}>
                          <span style={{ opacity: 0.7 }}>CPU</span>
                          <span style={{ fontWeight: 700, color: n.cpu.pct > 80 ? 'var(--danger)' : 'var(--primary)' }}>{n.cpu.pct.toFixed(0)}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, n.cpu.pct)}%` }}
                            style={{ height: '100%', background: n.cpu.pct > 80 ? 'var(--danger)' : 'var(--primary)' }}
                          />
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px' }}>
                          <span style={{ opacity: 0.7 }}>Memory</span>
                          <span style={{ fontWeight: 700, color: n.memory.pct > 80 ? 'var(--danger)' : 'var(--secondary)' }}>{n.memory.pct.toFixed(0)}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, n.memory.pct)}%` }}
                            style={{ height: '100%', background: n.memory.pct > 80 ? 'var(--danger)' : 'var(--secondary)' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* API Requests by Resource */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Network size={18} /> API Requests by Resource</h3>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#06b6d4' }}>
                    {((history[history.length - 1]?.podRequests || 0) + (history[history.length - 1]?.serviceRequests || 0)).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>PODS & SERVICES</div>
                </div>
              </div>
              <div style={{ flex: 1, width: '100%', minHeight: '180px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history.slice(-15)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="podRequests" name="Pod Requests" fill="#ec4899" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="serviceRequests" name="Service Requests" fill="#8b5cf6" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Network Traffic */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Network size={18} /> Network Activity</h3>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#06b6d4' }}>
                    {(rawMetrics as any)?.find((m: any) => m.name === 'apiserver_request_total')?.values?.length || 0}
                  </div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>API REQUESTS</div>
                </div>
              </div>
              <div style={{ flex: 1, width: '100%', minHeight: '180px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.slice(-15)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="running" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* HPA Scaling */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={18} /> Autoscaling (HPA)</h3>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ec4899' }}>
                    {data.hpas?.length || 0}
                  </div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>ACTIVE SCALERS</div>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto' }}>
                {data.hpas && data.hpas.length > 0 ? (
                  data.hpas.map((hpa: any, i: number) => {
                    const current = hpa.status?.currentReplicas || 0;
                    const max = hpa.spec?.maxReplicas || 0;
                    const utilization = Math.round((current / max) * 100) || 0;
                    const targetName = hpa.spec?.scaleTargetRef?.name;

                    // Try to get CPU metric
                    const cpuMetric = hpa.status?.currentMetrics?.find((m: any) => m.type === 'Resource' && m.resource?.name === 'cpu');
                    const currentCpu = cpuMetric?.resource?.current?.averageUtilization;

                    return (
                      <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{hpa.metadata.name}</div>
                            <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>Target: {targetName}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ec4899' }}>{current} / {max}</div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>REPLICAS</div>
                          </div>
                        </div>

                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '4px' }}>
                            <span style={{ opacity: 0.7 }}>Scale Capacity</span>
                            <span>{utilization}%</span>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(236, 72, 153, 0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(utilization, 100)}%`, height: '100%', background: '#ec4899' }} />
                          </div>
                        </div>

                        {currentCpu !== undefined && (
                          <div style={{ marginTop: '8px', fontSize: '0.7rem', display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <Cpu size={10} /> <span>CPU Load: {currentCpu}%</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                    <Layers size={32} style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '0.8rem' }}>No HPA Configured</div>
                  </div>
                )}
              </div>
            </div>

            {/* Resource Efficiency */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={18} /> Resource Efficiency</h3>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center' }}>
                {/* CPU Efficiency */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>CPU Utilization</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#3b82f6' }}>
                      {metricsData?.pods?.length > 0 ?
                        Math.round((metricsData.pods.reduce((acc: number, p: any) =>
                          acc + (p.containers?.reduce((sum: number, c: any) =>
                            sum + parseFloat(c.usage?.cpu?.replace('n', '') || '0'), 0) || 0), 0
                        ) / 1000000) / 10) : 0}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(metricsData?.pods?.length > 0 ?
                        Math.round((metricsData.pods.reduce((acc: number, p: any) =>
                          acc + (p.containers?.reduce((sum: number, c: any) =>
                            sum + parseFloat(c.usage?.cpu?.replace('n', '') || '0'), 0) || 0), 0
                        ) / 1000000) / 10) : 0, 100)}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>

                {/* Memory Efficiency */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Memory Utilization</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#a855f7' }}>
                      {metricsData?.pods?.length > 0 ?
                        Math.round((metricsData.pods.reduce((acc: number, p: any) =>
                          acc + (p.containers?.reduce((sum: number, c: any) =>
                            sum + parseFloat(c.usage?.memory?.replace('Ki', '') || '0'), 0) || 0), 0
                        ) / 1024 / 1024) / 10) : 0}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(metricsData?.pods?.length > 0 ?
                        Math.round((metricsData.pods.reduce((acc: number, p: any) =>
                          acc + (p.containers?.reduce((sum: number, c: any) =>
                            sum + parseFloat(c.usage?.memory?.replace('Ki', '') || '0'), 0) || 0), 0
                        ) / 1024 / 1024) / 10) : 0, 100)}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #a855f7, #c084fc)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>

                {/* Pod Density */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Pod Density</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#22c55e' }}>
                      {data.nodes?.length > 0 ? Math.round((data.pods?.length || 0) / data.nodes.length) : 0} pods/node
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {data.nodes?.map((node: any, i: number) => {
                      const nodePods = data.pods?.filter((p: any) => p.spec?.nodeName === node.metadata.name).length || 0;
                      const maxPods = parseInt(node.status?.capacity?.pods || '110');
                      const pct = (nodePods / maxPods) * 100;
                      return (
                        <div key={i} style={{ flex: 1, height: '60px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            width: '100%',
                            height: `${pct}%`,
                            background: pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e',
                            transition: 'height 0.5s ease'
                          }} />
                          <div style={{ position: 'absolute', bottom: '4px', width: '100%', textAlign: 'center', fontSize: '0.6rem', fontWeight: 700 }}>
                            {nodePods}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Resource Consumers */}
            <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Server size={18} /> Top Resource Consumers</h3>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto' }}>
                {metricsData?.pods?.sort((a: any, b: any) => {
                  const aCpu = a.containers?.reduce((sum: number, c: any) => sum + parseFloat(c.usage?.cpu?.replace('n', '') || '0'), 0) || 0;
                  const bCpu = b.containers?.reduce((sum: number, c: any) => sum + parseFloat(c.usage?.cpu?.replace('n', '') || '0'), 0) || 0;
                  return bCpu - aCpu;
                }).slice(0, 5).map((pod: any, i: number) => {
                  const cpuUsage = pod.containers?.reduce((sum: number, c: any) => sum + parseFloat(c.usage?.cpu?.replace('n', '') || '0'), 0) || 0;
                  const memUsage = pod.containers?.reduce((sum: number, c: any) => sum + parseFloat(c.usage?.memory?.replace('Ki', '') || '0'), 0) || 0;
                  return (
                    <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{pod.metadata.name}</div>
                          <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{pod.metadata.namespace}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>{(cpuUsage / 1000000).toFixed(1)}m</div>
                          <div style={{ fontSize: '0.65rem', color: '#a855f7' }}>{(memUsage / 1024).toFixed(0)}Mi</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', background: 'rgba(59,130,246,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min((cpuUsage / 1000000) / 10, 100)}%`, height: '100%', background: '#3b82f6' }} />
                        </div>
                        <div style={{ flex: 1, height: '4px', background: 'rgba(168,85,247,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min((memUsage / 1024) / 10, 100)}%`, height: '100%', background: '#a855f7' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'metrics') {
      const filteredRawMetrics = (rawMetrics || []).filter((m: any) =>
        m.name.toLowerCase().includes(metricsSearch.toLowerCase()) ||
        m.help.toLowerCase().includes(metricsSearch.toLowerCase())
      );

      return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>Metrics Explorer</h2>
              <p style={{ opacity: 0.6 }}>Aggregated from {filteredRawMetrics?.length || 0} unique metrics {metricsNamespaceFilter !== 'all' ? `in ${metricsNamespaceFilter}` : 'across cluster'}</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <select
                value={metricsNamespaceFilter}
                onChange={(e) => setMetricsNamespaceFilter(e.target.value)}
                className="glass"
                style={{ padding: '0.75rem 1rem', borderRadius: '14px', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <option value="all">All Namespaces</option>
                {namespaces.map((ns: string) => <option key={ns} value={ns}>{ns}</option>)}
              </select>
              <input
                type="text"
                placeholder="Search metrics..."
                className="glass"
                value={metricsSearch}
                onChange={(e) => setMetricsSearch(e.target.value)}
                style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', border: 'none', color: '#fff', width: '300px' }}
              />
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => mutate()} className="glass" style={{ padding: '0.75rem', borderRadius: '14px', border: 'none', cursor: 'pointer', color: '#fff' }}>
                <RefreshCw size={20} className={loadingRawMetrics ? 'animate-spin' : ''} />
              </motion.button>
            </div>
          </div>

          {selectedMetricForChart && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="glass" style={{ padding: '2rem', borderRadius: '24px', marginBottom: '2rem', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                  <h4 style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.2rem' }}>{selectedMetricForChart.name}</h4>
                  <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>{selectedMetricForChart.help}</p>
                </div>
                <button onClick={() => { setSelectedMetricForChart(null); setMetricHistory([]); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px', borderRadius: '50%' }}><X size={20} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '2rem' }}>
                <div style={{ height: '250px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', padding: '1rem' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '1rem', opacity: 0.5 }}>AGGREGATED CLUSTER TREND</p>
                  <ResponsiveContainer width="100%" height="90%">
                    <AreaChart data={metricHistory}>
                      <defs>
                        <linearGradient id="colorBigPulse" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                      <Tooltip contentStyle={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="value" stroke="var(--primary)" fillOpacity={1} fill="url(#colorBigPulse)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass" style={{ padding: '1rem', borderRadius: '16px', overflow: 'auto' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 800, marginBottom: '1rem', opacity: 0.5 }}>ACTIVE SERIES BREAKDOWN ({selectedMetricForChart.values.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedMetricForChart.values.map((v: any, i: number) => (
                      <div key={i} style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{typeof v.value === 'number' ? v.value.toLocaleString() : v.value}</span>
                        </div>
                        <div style={{ opacity: 0.6, fontSize: '0.65rem', wordBreak: 'break-all' }}>
                          {Object.entries(v.labels || {}).map(([kl, vl]) => `${kl}=${vl}`).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="glass table-container" style={{ flex: 1, overflow: 'auto' }}>
            <table className="resource-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Metric Name</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Current State</th>
                </tr>
              </thead>
              <tbody>
                {filteredRawMetrics.slice(0, 1000).map((m: any) => (
                  <tr key={m.name} onClick={() => { setSelectedMetricForChart(m); setMetricHistory([]); }} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{m.name}</div>
                      {(m.values || []).length > 1 && <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>{(m.values || []).length} series</div>}
                    </td>
                    <td><span className="badge badge-blue" style={{ fontSize: '0.6rem' }}>{m.type?.toUpperCase() || 'UNTYPED'}</span></td>
                    <td style={{ fontSize: '0.75rem', opacity: 0.7, maxWidth: '300px' }}>{m.help}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(m.values || []).slice(0, 5).map((v: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.75rem' }}>
                            <div style={{ opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }} title={Object.entries(v.labels || {}).map(([kl, vl]) => `${kl}=${vl}`).join(', ')}>
                              {Object.entries(v.labels || {}).map(([kl, vl]) => `${kl}=${vl}`).join(', ') || 'default'}
                            </div>
                            <div style={{ fontWeight: 800 }}>{typeof v.value === 'number' ? v.value.toLocaleString() : v.value}</div>
                          </div>
                        ))}
                        {(m.values || []).length > 5 && <div style={{ fontSize: '0.65rem', opacity: 0.3 }}>+ {(m.values || []).length - 5} more series</div>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRawMetrics.length === 0 && !loadingRawMetrics && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>No metrics found matching "{metricsSearch}"</td></tr>
                )}
                {loadingRawMetrics && filteredRawMetrics.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw className="animate-spin" /> Fetching cluster metrics...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    if (activeTab === 'visualizer') {
      const ns = selectedNamespace === 'all' ? 'default' : selectedNamespace;
      const pods = (data.pods || []).filter((p: any) => p.metadata.namespace === ns);
      const svcs = (data.services || []).filter((s: any) => s.metadata.namespace === ns);
      const deploys = (data.deployments || []).filter((d: any) => d.metadata.namespace === ns);
      const ingresses = (data.ingresses || []).filter((i: any) => i.metadata.namespace === ns);

      // Node generation
      const nodes: any[] = [
        ...ingresses.map((i: any) => ({ ...i, type: 'Ingress', icon: Network, color: '#f59e0b' })),
        ...svcs.map((s: any) => ({ ...s, type: 'Service', icon: Network, color: '#8b5cf6' })),
        ...deploys.map((d: any) => ({ ...d, type: 'Deployment', icon: Layers, color: '#6366f1' })),
        ...pods.map((p: any) => ({ ...p, type: 'Pod', icon: Box, color: '#3b82f6' }))
      ];

      if (!localPositions) return <div style={{ padding: '4rem', textAlign: 'center' }}><Activity className="animate-spin" /> Layouting map...</div>;

      const connections: any[] = [];
      const checkLabels = (selector: any, labels: any) => {
        if (!selector || !labels) return false;
        return Object.entries(selector).every(([k, v]) => labels[k] === v);
      };

      // Edges
      ingresses.forEach((ing: any) => {
        (ing.spec?.rules || []).forEach((rule: any) => {
          (rule.http?.paths || []).forEach((path: any) => {
            const target = svcs.find((s: any) => s.metadata.name === path.backend?.service?.name);
            if (target && localPositions?.[ing.metadata.uid] && localPositions?.[target.metadata.uid]) {
              connections.push({ from: ing.metadata.uid, to: target.metadata.uid });
            }
          });
        });
      });

      svcs.forEach((svc: any) => {
        deploys.forEach((dep: any) => {
          if (checkLabels(svc.spec?.selector, dep.spec?.template?.metadata?.labels) && localPositions?.[svc.metadata.uid] && localPositions?.[dep.metadata.uid]) {
            connections.push({ from: svc.metadata.uid, to: dep.metadata.uid });
          }
        });
      });

      deploys.forEach((dep: any) => {
        pods.forEach((pod: any) => {
          if (checkLabels(dep.spec?.selector?.matchLabels, pod.metadata?.labels) && localPositions?.[dep.metadata.uid] && localPositions?.[pod.metadata.uid]) {
            connections.push({ from: dep.metadata.uid, to: pod.metadata.uid });
          }
        });
      });

      return (
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 100px)', overflow: 'hidden', position: 'relative', background: '#0a0a0a' }}>
          <div style={{ position: 'absolute', top: '2rem', left: '2rem', zIndex: 10 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>Resource Visualizer</h2>
            <p style={{ opacity: 0.6 }}>Draggable cluster topology for <b>{ns}</b></p>
          </div>

          <div style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 10 }}>
            <select
              value={selectedNamespace}
              onChange={(e) => { setSelectedNamespace(e.target.value); setLocalPositions(null); }}
              className="glass"
              style={{ padding: '0.5rem 1rem', borderRadius: '12px', border: 'none', color: '#fff' }}
            >
              <option value="all">Namespace</option>
              {namespaces.map((n: string) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              {connections.map((conn, i) => {
                const start = localPositions[conn.from];
                const end = localPositions[conn.to];
                return (
                  <motion.line
                    key={i}
                    x1={start.x + 35}
                    y1={start.y + 35}
                    x2={end.x + 35}
                    y2={end.y + 35}
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    strokeOpacity="0.3"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                  />
                );
              })}
            </svg>

            {nodes.map((node) => {
              const pos = localPositions?.[node.metadata.uid] || { x: 500, y: 400 };
              return (
                <motion.div
                  key={node.metadata.uid}
                  drag
                  dragMomentum={false}
                  onDrag={(e, info) => {
                    setLocalPositions((prev: any) => ({
                      ...prev,
                      [node.metadata.uid]: { x: prev[node.metadata.uid].x + info.delta.x, y: prev[node.metadata.uid].y + info.delta.y }
                    }));
                  }}
                  initial={{ x: pos.x, y: pos.y, scale: 0 }}
                  animate={{ x: pos.x, y: pos.y, scale: 1 }}
                  whileHover={{ scale: 1.1, zIndex: 100 }}
                  onClick={() => setShowDescribe(node)}
                  style={{
                    position: 'absolute',
                    width: '70px',
                    height: '70px',
                    borderRadius: '20px',
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${node.color}44`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'grab',
                    backdropFilter: 'blur(10px)',
                    boxShadow: `0 0 20px ${node.color}22`
                  }}
                >
                  <node.icon size={24} color={node.color} />
                  <span style={{
                    position: 'absolute',
                    bottom: '-25px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    pointerEvents: 'none'
                  }}>
                    {node.metadata.name.length > 15 ? node.metadata.name.slice(0, 12) + '...' : node.metadata.name}
                  </span>
                  {node.status?.phase === 'Running' && (
                    <div style={{ position: 'absolute', top: '-5px', right: '-5px', width: '12px', height: '12px', borderRadius: '50%', background: '#4ade80', border: '2px solid #0a0a0a' }} />
                  )}
                </motion.div>
              );
            })}
          </div>

          <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', display: 'flex', gap: '2rem', background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
            {[
              { label: 'Ingress', color: '#f59e0b' },
              { label: 'Service', color: '#8b5cf6' },
              { label: 'Deployment', color: '#6366f1' },
              { label: 'Pod', color: '#3b82f6' }
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.color }} />
                <span style={{ opacity: 0.6 }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Metrics Explorer Implementation
    if (activeTab === 'metrics') {
      const filtered = (unifiedRawMetrics || []).filter((m: any) => m.name.toLowerCase().includes(metricsExplorerSearch.toLowerCase()));

      return (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1rem', height: 'calc(100vh - 140px)' }}>
          <div className="card glass" style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', maxHeight: '100%' }}>
            <div style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '0.5rem' }}>
              <h3 className="gradient-text" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Metrics Explorer</h3>
              <input
                type="text"
                placeholder="Search metrics (e.g. apiserver)..."
                value={metricsExplorerSearch}
                onChange={e => setMetricsExplorerSearch(e.target.value)}
                className="glass"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: 'none', color: '#fff' }}
                autoFocus
              />
              <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '4px' }}>
                Showing {filtered.length} of {(unifiedRawMetrics || []).length} metrics
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtered.map((m: any) => (
                <div
                  key={m.name}
                  onClick={() => setSelectedExplorerMetric(m)}
                  style={{
                    padding: '0.5rem',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    background: selectedExplorerMetric?.name === m.name ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    borderLeft: selectedExplorerMetric?.name === m.name ? '3px solid #60a5fa' : '3px solid transparent',
                    opacity: selectedExplorerMetric?.name === m.name ? 1 : 0.7,
                    fontSize: '0.85rem',
                    marginBottom: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{m.type}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card glass" style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {selectedExplorerMetric ? (
              <div>
                <header style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 className="gradient-text" style={{ fontSize: '1.8rem', marginBottom: '0.5rem', wordBreak: 'break-all' }}>{selectedExplorerMetric.name}</h3>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.9rem', opacity: 0.8 }}>
                    <span className="badge badge-purple" style={{ textTransform: 'uppercase' }}>{selectedExplorerMetric.type || 'UNKNOWN'}</span>
                    <span>{selectedExplorerMetric.help}</span>
                  </div>
                </header>

                <h4 style={{ fontSize: '1rem', marginBottom: '1rem', opacity: 0.8 }}>Current Series ({selectedExplorerMetric.samples.length})</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem' }}>Value</th>
                        <th style={{ padding: '0.75rem' }}>Labels</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedExplorerMetric.samples.map((s: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#60a5fa', whiteSpace: 'nowrap' }}>{s.value}</td>
                          <td style={{ padding: '0.75rem', fontFamily: 'monospace', opacity: 0.8, wordBreak: 'break-all' }}>{s.labels || '{}'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <Activity size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>Select a metric from the list to view its details and current values.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    function checkLabels(selector: any, labels: any) {
      if (!selector || !labels) return false;
      return Object.entries(selector).every(([k, v]) => labels[k] === v);
    }


    return (
      <div className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', textTransform: 'capitalize' }}>{activeTab}</h2>
            <p style={{ opacity: 0.6 }}>{filteredResources.length} resources</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {activeTab === 'helmCharts' ? (
              <input
                type="text"
                placeholder="Search charts (e.g. redis, postgres)..."
                className="glass"
                value={helmSearch}
                onChange={(e) => setHelmSearch(e.target.value)}
                style={{ padding: '0.5rem 1rem', borderRadius: '12px', border: 'none', color: '#fff', width: '300px' }}
              />
            ) : activeTab !== 'namespaces' && (
              <select
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                className="glass"
                style={{ padding: '0.5rem 1rem', borderRadius: '12px', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <option value="all">All Namespaces</option>
                {namespaces.map((ns: string) => <option key={ns} value={ns}>{ns}</option>)}
              </select>
            )}
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => mutate()} className="glass" style={{ padding: '0.75rem', borderRadius: '14px', border: 'none', cursor: 'pointer', color: '#fff' }}>
              <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
            </motion.button>
          </div>
        </div>

        <div className="glass table-container">
          <table className="resource-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Name
                    {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                {['clusterRoles', 'clusterRoleBindings', 'nodes', 'pvs', 'storageClasses'].includes(activeTab) ? <th>Scope</th> : (
                  <th onClick={() => requestSort('namespace')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Namespace
                      {sortConfig?.key === 'namespace' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                )}
                {activeTab === 'pods' && (
                  <th onClick={() => requestSort('cpu')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      CPU Usage (%)
                      {sortConfig?.key === 'cpu' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                )}
                {activeTab === 'pods' && (
                  <th onClick={() => requestSort('memory')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Mem Usage (%)
                      {sortConfig?.key === 'memory' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                )}
                {activeTab === 'pods' && <th>Node</th>}
                {activeTab === 'pods' && (
                  <th onClick={() => requestSort('restarts')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Restarts
                      {sortConfig?.key === 'restarts' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                )}
                {activeTab === 'pods' && (
                  <th onClick={() => requestSort('age')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Age
                      {sortConfig?.key === 'age' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                )}
                {activeTab === 'pods' && (
                  <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Status
                      {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </div>
                  </th>
                )}
                {activeTab === 'deployments' && <th>Actions</th>}
                {activeTab === 'services' && <th>Type</th>}
                {activeTab === 'services' && <th>Cluster IP</th>}
                {activeTab === 'services' && <th>Ports</th>}
                {activeTab === 'services' && <th>External IP</th>}
                {activeTab === 'serviceAccounts' && <th>Secrets</th>}
                {activeTab === 'serviceAccounts' && <th>Image Pull Secrets</th>}
                {activeTab === 'helmReleases' && <th>Chart</th>}
                {activeTab === 'helmReleases' && <th>App Version</th>}
                {activeTab === 'helmReleases' && <th>Revision</th>}
                {activeTab === 'helmReleases' && <th>Status</th>}
                {activeTab === 'helmCharts' && <th>Version</th>}
                {activeTab === 'helmCharts' && <th>App Version</th>}
                {activeTab === 'helmCharts' && <th>Description</th>}
                {activeTab === 'hpas' && <th>Target</th>}
                {activeTab === 'hpas' && <th>Replicas</th>}
                {activeTab === 'hpas' && <th>Metrics</th>}
                <th>Events</th>
                <th>More</th>
              </tr>
            </thead>
            <tbody>
              {((sortedResources && sortedResources.length > 0) ? sortedResources : filteredResources).map((res: any) => (
                <tr key={res.metadata?.uid || res.metadata?.name}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{res.metadata?.name}</div>
                    {res.metadata?.labels && Object.keys(res.metadata.labels).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {Object.entries(res.metadata.labels).slice(0, activeTab === 'deployments' ? undefined : 3).map(([k, v]: [string, any]) => (
                          <span key={k} style={{ fontSize: '0.6rem', opacity: 0.5, background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '4px' }}>
                            {k}={v}
                          </span>
                        ))}
                        {activeTab !== 'deployments' && Object.keys(res.metadata.labels).length > 3 && <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>+...</span>}
                      </div>
                    )}
                  </td>
                  <td>
                    {['clusterRoles', 'clusterRoleBindings', 'nodes', 'pvs', 'storageClasses'].includes(activeTab) ? (
                      <span className="badge badge-blue">Cluster-wide</span>
                    ) : (
                      <span className="badge badge-purple">{res.metadata?.namespace || '-'}</span>
                    )}
                  </td>
                  {activeTab === 'pods' && (
                    <td>
                      {(() => {
                        const m = getMetricsForPod(res);
                        if (!m) return <span style={{ opacity: 0.3 }}>-</span>;
                        return (
                          <div style={{ minWidth: '100px' }}>
                            <div style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{m.cpuUsage.toFixed(1)}m</span>
                              {m.cpuPct !== null && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: m.cpuPct > 80 ? 'var(--danger)' : '#fff' }}>
                                  {m.cpuPct.toFixed(0)}%
                                </span>
                              )}
                            </div>
                            {m.cpuPct !== null && (
                              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, m.cpuPct)}%` }} style={{ height: '100%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  )}
                  {activeTab === 'pods' && (
                    <td>
                      {(() => {
                        const m = getMetricsForPod(res);
                        if (!m) return <span style={{ opacity: 0.3 }}>-</span>;
                        return (
                          <div style={{ minWidth: '100px' }}>
                            <div style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>{m.memUsage.toFixed(1)}Mi</span>
                              {m.memPct !== null && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: m.memPct > 80 ? 'var(--danger)' : '#fff' }}>
                                  {m.memPct.toFixed(0)}%
                                </span>
                              )}
                            </div>
                            {m.memPct !== null && (
                              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, m.memPct)}%` }} style={{ height: '100%', background: 'var(--secondary)', boxShadow: '0 0 10px var(--secondary)' }} />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  )}
                  {activeTab === 'pods' && (
                    <td style={{ fontSize: '0.85rem', opacity: 0.7 }}>{res.spec?.nodeName}</td>
                  )}
                  {activeTab === 'pods' && (
                    <td style={{ fontSize: '0.85rem' }}>
                      {res.status?.containerStatuses?.reduce((acc: number, s: any) => acc + s.restartCount, 0) || 0}
                    </td>
                  )}
                  {activeTab === 'pods' && (
                    <td style={{ fontSize: '0.85rem' }}>{formatUptime(res.metadata.creationTimestamp)}</td>
                  )}
                  {activeTab === 'pods' && (
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className={`status-dot ${res.status?.phase === 'Running' ? 'status-running' : 'status-failed'}`} />
                        <span style={{ fontWeight: 500 }}>{res.status?.phase || 'Unknown'}</span>
                      </div>
                    </td>
                  )}
                  {activeTab === 'deployments' && (
                    <td>
                      <button
                        onClick={() => setShowRestartModal(res)}
                        className="badge badge-blue"
                        style={{ border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <RefreshCcw size={12} className={actionLoading === `restart-${res.metadata.uid}` ? 'animate-spin' : ''} /> Restart
                      </button>
                    </td>
                  )}
                  {activeTab === 'services' && (
                    <td><span className="badge badge-purple">{res.spec?.type}</span></td>
                  )}
                  {activeTab === 'services' && (
                    <td style={{ fontSize: '0.85rem', opacity: 0.7 }}>{res.spec?.clusterIP}</td>
                  )}
                  {activeTab === 'services' && (
                    <td style={{ fontSize: '0.85rem' }}>
                      {res.spec?.ports?.map((p: any) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ''}/${p.protocol}`).join(', ')}
                    </td>
                  )}
                  {activeTab === 'services' && (
                    <td style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                      {res.status?.loadBalancer?.ingress?.[0]?.ip || res.status?.loadBalancer?.ingress?.[0]?.hostname || '-'}
                    </td>
                  )}
                  {activeTab === 'serviceAccounts' && (
                    <td>
                      <span className="badge badge-blue">{res.secrets?.length || 0} secrets</span>
                    </td>
                  )}
                  {activeTab === 'serviceAccounts' && (
                    <td>
                      <span className="badge badge-gray">{res.imagePullSecrets?.length || 0} items</span>
                    </td>
                  )}
                  {activeTab === 'helmReleases' && (
                    <td style={{ fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600 }}>{res.chart}</div>
                    </td>
                  )}
                  {activeTab === 'helmReleases' && (
                    <td style={{ fontSize: '0.85rem', opacity: 0.7 }}>{res.app_version}</td>
                  )}
                  {activeTab === 'helmReleases' && (
                    <td style={{ fontSize: '0.85rem' }}>
                      <span className="badge badge-purple">Rev {res.revision}</span>
                    </td>
                  )}
                  {activeTab === 'helmReleases' && (
                    <td>
                      <span className={`badge ${res.status === 'deployed' ? 'badge-success' : 'badge-danger'}`}>
                        {res.status}
                      </span>
                    </td>
                  )}
                  {activeTab === 'helmCharts' && (
                    <td style={{ fontSize: '0.85rem' }}>
                      <span className="badge badge-blue">{res.version}</span>
                    </td>
                  )}
                  {activeTab === 'helmCharts' && (
                    <td style={{ fontSize: '0.85rem', opacity: 0.7 }}>{res.app_version}</td>
                  )}
                  {activeTab === 'helmCharts' && (
                    <td style={{ fontSize: '0.85rem', opacity: 0.6, maxWidth: '400px' }} title={res.description}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {res.description}
                      </div>
                    </td>
                  )}
                  {activeTab === 'hpas' && (
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-blue">{res.spec?.scaleTargetRef?.kind}: <b style={{ fontWeight: 800 }}>{res.spec?.scaleTargetRef?.name}</b></span>
                      </div>
                    </td>
                  )}
                  {activeTab === 'hpas' && (
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{res.status?.currentReplicas || 0} / {res.spec?.maxReplicas} replicas</div>
                        <div style={{ opacity: 0.5, fontSize: '0.65rem' }}>Min: {res.spec?.minReplicas || 1}</div>
                      </div>
                    </td>
                  )}
                  {activeTab === 'hpas' && (
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {res.status?.currentMetrics?.slice(0, 2).map((m: any, idx: number) => (
                          <div key={idx} style={{ fontSize: '0.7rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span className="badge badge-gray">{m.type === 'Resource' ? m.resource?.name : m.type}</span>
                            <span style={{ fontWeight: 800, color: '#ec4899' }}>{m.resource?.current?.averageUtilization || 0}%</span>
                          </div>
                        ))}
                        {(!res.status?.currentMetrics || res.status?.currentMetrics.length === 0) && <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>-</span>}
                      </div>
                    </td>
                  )}
                  <td>
                    {(() => {
                      const evts = getAllEvents(res);
                      if (evts.length === 0) return <span style={{ opacity: 0.3, fontSize: '0.75rem' }}>No events</span>;
                      const latest = evts[0];
                      const isWarning = latest.type === 'Warning';
                      return (
                        <div
                          onClick={() => setShowEvents(res)}
                          style={{ fontSize: '0.75rem', opacity: 0.8, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                        >
                          <span className={isWarning ? 'text-red-400' : ''}>{latest.reason}</span>
                          <span style={{ opacity: 0.5, fontSize: '0.65rem' }}>{Math.floor((Date.now() - new Date(latest.lastTimestamp).getTime()) / 60000)}m ago</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {activeTab === 'pods' && (
                        <button onClick={() => setShowPodMetrics(res)} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', color: 'var(--accent)' }} title="Pod Monitoring"><Activity size={14} /></button>
                      )}
                      {activeTab === 'pods' && (
                        <button onClick={() => setShowLogs(res)} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', color: '#fff' }}><Terminal size={14} /></button>
                      )}
                      <button onClick={() => setShowYaml(res)} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', color: 'var(--success)' }}><FileCode size={14} /></button>
                      <button onClick={() => setShowDescribe(res)} className="glass" style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', color: '#fff' }}><Eye size={14} /></button>
                      <button
                        onClick={() => confirm(`Delete ${res.metadata.name}?`) && performAction('delete', res)}
                        className="glass"
                        style={{ padding: '0.4rem', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} className={actionLoading === `delete-${res.metadata.uid}` ? 'animate-spin' : ''} />
                      </button>
                      {activeTab === 'helmCharts' && (
                        <button
                          onClick={() => handleInstall(res)}
                          className="badge badge-success"
                          style={{ border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Plus size={12} className={actionLoading === `install-${res.metadata.uid}` ? 'animate-spin' : ''} /> Install
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <main style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar active={activeTab} setActive={setActiveTab} />
      <div className="main-content" style={{ flex: 1, transition: 'margin-right 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── Floating AI Agent Toggle Button ─── */}
      <motion.button
        id="ai-agent-toggle"
        className={`agent-float-btn ${showAgentPanel ? 'active' : ''}`}
        onClick={() => setShowAgentPanel((v) => !v)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Open K8s AI Agent"
        aria-label="Toggle K8s AI Agent panel"
      >
        <Bot size={22} color="#fff" />
      </motion.button>

      {/* ─── AI Agent Panel ─── */}
      <AgentPanel
        isOpen={showAgentPanel}
        onClose={() => setShowAgentPanel(false)}
        currentContext={data?.currentContext}
        currentNamespace={selectedNamespace}
        clusterData={data}
      />

      <AnimatePresence>
        {showRestartModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass" style={{ width: '450px', borderRadius: '24px', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontWeight: 800 }}>Restart Strategy</h3>
                <button onClick={() => setShowRestartModal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X /></button>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>Select the rollout strategy for <b>{showRestartModal.metadata.name}</b></p>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {[
                    { id: 'RollingUpdate', label: 'Rolling Update', desc: 'Gradually replace old pods (No downtime)' },
                    { id: 'canary', label: 'Canary (Simulation)', desc: 'Rolls out 1 pod at a time slowly' },
                    { id: 'Recreate', label: 'Recreate', desc: 'Kill all old pods before starting new ones' }
                  ].map((s) => (
                    <motion.div
                      key={s.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        const options = s.id === 'RollingUpdate' ? { maxSurge: '25%', maxUnavailable: '25%' } : {};
                        performAction('restart', showRestartModal, s.id, options);
                        setShowRestartModal(null);
                      }}
                      style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '2px' }}>{s.label}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{s.desc}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showYaml && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass" style={{ width: '70%', maxHeight: '85%', display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileCode color="var(--success)" />
                  <h3 style={{ fontWeight: 800 }}>YAML: {showYaml.metadata.name}</h3>
                </div>
                <button onClick={() => setShowYaml(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#0d0d0f' }}>
                <pre style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#e2e8f0', lineHeight: 1.6 }}>
                  {yaml.dump(showYaml)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogs && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass" style={{ width: '80%', maxHeight: '80%', display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between' }}>
                <h3>Logs: {showLogs.metadata.name}</h3>
                <button onClick={() => setShowLogs(null)} style={{ background: 'none', border: 'none', color: '#fff' }}><X /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#000', color: '#22c55e', fontFamily: 'monospace' }}>{loadingLogs ? 'Loading...' : logData}</div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDescribe && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass" style={{ width: '60%', maxHeight: '80%', display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between' }}>
                <h3>Details: {showDescribe.metadata.name}</h3>
                <button onClick={() => setShowDescribe(null)} style={{ background: 'none', border: 'none', color: '#fff' }}><X /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <pre style={{ fontSize: '0.8rem', opacity: 0.7 }}>{JSON.stringify(showDescribe, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEvents && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass" style={{ width: '700px', maxHeight: '80%', display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Activity color="var(--accent)" />
                  <h3 style={{ fontWeight: 800 }}>Event History: {showEvents.metadata.name}</h3>
                </div>
                <button onClick={() => setShowEvents(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                {getAllEvents(showEvents).length === 0 ? (
                  <div style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>No events recorded for this resource.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {getAllEvents(showEvents).map((evt: any, i: number) => (
                      <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span className={`badge ${evt.type === 'Warning' ? 'badge-red' : 'badge-green'}`} style={{ fontSize: '0.65rem' }}>
                            {evt.type}
                          </span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>
                            {evt.lastTimestamp || evt.eventTime ? new Date(evt.lastTimestamp || evt.eventTime).toLocaleString() : 'Recent'}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: evt.type === 'Warning' ? 'var(--danger)' : '#fff' }}>{evt.reason}</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, lineHeight: 1.4 }}>{evt.message}</div>
                        <div style={{ marginTop: '8px', fontSize: '0.7rem', opacity: 0.4, display: 'flex', gap: '1rem' }}>
                          <span><b>Source:</b> {evt.source?.component || 'Unknown'}</span>
                          <span><b>Count:</b> {evt.count || 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPodMetrics && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass" style={{ width: '80%', height: '80%', display: 'flex', flexDirection: 'column', borderRadius: '24px', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ padding: '10px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '12px' }}>
                    <Activity color="var(--accent)" size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Monitoring: {showPodMetrics.metadata.name}</h3>
                    <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>Deep telemetry & resource utilization</p>
                  </div>
                </div>
                <button onClick={() => setShowPodMetrics(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X /></button>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Real-time Usage Gauges */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {(() => {
                    const m = getMetricsForPod(showPodMetrics);
                    return (
                      <>
                        <div className="glass" style={{ padding: '1.5rem', borderRadius: '20px', background: 'rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ fontWeight: 700, opacity: 0.7 }}>CPU Utilization</span>
                            <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{m?.cpuUsage.toFixed(1) || 0}m</span>
                          </div>
                          <div style={{ height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${m?.cpuPct || 0}%` }} style={{ height: '100%', background: 'var(--accent)', boxShadow: '0 0 15px var(--accent)' }} />
                          </div>
                          <div style={{ marginTop: '0.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700 }}>{m?.cpuPct?.toFixed(1) || 0}%</div>
                        </div>

                        <div className="glass" style={{ padding: '1.5rem', borderRadius: '20px', background: 'rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ fontWeight: 700, opacity: 0.7 }}>Memory Utilization</span>
                            <span style={{ fontWeight: 800, color: 'var(--secondary)' }}>{m?.memUsage.toFixed(1) || 0}Mi</span>
                          </div>
                          <div style={{ height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${m?.memPct || 0}%` }} style={{ height: '100%', background: 'var(--secondary)', boxShadow: '0 0 15px var(--secondary)' }} />
                          </div>
                          <div style={{ marginTop: '0.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700 }}>{m?.memPct?.toFixed(1) || 0}%</div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Related Raw Metrics */}
                <div>
                  <h4 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} /> Related Cluster Telemetry
                  </h4>
                  <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <table className="resource-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                      <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <tr>
                          <th>Metric</th>
                          <th>Labels</th>
                          <th style={{ textAlign: 'right' }}>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const podName = showPodMetrics.metadata.name;
                          const related: any[] = [];
                          (rawMetrics || []).forEach((m: any) => {
                            m.values.forEach((v: any) => {
                              const hasPod = Object.values(v.labels || {}).some((l: any) => String(l).includes(podName));
                              if (hasPod) {
                                related.push({ name: m.name, labels: v.labels, value: v.value });
                              }
                            });
                          });

                          if (related.length === 0) return <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No specific cluster metrics found for this pod.</td></tr>;

                          return related.slice(0, 50).map((r, i) => (
                            <tr key={i}>
                              <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{r.name}</td>
                              <td style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                {Object.entries(r.labels || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800 }}>{typeof r.value === 'number' ? r.value.toLocaleString() : r.value}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {showInstallModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="glass" style={{ width: '500px', borderRadius: '24px', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontWeight: 800 }}>Deploy Chart</h3>
                <button onClick={() => setShowInstallModal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X /></button>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '16px' }}>
                  <ShipWheel size={32} color="var(--primary)" />
                  <div>
                    <div style={{ fontWeight: 800 }}>{showInstallModal.name}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>v{showInstallModal.version}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.5 }}>RELEASE NAME</label>
                    <input
                      type="text"
                      className="glass"
                      value={installConfig.releaseName}
                      onChange={(e) => setInstallConfig({ ...installConfig, releaseName: e.target.value })}
                      style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: 'none', color: '#fff' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.5 }}>NAMESPACE</label>
                      <button
                        onClick={() => setInstallConfig({ ...installConfig, isNew: !installConfig.isNew })}
                        style={{ fontSize: '0.7rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700 }}
                      >
                        {installConfig.isNew ? 'Select Existing' : '+ Create New'}
                      </button>
                    </div>
                    {installConfig.isNew ? (
                      <input
                        type="text"
                        placeholder="new-namespace"
                        className="glass"
                        value={installConfig.namespace}
                        onChange={(e) => setInstallConfig({ ...installConfig, namespace: e.target.value })}
                        style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: 'none', color: '#fff' }}
                      />
                    ) : (
                      <select
                        className="glass"
                        value={installConfig.namespace}
                        onChange={(e) => setInstallConfig({ ...installConfig, namespace: e.target.value })}
                        style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: 'none', color: '#fff' }}
                      >
                        {namespaces.map((ns: string) => <option key={ns} value={ns}>{ns}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    performAction('install', showInstallModal, undefined, {
                      releaseName: installConfig.releaseName,
                      targetNamespace: installConfig.namespace
                    });
                    setShowInstallModal(null);
                  }}
                  className="badge badge-success"
                  style={{ padding: '1rem', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 800 }}
                >
                  <Plus size={20} /> Deploy Application
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
