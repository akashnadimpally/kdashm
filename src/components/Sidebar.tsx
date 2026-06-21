'use client';
import { useState } from 'react';
import { LayoutDashboard, Box, Layers, Shield, Settings, Server, Network, Database, Cpu, Activity, Zap, Clock, Key, Plus, X, TrendingUp, Terminal, FileCode, Eye, Trash2, RefreshCcw, User, ShipWheel, Store, GitBranch } from 'lucide-react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { id: 'all', label: 'Overview', icon: LayoutDashboard },
  { id: 'visualizer', label: 'Resource Map', icon: GitBranch },
  { id: 'namespaces', label: 'Namespaces', icon: Box },
  { id: 'pods', label: 'Pods', icon: Box },
  { id: 'deployments', label: 'Deployments', icon: Layers },
  { id: 'replicaSets', label: 'ReplicaSets', icon: Layers },
  { id: 'daemonSets', label: 'DaemonSets', icon: Layers },
  { id: 'statefulSets', label: 'StatefulSets', icon: Layers },
  { id: 'services', label: 'Services', icon: Network },
  { id: 'ingresses', label: 'Ingresses', icon: Network },
  { id: 'configMaps', label: 'ConfigMaps', icon: Settings },
  { id: 'secrets', label: 'Secrets', icon: Shield },
  { id: 'jobs', label: 'Jobs', icon: Zap },
  { id: 'cronJobs', label: 'CronJobs', icon: Clock },
  { id: 'hpas', label: 'HPA Autoscaling', icon: TrendingUp },
  { id: 'roles', label: 'Roles', icon: Key },
  { id: 'clusterRoles', label: 'Cluster Roles', icon: Key },
  { id: 'roleBindings', label: 'Role Bindings', icon: Key },
  { id: 'clusterRoleBindings', label: 'Cluster Role Bindings', icon: Key },
  { id: 'serviceAccounts', label: 'Service Accounts', icon: User },
  { id: 'pvcs', label: 'PVCs', icon: Database },
  { id: 'pvs', label: 'PVs', icon: Database },
  { id: 'storageClasses', label: 'Storage Classes', icon: Database },
  { id: 'serviceMesh', label: 'Service Mesh', icon: Network },
  { id: 'helmReleases', label: 'Helm Releases', icon: ShipWheel },
  { id: 'helmCharts', label: 'App Catalog', icon: Store },
  { id: 'nodes', label: 'Nodes', icon: Server },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'metrics', label: 'Metrics', icon: Activity },
  { id: 'crds', label: 'CRDs', icon: Cpu },
  { id: 'networkPolicies', label: 'Net Policies', icon: Activity },
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function Sidebar({ active, setActive }: { active: string, setActive: (id: string) => void }) {
  const [showAddCluster, setShowAddCluster] = useState(false);
  const [kubeconfig, setKubeconfig] = useState('');
  const { data: contextData, mutate: mutateContext } = useSWR('/api/contexts', fetcher);

  const switchContext = async (name: string) => {
    await fetch('/api/contexts', {
      method: 'POST',
      body: JSON.stringify({ context: name }),
      headers: { 'Content-Type': 'application/json' }
    });
    mutateContext();
    window.location.reload();
  };

  const handleAddCloudCluster = async () => {
    await fetch('/api/contexts', {
      method: 'POST',
      body: JSON.stringify({ kubeconfig }),
      headers: { 'Content-Type': 'application/json' }
    });
    setKubeconfig('');
    setShowAddCluster(false);
    mutateContext();
    window.location.reload();
  };

  return (
    <aside className="sidebar glass" style={{ overflowY: 'auto' }}>
      <div className="logo-section">
        <h1 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>kDashM</h1>
        <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Cloud Native IDE</p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <p style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase' }}>Active Cluster</p>
          <button onClick={() => setShowAddCluster(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
            <Plus size={14} />
          </button>
        </div>
        <select
          value={contextData?.currentContext || ''}
          onChange={(e) => switchContext(e.target.value)}
          className="glass"
          style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          {contextData?.contexts?.map((ctx: any) => (
            <option key={ctx.name} value={ctx.name} style={{ background: '#1e1e23' }}>
              {ctx.name.length > 20 ? ctx.name.substring(0, 17) + '...' : ctx.name}
            </option>
          ))}
        </select>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={`nav-item ${active === item.id ? 'active' : ''}`}
            style={{ border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <item.icon size={18} />
            <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User Session Profile Card */}
      <UserSessionProfile />

      <AnimatePresence>
        {showAddCluster && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass" style={{ width: '400px', padding: '1.5rem', borderRadius: '20px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: '800' }}>Add Cloud Cluster</h3>
                <button onClick={() => setShowAddCluster(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem' }}>Paste your Kubeconfig snippet (AKS/EKS/GKE) to connect.</p>
              <textarea
                value={kubeconfig}
                onChange={(e) => setKubeconfig(e.target.value)}
                placeholder="apiVersion: v1..."
                style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: '#fff', padding: '0.75rem', fontSize: '0.8rem', fontFamily: 'monospace', marginBottom: '1rem' }}
              />
              <button
                onClick={handleAddCloudCluster}
                className="glass"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Connect Cluster
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

// User Session helper component
import { LogOut } from 'lucide-react';

function UserSessionProfile() {
  const { data: userData } = useSWR('/api/auth/me', fetcher);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout error:', err);
      setLoggingOut(false);
    }
  };

  if (!userData?.authenticated) return null;

  return (
    <div 
      className="glass"
      style={{ 
        marginTop: 'auto', 
        padding: '0.75rem 1rem', 
        borderRadius: '12px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', opacity: 0.4, fontWeight: 'bold', textTransform: 'uppercase' }}>Session User</span>
          <span 
            className="badge" 
            style={{ 
              fontSize: '0.65rem', 
              padding: '1px 6px',
              background: userData.role === 'admin' ? 'rgba(59, 130, 246, 0.2)' : userData.role === 'contributor' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(148, 163, 184, 0.2)',
              color: userData.role === 'admin' ? '#60a5fa' : userData.role === 'contributor' ? '#a78bfa' : '#cbd5e1',
              borderRadius: '9999px',
              fontWeight: 'bold',
              textTransform: 'capitalize'
            }}
          >
            {userData.role}
          </span>
        </div>
        <span 
          style={{ 
            fontSize: '0.85rem', 
            color: '#cbd5e1', 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            maxWidth: '150px'
          }} 
          title={userData.email}
        >
          {userData.email}
        </span>
      </div>
      <button 
        onClick={handleLogout}
        disabled={loggingOut}
        style={{ 
          background: 'none', 
          border: 'none', 
          color: '#f87171', 
          cursor: 'pointer',
          padding: '6px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        title="Sign Out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
