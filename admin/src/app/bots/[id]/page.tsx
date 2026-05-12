'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Bot {
  id: string;
  name: string;
  displayName: string;
  themeColor: string;
  welcomeMessage: string;
  pricePer1kTokens: number | string;
  pricePerMessage: number | string;
  apiKey: string;
  isHumanActive: boolean;
  createdAt: string;
}

interface Knowledge {
  id: string;
  content: string;
  createdAt: string;
}

interface UsageRecord {
  month: string;
  messageCount: number;
  tokenCount: number;
}

interface UsageData {
  current: UsageRecord;
  history: UsageRecord[];
}

export default function BotDetailPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const botId = params.id as string;

  const [bot, setBot] = useState<Bot | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);

  const [kTotal, setKTotal] = useState(0);
  const [kPage, setKPage] = useState(1);
  const kLimit = 10;

  const [newKnowledge, setNewKnowledge] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState('');

  // Bot Appearance settings
  const [editingAppearance, setEditingAppearance] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editThemeColor, setEditThemeColor] = useState('');
  const [editWelcomeMessage, setEditWelcomeMessage] = useState('');

  // Pricing settings
  const [editingPricing, setEditingPricing] = useState(false);
  const [editPricePer1k, setEditPricePer1k] = useState('0');
  const [editPricePerMessage, setEditPricePerMessage] = useState('0');

  // History filtering
  const [historyFilter, setHistoryFilter] = useState('');

  // Bot name editing
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  // Knowledge editing
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
  const [editKnowledgeContent, setEditKnowledgeContent] = useState('');

  // PDF Upload
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (token && botId) {
      fetchBot();
      fetchUsage();
    }
  }, [token, botId]);

  useEffect(() => {
    if (token && botId) {
      fetchKnowledge();
    }
  }, [token, botId, kPage]);

  const fetchBot = async () => {
    try {
      const data = await api(`/bots/${botId}`, { token: token! });
      setBot(data);
      setEditName(data.name);
      setEditDisplayName(data.displayName);
      setEditThemeColor(data.themeColor);
      setEditWelcomeMessage(data.welcomeMessage);
      setEditPricePer1k(String(data.pricePer1kTokens || 0));
      setEditPricePerMessage(String(data.pricePerMessage || 0));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updatePricing = async () => {
    try {
      const data = await api(`/bots/${botId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          pricePer1kTokens: parseFloat(editPricePer1k),
          pricePerMessage: parseFloat(editPricePerMessage),
        }),
        token: token!,
      });
      setBot(data);
      setEditingPricing(false);
      showSuccess('Pricing settings updated');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchUsage = async () => {
    try {
      const data = await api(`/bots/${botId}/usage`, { token: token! });
      setUsage(data);
    } catch (err: any) {
      console.error('Failed to fetch usage:', err);
    }
  };

  const fetchKnowledge = async () => {
    try {
      const res = await api(`/bots/${botId}/knowledge?page=${kPage}&limit=${kLimit}`, { token: token! });
      setKnowledge(res.data);
      setKTotal(res.total);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKnowledge.trim()) return;
    setAdding(true);
    setError('');
    try {
      await api(`/bots/${botId}/knowledge`, {
        method: 'POST',
        body: JSON.stringify({ content: newKnowledge.trim() }),
        token: token!,
      });
      setNewKnowledge('');
      fetchKnowledge();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const deleteKnowledge = async (id: string) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this knowledge chunk?')) return;
    
    try {
      await api(`/knowledge/${id}`, { method: 'DELETE', token: token! });
      fetchKnowledge();
      showSuccess('Knowledge deleted');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const clearAllKnowledge = async () => {
    if (!window.confirm('WARNING: This will permanently delete ALL knowledge for this bot. Are you sure?')) return;
    
    try {
      await api(`/bots/${botId}/knowledge`, { method: 'DELETE', token: token! });
      fetchKnowledge();
      showSuccess('All knowledge cleared');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      // We use standard fetch here because our api helper might not handle FormData correctly
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/bots/${botId}/knowledge/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Upload failed');
      }

      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      fetchKnowledge();
      showSuccess('PDF uploaded and processed successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const updateKnowledge = async (id: string) => {
    if (!editKnowledgeContent.trim()) return;
    try {
      await api(`/knowledge/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editKnowledgeContent.trim() }),
        token: token!,
      });
      setEditingKnowledgeId(null);
      setEditKnowledgeContent('');
      fetchKnowledge();
      showSuccess('Knowledge updated');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateBotName = async () => {
    if (!editName.trim() || !bot) return;
    try {
      await api(`/bots/${botId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
        token: token!,
      });
      setEditingName(false);
      fetchBot();
      showSuccess('Bot name updated');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveAppearance = async () => {
    if (!bot) return;
    try {
      await api(`/bots/${botId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: editDisplayName.trim(),
          themeColor: editThemeColor.trim(),
          welcomeMessage: editWelcomeMessage.trim(),
        }),
        token: token!,
      });
      setEditingAppearance(false);
      fetchBot();
      showSuccess('Appearance settings saved');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const rotateApiKey = async () => {
    if (!confirm('Are you sure? The old API key will stop working immediately. Any embedded widgets using this key will break until updated.')) return;
    try {
      await api(`/bots/${botId}/rotate-key`, { method: 'POST', token: token! });
      fetchBot();
      showSuccess('API key rotated successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteBot = async () => {
    if (!confirm('Are you sure you want to delete this bot? This cannot be undone.')) return;
    try {
      await api(`/bots/${botId}`, { method: 'DELETE', token: token! });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  if (isLoading || !user) return <div className="spinner">Loading...</div>;
  if (!bot) return <div className="spinner">Loading bot...</div>;

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const embedCode = `<!-- Load Voice Agent SDK -->
<script src="https://cdn.jsdelivr.net/gh/vapi-ai/web-sdk@latest/dist/vapi.js"></script>

<!-- Load Chatbot Widget -->
<script src="${backendUrl}/widget.js" data-bot-key="${bot.apiKey}"></script>`;
  const kTotalPages = Math.ceil(kTotal / kLimit);

  return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">🤖 ChatBot Admin</span>
        <div className="navbar-user">
          <span>{user.email}</span>
        </div>
      </nav>

      <div className="page-container">
        <Link href="/dashboard" className="back-link">← Back to Dashboard</Link>

        <div className="page-header">
          {editingName ? (
            <div className="inline-form" style={{ flex: 1, marginRight: 16 }}>
              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
              </div>
              <button className="btn btn-primary btn-sm" onClick={updateBotName}>Save</button>
              <button className="btn btn-outline btn-sm" onClick={() => { setEditingName(false); setEditName(bot.name); }}>Cancel</button>
            </div>
          ) : (
            <h1 onClick={() => setEditingName(true)} style={{ cursor: 'pointer' }} title="Click to edit">
              {bot.name} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>✏️</span>
            </h1>
          )}
          <button className="btn btn-danger" onClick={deleteBot}>Delete Bot</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Appearance Settings */}
        <div className="section">
          <div className="section-title">Chatbot Appearance</div>
          <div className="card" style={{ marginBottom: 16 }}>
            {editingAppearance ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label>Display Name (Public)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="e.g. Support Bot"
                  />
                </div>
                <div className="form-group">
                  <label>Theme Color</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input
                      type="color"
                      style={{ width: 50, height: 40, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                      value={editThemeColor}
                      onChange={(e) => setEditThemeColor(e.target.value)}
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={editThemeColor}
                      onChange={(e) => setEditThemeColor(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Welcome Message</label>
                  <textarea
                    className="form-input"
                    value={editWelcomeMessage}
                    onChange={(e) => setEditWelcomeMessage(e.target.value)}
                    rows={2}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={saveAppearance}>Save Appearance</button>
                  <button className="btn btn-outline" onClick={() => setEditingAppearance(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Display Name</div>
                    <div style={{ fontWeight: 500 }}>{bot.displayName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Theme Color</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, background: bot.themeColor }} />
                      <code>{bot.themeColor}</code>
                    </div>
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingAppearance(true)}>Edit Appearance</button>
              </div>
            )}
          </div>
        </div>

        {/* Bot Info */}
        <div className="section">
          <div className="section-title">Bot Information</div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Bot ID</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code className="code-block" style={{ flex: 1 }}>{bot.id}</code>
                <button className="copy-btn" onClick={() => copyToClipboard(bot.id, 'id')}>
                  {copied === 'id' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>API Key</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code className="code-block" style={{ flex: 1 }}>{bot.apiKey}</code>
                <button className="copy-btn" onClick={() => copyToClipboard(bot.apiKey, 'key')}>
                  {copied === 'key' ? '✓ Copied' : 'Copy'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={rotateApiKey} title="Generate new API key">
                  🔄 Rotate
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Embed Code */}
        <div className="section">
          <div className="section-title">Embed Code</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Add these script tags to your website header to enable both the Chatbot and Voice Agent:
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
            <pre className="code-block" style={{ flex: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px' }}>
              {embedCode}
            </pre>
            <button className="copy-btn" onClick={() => copyToClipboard(embedCode, 'embed')}>
              {copied === 'embed' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div className="alert alert-info" style={{ fontSize: '13px' }}>
            <strong>💡 Voice Agent Tip:</strong> Ensure you have configured your Vapi Assistant ID in the backend to enable the voice call feature.
          </div>
        </div>

        {/* Usage Metrics */}
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Usage Metrics</div>
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => setEditingPricing(true)}
            >
              ⚙️ Configure Pricing
            </button>
          </div>

          <div className="card-grid" style={{ marginBottom: 24 }}>
            <div className="card">
              <div className="card-meta">This Month</div>
              <div className="card-title" style={{ fontSize: 24, margin: '8px 0' }}>
                {usage?.current.messageCount || 0}
              </div>
              <div className="card-meta">Messages sent</div>
            </div>
            <div className="card">
              <div className="card-meta">Tokens (Est.)</div>
              <div className="card-title" style={{ fontSize: 24, margin: '8px 0' }}>
                {usage?.current.tokenCount.toLocaleString() || 0}
              </div>
              <div className="card-meta">Approximate consumption</div>
            </div>
            <div className="card" style={{ border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}>
              <div className="card-meta" style={{ color: '#10b981' }}>Estimated Cost</div>
              <div className="card-title" style={{ fontSize: 24, margin: '8px 0', color: '#10b981' }}>
                ${((Number(usage?.current.tokenCount || 0) / 1000) * Number(bot?.pricePer1kTokens || 0) + 
                   Number(usage?.current.messageCount || 0) * Number(bot?.pricePerMessage || 0)).toFixed(2)}
              </div>
              <div className="card-meta">Based on current rates</div>
            </div>
          </div>

          {usage && usage.history.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Consumption History
                </label>
                <input 
                  type="text" 
                  placeholder="Filter by month..." 
                  className="form-input"
                  style={{ width: '150px', padding: '4px 8px', fontSize: '12px' }}
                  value={historyFilter}
                  onChange={(e) => setHistoryFilter(e.target.value)}
                />
              </div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Month</th>
                    <th style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Messages</th>
                    <th style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Tokens</th>
                    <th style={{ padding: '8px 0', color: 'var(--text-secondary)', textAlign: 'right' }}>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.history
                    .filter(record => record.month.toLowerCase().includes(historyFilter.toLowerCase()))
                    .map((record) => {
                      const cost = (record.tokenCount / 1000) * Number(bot?.pricePer1kTokens || 0) + 
                                   record.messageCount * Number(bot?.pricePerMessage || 0);
                      return (
                        <tr key={record.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px 0' }}>{record.month}</td>
                          <td style={{ padding: '10px 0' }}>{record.messageCount}</td>
                          <td style={{ padding: '10px 0' }}>{record.tokenCount.toLocaleString()}</td>
                          <td style={{ padding: '10px 0', textAlign: 'right', color: '#10b981' }}>${cost.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pricing Modal */}
        {editingPricing && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 400 }}>
              <h3 style={{ marginBottom: 16 }}>Configure Pricing</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Set the rates used to calculate cost estimates for this bot.
              </p>
              
              <div className="form-group">
                <label>Price per 1,000 Tokens ($)</label>
                <input 
                  type="number" 
                  step="0.0001"
                  className="form-input"
                  value={editPricePer1k}
                  onChange={(e) => setEditPricePer1k(e.target.value)}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Example: 0.002 (GPT-3.5 rate)</span>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Price per Message ($)</label>
                <input 
                  type="number" 
                  step="0.001"
                  className="form-input"
                  value={editPricePerMessage}
                  onChange={(e) => setEditPricePerMessage(e.target.value)}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fixed cost per message sent</span>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setEditingPricing(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={updatePricing}>Save Pricing</button>
              </div>
            </div>
          </div>
        )}

        {/* Knowledge Management */}
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Knowledge Base ({kTotal} chunks)</div>
            {knowledge.length > 0 && (
              <button 
                className="btn btn-outline btn-sm" 
                style={{ color: 'var(--danger-color)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                onClick={clearAllKnowledge}
              >
                🗑️ Clear All
              </button>
            )}
          </div>

          <form onSubmit={addKnowledge} style={{ marginBottom: 24 }}>
            <div className="form-group">
              <label htmlFor="knowledge">Add Knowledge</label>
              <textarea
                id="knowledge"
                className="form-input"
                placeholder="Paste FAQ, product info, or any text your bot should know about..."
                value={newKnowledge}
                onChange={(e) => setNewKnowledge(e.target.value)}
                rows={5}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? 'Adding...' : '+ Add Knowledge Chunk'}
            </button>
          </form>

          <div style={{ padding: '20px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px dashed rgba(99, 102, 241, 0.3)', marginBottom: '32px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '15px' }}>📄 Upload Knowledge from PDF</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Upload a document to automatically extract text and add it to your bot's knowledge base.
            </p>
            <form onSubmit={handleFileUpload} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="form-input"
                style={{ padding: '8px' }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!file || uploading}
                style={{ whiteSpace: 'nowrap' }}
              >
                {uploading ? 'Processing...' : 'Upload PDF'}
              </button>
            </form>
          </div>

          {knowledge.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <p>No knowledge added yet. Add content above for your bot to learn from.</p>
            </div>
          ) : (
            <>
              {knowledge.map((k) => (
                <div key={k.id} className="knowledge-item">
                  {editingKnowledgeId === k.id ? (
                    <div style={{ flex: 1 }}>
                      <textarea
                        className="form-input"
                        value={editKnowledgeContent}
                        onChange={(e) => setEditKnowledgeContent(e.target.value)}
                        rows={4}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => updateKnowledge(k.id)}>Save</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setEditingKnowledgeId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="knowledge-content">{k.content}</div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => { setEditingKnowledgeId(k.id); setEditKnowledgeContent(k.content); }}
                        >
                          Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteKnowledge(k.id)}>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Knowledge Pagination */}
              {kTotalPages > 1 && (
                <div className="pagination">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setKPage((p) => Math.max(1, p - 1))}
                    disabled={kPage === 1}
                  >
                    ← Previous
                  </button>
                  <span className="pagination-info">Page {kPage} of {kTotalPages}</span>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setKPage((p) => Math.min(kTotalPages, p + 1))}
                    disabled={kPage === kTotalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
