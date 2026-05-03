import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OpsAgentWidget() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: 'ai', content: 'Hello! I am your embedded Ops Agent. I have access to your AKS and Docker Desktop clusters. How can I help?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toolsRunning, setToolsRunning] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolsRunning]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          sessionId: 'kdashm-session' 
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.toolsExecuted && data.toolsExecuted.length > 0) {
        setToolsRunning(data.toolsExecuted);
      }

      setMessages(prev => [...prev, { role: 'ai', content: data.content }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `Error connecting to agent: ${err.message}` }]);
    } finally {
      setLoading(false);
      setToolsRunning([]);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass"
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        width: '100%',
        background: 'linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.9) 100%)', 
        color: '#f8fafc', 
        borderRadius: '24px', 
        overflow: 'hidden', 
        border: '1px solid rgba(255,255,255,0.1)' 
      }}
    >
      <div style={{ padding: '24px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '10px', borderRadius: '12px' }}>
          <Terminal size={24} color="#3b82f6" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>K8s AI Agent</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Connected to local OpsAgent API (AKS / Docker Desktop)</p>
        </div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{ 
              padding: '16px 20px', 
              borderRadius: '16px', 
              background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', 
              border: msg.role === 'ai' ? '1px solid rgba(255,255,255,0.1)' : 'none',
              fontSize: '15px', 
              lineHeight: '1.6',
              borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
              borderBottomLeftRadius: msg.role === 'ai' ? '4px' : '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {toolsRunning.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ alignSelf: 'flex-start', fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}
          >
            <Activity size={16} className="animate-spin" /> Executing {toolsRunning.length} command(s)...
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} style={{ padding: '24px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px' }}>
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask me to scale deployments, read pod logs, or diagnose issues..."
          disabled={loading}
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '16px 20px', borderRadius: '12px', outline: 'none', fontSize: '15px', transition: 'all 0.2s' }}
          onFocus={e => Object.assign(e.target.style, { borderColor: '#3b82f6', background: 'rgba(255,255,255,0.08)' })}
          onBlur={e => Object.assign(e.target.style, { borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' })}
        />
        <button 
          type="submit" 
          disabled={loading || !input.trim()} 
          style={{ 
            background: 'var(--primary)', 
            color: 'white', 
            border: 'none', 
            padding: '0 24px', 
            borderRadius: '12px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            opacity: (loading || !input.trim()) ? 0.5 : 1
          }}
        >
          <Send size={20} />
        </button>
      </form>
    </motion.div>
  );
}
