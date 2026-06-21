'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, X, Send, ChevronDown, Loader2, AlertTriangle,
  CheckCircle, Zap, Shield, Activity, Search, RefreshCw,
  Copy, Check, Minimize2, Maximize2, Cpu, Terminal,
} from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

interface ModelInfo {
  id: string;
  label: string;
  configured: boolean;
}

interface AgentPanelProps {
  currentContext?: string;
  currentNamespace?: string;
  clusterData?: any;
  onClose: () => void;
  isOpen: boolean;
}

const QUICK_ACTIONS = [
  { icon: AlertTriangle, label: 'Pod Errors', prompt: 'Analyze all pods for errors, failures, and CrashLoopBackOff conditions. List each issue with a fix.', color: '#ef4444' },
  { icon: RefreshCw, label: 'Restart Loops', prompt: 'Find all pods in CrashLoopBackOff or with high restart counts. Explain the likely causes and provide kubectl commands to investigate and fix each.', color: '#f59e0b' },
  { icon: Cpu, label: 'Resource Usage', prompt: 'Analyze current cluster resource utilization. Identify any pods using excessive CPU or memory, and suggest optimization strategies.', color: '#3b82f6' },
  { icon: Shield, label: 'Security Scan', prompt: 'Perform a security analysis of this cluster. Check for: privileged containers, missing resource limits, exposed secrets, overly permissive RBAC roles, and pods running as root. List all findings with severity and remediation steps.', color: '#8b5cf6' },
  { icon: Activity, label: 'Event Summary', prompt: 'Summarize the most important recent warning events in this cluster. Group by severity and suggest which ones need immediate attention.', color: '#22c55e' },
  { icon: Search, label: 'Health Check', prompt: 'Perform a complete cluster health check. Assess: node readiness, pod stability, pending workloads, storage issues, and network policies. Give an overall health score out of 10 with reasoning.', color: '#06b6d4' },
];

// Lightweight markdown renderer — avoids extra deps
function renderMarkdown(text: string): string {
  return text
    // Code blocks with language
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      const l = lang || 'bash';
      return `<pre class="agent-code-block" data-lang="${l}"><div class="code-lang-tag">${l}</div><code>${escapeHtml(code.trim())}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="agent-inline-code">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 class="agent-h4">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="agent-h3">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="agent-h2">$1</h2>')
    // Bullet lists
    .replace(/^- (.+)$/gm, '<li class="agent-li">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="agent-ul">$&</ul>')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="agent-p">')
    .replace(/\n/g, '<br>');
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function MessageBubble({ message, onCopy }: { message: Message; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: '10px',
        alignItems: 'flex-start',
        marginBottom: '1rem',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: isUser
          ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
          : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: isUser
          ? '0 0 12px rgba(59,130,246,0.4)'
          : '0 0 12px rgba(139,92,246,0.4)',
      }}>
        {isUser ? (
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#fff' }}>YOU</span>
        ) : (
          <Bot size={16} color="#fff" />
        )}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '85%',
        position: 'relative',
      }}>
        <div style={{
          background: isUser
            ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.15))'
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isUser ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          padding: '0.75rem 1rem',
          fontSize: '0.875rem',
          lineHeight: 1.6,
          color: '#e2e8f0',
          backdropFilter: 'blur(8px)',
        }}>
          {isUser ? (
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
          ) : (
            <div
              className="agent-message-content"
              dangerouslySetInnerHTML={{
                __html: `<p class="agent-p">${renderMarkdown(message.content)}</p>`,
              }}
            />
          )}
          {message.streaming && (
            <span className="agent-cursor" />
          )}
        </div>

        {/* Actions row */}
        <div style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          alignItems: 'center',
          gap: '8px',
          marginTop: '4px',
          paddingLeft: '4px',
        }}>
          <span style={{ fontSize: '0.65rem', opacity: 0.35 }}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!message.streaming && (
            <button
              onClick={handleCopy}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: copied ? '#22c55e' : 'rgba(255,255,255,0.3)',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.2s',
              }}
              title="Copy message"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function AgentPanel({ currentContext, currentNamespace, clusterData, onClose, isOpen }: AgentPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: modelsData, mutate: mutateModels } = useSWR<{ models: ModelInfo[] }>('/api/agent/models', fetcher);

  const models = modelsData?.models || [];
  const selectedModelInfo = models.find((m) => m.id === selectedModel);

  // Refresh models list whenever the panel is opened
  useEffect(() => {
    if (isOpen) {
      mutateModels();
    }
  }, [isOpen, mutateModels]);

  // Auto-select first configured model
  useEffect(() => {
    if (models.length > 0) {
      const configured = models.find((m) => m.configured);
      // Auto-select first configured model, or update selection if current is unconfigured/not in list
      if (!selectedModel || !models.some(m => m.id === selectedModel)) {
        setSelectedModel(configured?.id || models[0].id);
      }
    }
  }, [models, selectedModel]);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `👋 **Welcome to the K8s AI Agent!**

I'm your embedded SRE assistant with live access to your cluster \`${currentContext || 'connected cluster'}\`.

I can help you:
- 🔍 **Diagnose** pod failures, crashes, and resource issues
- 🛡️ **Audit** security posture and RBAC misconfigurations
- 📊 **Analyze** resource usage and performance
- 🔧 **Provide** exact kubectl commands and YAML fixes
- 📋 **Summarize** cluster events and warnings

Use the quick-action chips below, or ask me anything about your cluster.`,
        timestamp: new Date(),
      }]);
    }
  }, [isOpen, currentContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(console.error);
  }, []);

  const sendMessage = async (userText?: string) => {
    const text = (userText || input).trim();
    if (!text || isStreaming) return;

    if (!userText) setInput('');

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const historyMessages = [...messages, userMsg]
        .filter((m) => m.role !== 'system' && m.id !== 'welcome')
        .slice(-20) // Keep last 20 messages for context
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: historyMessages,
          clusterSummary: {
            contextName: currentContext,
            namespace: currentNamespace,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Request failed: ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulated += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: accumulated }
                      : m
                  )
                );
              }
            } catch {
              // Skip
            }
          }
        }
      }

      // Finalize — remove streaming flag
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, streaming: false }
            : m
        )
      );
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: m.content + '\n\n*[Response interrupted]*', streaming: false }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `❌ **Error:** ${e.message}\n\nPlease ensure your model is configured in \`agent_models.json\` and the API endpoint is reachable.`,
                  streaming: false,
                }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const clearConversation = () => {
    setMessages([]);
    setTimeout(() => {
      setMessages([{
        id: 'welcome-reset',
        role: 'assistant',
        content: `🔄 Conversation cleared. Ready to assist with your cluster \`${currentContext || 'connected cluster'}\`.`,
        timestamp: new Date(),
      }]);
    }, 100);
  };

  const podCount = clusterData?.pods?.length || 0;
  const runningCount = clusterData?.pods?.filter((p: any) => p.status?.phase === 'Running').length || 0;
  const failedCount = clusterData?.pods?.filter((p: any) => p.status?.phase === 'Failed').length || 0;
  const nodeCount = clusterData?.nodes?.length || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop blur overlay (subtle) */}
          <motion.div
            key="agent-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 49,
              background: 'rgba(0,0,0,0.2)',
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Agent Panel */}
          <motion.aside
            key="agent-panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 35 }}
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: minimized ? '60px' : '440px',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(10,10,14,0.95)',
              borderLeft: '1px solid rgba(139,92,246,0.2)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '-8px 0 48px rgba(0,0,0,0.6), -1px 0 0 rgba(139,92,246,0.15)',
              transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
              overflow: 'hidden',
            }}
          >
            {/* ─── HEADER ─────────────────────────────────────────── */}
            <div style={{
              padding: minimized ? '1rem 0' : '1rem 1.25rem',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, transparent 100%)',
              flexShrink: 0,
            }}>
              {minimized ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setMinimized(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b5cf6' }}>
                    <Bot size={22} />
                  </button>
                  {isStreaming && (
                    <div className="agent-thinking-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 16px rgba(124,58,237,0.5)',
                    }}>
                      <Bot size={20} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        K8s AI Agent
                        <span style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: isStreaming ? '#f59e0b' : '#22c55e',
                          boxShadow: `0 0 6px ${isStreaming ? '#f59e0b' : '#22c55e'}`,
                          display: 'inline-block',
                          animation: isStreaming ? 'agentPulse 1s infinite' : 'none',
                        }} />
                      </div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.45, marginTop: '1px' }}>
                        {isStreaming ? 'Analyzing cluster...' : 'Ready'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={clearConversation}
                      title="Clear conversation"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '4px', borderRadius: '6px', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => setMinimized(true)}
                      title="Minimize"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '4px', borderRadius: '6px', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                    >
                      <Minimize2 size={14} />
                    </button>
                    <button
                      onClick={onClose}
                      title="Close agent"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '4px', borderRadius: '6px', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!minimized && (
              <>
                {/* ─── MODEL SELECTOR ─────────────────────────────── */}
                <div style={{
                  padding: '0.75rem 1.25rem',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  flexShrink: 0,
                }}>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(139,92,246,0.2)',
                        borderRadius: '10px',
                        padding: '0.5rem 0.75rem',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: selectedModelInfo?.configured ? '#22c55e' : '#f59e0b',
                          boxShadow: `0 0 5px ${selectedModelInfo?.configured ? '#22c55e' : '#f59e0b'}`,
                        }} />
                        <span style={{ fontWeight: 600 }}>
                          {selectedModelInfo?.label || 'Select Model'}
                        </span>
                        {!selectedModelInfo?.configured && (
                          <span style={{ fontSize: '0.65rem', color: '#f59e0b', opacity: 0.8 }}>not configured</span>
                        )}
                      </div>
                      <ChevronDown size={13} style={{ opacity: 0.5, transform: modelDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>

                    <AnimatePresence>
                      {modelDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            right: 0,
                            background: 'rgba(15,15,20,0.98)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            zIndex: 100,
                            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                          }}
                        >
                          {models.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                setSelectedModel(m.id);
                                setModelDropdownOpen(false);
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.65rem 0.85rem',
                                background: m.id === selectedModel ? 'rgba(139,92,246,0.12)' : 'transparent',
                                border: 'none',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                color: m.id === selectedModel ? '#a78bfa' : '#cbd5e1',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                textAlign: 'left',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => { if (m.id !== selectedModel) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                              onMouseLeave={(e) => { if (m.id !== selectedModel) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <span style={{ fontWeight: 600 }}>{m.label}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {m.configured ? (
                                  <span style={{ fontSize: '0.65rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <CheckCircle size={10} /> Ready
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.65rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <AlertTriangle size={10} /> Setup needed
                                  </span>
                                )}
                                {m.id === selectedModel && (
                                  <Check size={12} color="#8b5cf6" />
                                )}
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* ─── CLUSTER CONTEXT CARD ───────────────────────── */}
                <div style={{
                  margin: '0.75rem 1.25rem 0',
                  padding: '0.75rem 1rem',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(99,102,241,0.05))',
                  border: '1px solid rgba(59,130,246,0.15)',
                  borderRadius: '12px',
                  flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Active Cluster Context
                    </span>
                    <Terminal size={12} style={{ opacity: 0.4 }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#93c5fd', marginBottom: '0.5rem', fontFamily: 'monospace' }}>
                    {currentContext || 'No cluster connected'}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Pods', value: podCount, color: '#3b82f6' },
                      { label: 'Running', value: runningCount, color: '#22c55e' },
                      { label: 'Failed', value: failedCount, color: '#ef4444' },
                      { label: 'Nodes', value: nodeCount, color: '#a78bfa' },
                    ].map((stat) => (
                      <div key={stat.label} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.45, marginTop: '1px' }}>{stat.label}</div>
                      </div>
                    ))}
                    {currentNamespace && currentNamespace !== 'all' && (
                      <div style={{
                        marginLeft: 'auto',
                        background: 'rgba(139,92,246,0.12)',
                        border: '1px solid rgba(139,92,246,0.2)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        fontSize: '0.65rem',
                        color: '#a78bfa',
                        fontFamily: 'monospace',
                        display: 'flex',
                        alignItems: 'center',
                      }}>
                        ns:{currentNamespace}
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── MESSAGES ───────────────────────────────────── */}
                <div
                  onClick={() => setModelDropdownOpen(false)}
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} onCopy={copyToClipboard} />
                  ))}

                  {/* Typing indicator when streaming but no content yet */}
                  {isStreaming && messages[messages.length - 1]?.content === '' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Bot size={16} color="#fff" />
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '4px 18px 18px 18px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        gap: '4px',
                        alignItems: 'center',
                      }}>
                        <span className="agent-typing-dot" style={{ animationDelay: '0ms' }} />
                        <span className="agent-typing-dot" style={{ animationDelay: '150ms' }} />
                        <span className="agent-typing-dot" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* ─── QUICK ACTIONS ──────────────────────────────── */}
                <div style={{
                  padding: '0.5rem 1.25rem',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  flexShrink: 0,
                  overflowX: 'auto',
                }}>
                  <div style={{ fontSize: '0.6rem', opacity: 0.35, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                    Quick Actions
                  </div>
                  <div style={{ display: 'flex', gap: '6px', paddingBottom: '4px' }}>
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => sendMessage(action.prompt)}
                        disabled={isStreaming}
                        style={{
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 10px',
                          background: `${action.color}12`,
                          border: `1px solid ${action.color}25`,
                          borderRadius: '20px',
                          color: action.color,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: isStreaming ? 'not-allowed' : 'pointer',
                          opacity: isStreaming ? 0.4 : 1,
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                          if (!isStreaming) {
                            e.currentTarget.style.background = `${action.color}22`;
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `${action.color}12`;
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <action.icon size={10} />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ─── INPUT ──────────────────────────────────────── */}
                <div style={{
                  padding: '0.75rem 1.25rem 1rem',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  flexShrink: 0,
                  background: 'rgba(0,0,0,0.2)',
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-end',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isStreaming ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '14px',
                    padding: '0.6rem 0.75rem',
                    transition: 'border-color 0.2s',
                  }}>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about your cluster... (Enter to send, Shift+Enter for newline)"
                      disabled={isStreaming}
                      rows={1}
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        outline: 'none',
                        color: '#e2e8f0',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        resize: 'none',
                        maxHeight: '100px',
                        overflowY: 'auto',
                        opacity: isStreaming ? 0.5 : 1,
                        fontFamily: 'inherit',
                      }}
                      onInput={(e) => {
                        const t = e.currentTarget;
                        t.style.height = 'auto';
                        t.style.height = Math.min(t.scrollHeight, 100) + 'px';
                      }}
                    />
                    {isStreaming ? (
                      <button
                        onClick={handleStop}
                        style={{
                          background: 'rgba(239,68,68,0.15)',
                          border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        <Loader2 size={12} className="animate-spin" />
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => sendMessage()}
                        disabled={!input.trim()}
                        style={{
                          background: input.trim()
                            ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
                            : 'rgba(255,255,255,0.05)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          color: input.trim() ? '#fff' : 'rgba(255,255,255,0.2)',
                          cursor: input.trim() ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s',
                          boxShadow: input.trim() ? '0 0 12px rgba(124,58,237,0.4)' : 'none',
                        }}
                      >
                        <Send size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.6rem', opacity: 0.25, marginTop: '6px' }}>
                    Powered by Azure AI Foundry · {selectedModelInfo?.label || 'No model selected'}
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
