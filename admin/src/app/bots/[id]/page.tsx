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
  humanHandoffEnabled: boolean;
  createdAt: string;
  vapiPublicKey: string | null;
  vapiAssistantId: string | null;
  aiProvider: string;
  hasAiApiKey: boolean;
  embeddingProvider: string | null;
  hasEmbeddingApiKey: boolean;
  hasHubspotAccessToken: boolean;
  hasVapiWebhookSecret: boolean;
}

const AI_PROVIDERS = [
  { value: 'GEMINI', label: 'Google Gemini' },
  { value: 'OPENAI', label: 'OpenAI' },
  { value: 'ANTHROPIC', label: 'Anthropic (Claude)' },
  { value: 'GROQ', label: 'Groq' },
  { value: 'MISTRAL', label: 'Mistral' },
];

const EMBEDDING_CAPABLE_PROVIDERS = ['GEMINI', 'OPENAI', 'MISTRAL'];

function providerLabel(value: string): string {
  return AI_PROVIDERS.find((p) => p.value === value)?.label || value;
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
  totalConversations: number;
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
}

/** Rounded-top bar path so bars read as "data ending in the air", flat where they meet the baseline. */
function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

/** Minimal dependency-free bar chart for one usage metric across months. */
function UsageBarChart({ history, metric, label }: { history: UsageRecord[]; metric: 'messageCount' | 'tokenCount'; label: string }) {
  const data = [...history].reverse(); // oldest -> newest, left to right
  const width = 320;
  const height = 120;
  const padding = { top: 16, bottom: 20, left: 4, right: 4 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...data.map((d) => Number(d[metric])), 1);
  const gap = 6;
  const barWidth = data.length > 0 ? (chartWidth - gap * (data.length - 1)) / data.length : 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`${label} per month`}>
      {data.map((d, i) => {
        const value = Number(d[metric]);
        const barHeight = maxValue > 0 ? (value / maxValue) * chartHeight : 0;
        const x = padding.left + i * (barWidth + gap);
        const y = padding.top + (chartHeight - barHeight);
        return (
          <g key={d.month}>
            <path d={roundedTopBarPath(x, y, barWidth, Math.max(barHeight, 1), 3)} style={{ fill: 'var(--accent)' }}>
              <title>{`${d.month}: ${value.toLocaleString()} ${label.toLowerCase()}`}</title>
            </path>
            <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" fontSize="8" style={{ fill: 'var(--text-muted)' }}>
              {formatMonth(d.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
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

  // Integrations (BYOK)
  const [editingAiProvider, setEditingAiProvider] = useState(false);
  const [aiProviderInput, setAiProviderInput] = useState('GEMINI');
  const [aiApiKeyInput, setAiApiKeyInput] = useState('');
  const [editingEmbedding, setEditingEmbedding] = useState(false);
  const [embeddingProviderInput, setEmbeddingProviderInput] = useState('GEMINI');
  const [embeddingApiKeyInput, setEmbeddingApiKeyInput] = useState('');
  const [editingHubspot, setEditingHubspot] = useState(false);
  const [hubspotTokenInput, setHubspotTokenInput] = useState('');
  const [editingVoice, setEditingVoice] = useState(false);
  const [vapiPublicKeyInput, setVapiPublicKeyInput] = useState('');
  const [vapiAssistantIdInput, setVapiAssistantIdInput] = useState('');
  const [vapiWebhookSecretInput, setVapiWebhookSecretInput] = useState('');

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

  const toggleHandoff = async () => {
    if (!bot) return;
    try {
      await api(`/bots/${botId}`, {
        method: 'PATCH',
        body: JSON.stringify({ humanHandoffEnabled: !bot.humanHandoffEnabled }),
        token: token!,
      });
      const wasEnabled = bot.humanHandoffEnabled;
      await fetchBot();
      showSuccess(wasEnabled ? 'Live agent handoff disabled' : 'Live agent handoff enabled');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveAiProvider = async () => {
    if (!aiApiKeyInput.trim()) return;
    try {
      await api(`/bots/${botId}`, {
        method: 'PATCH',
        body: JSON.stringify({ aiProvider: aiProviderInput, aiApiKey: aiApiKeyInput.trim() }),
        token: token!,
      });
      setAiApiKeyInput('');
      setEditingAiProvider(false);
      fetchBot();
      showSuccess('AI provider saved');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const clearAiApiKey = async () => {
    if (!confirm('Remove this bot\'s AI provider key? Chat and knowledge answering will stop working until a new key is added.')) return;
    try {
      await api(`/bots/${botId}`, { method: 'PATCH', body: JSON.stringify({ aiApiKey: '' }), token: token! });
      fetchBot();
      showSuccess('AI provider key removed');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveEmbeddingConfig = async () => {
    if (!embeddingApiKeyInput.trim()) return;
    try {
      await api(`/bots/${botId}`, {
        method: 'PATCH',
        body: JSON.stringify({ embeddingProvider: embeddingProviderInput, embeddingApiKey: embeddingApiKeyInput.trim() }),
        token: token!,
      });
      setEmbeddingApiKeyInput('');
      fetchBot();
      showSuccess('Embedding provider saved');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const clearEmbeddingApiKey = async () => {
    if (!confirm('Remove the embeddings key? Knowledge base search will stop working for this bot.')) return;
    try {
      await api(`/bots/${botId}`, { method: 'PATCH', body: JSON.stringify({ embeddingApiKey: '' }), token: token! });
      fetchBot();
      showSuccess('Embeddings key removed');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveHubspotToken = async () => {
    if (!hubspotTokenInput.trim()) return;
    try {
      await api(`/bots/${botId}`, {
        method: 'PATCH',
        body: JSON.stringify({ hubspotAccessToken: hubspotTokenInput.trim() }),
        token: token!,
      });
      setHubspotTokenInput('');
      setEditingHubspot(false);
      fetchBot();
      showSuccess('HubSpot access token saved');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const clearHubspotToken = async () => {
    if (!confirm('Remove the HubSpot access token? Call/contact syncing will stop for this bot.')) return;
    try {
      await api(`/bots/${botId}`, { method: 'PATCH', body: JSON.stringify({ hubspotAccessToken: '' }), token: token! });
      fetchBot();
      showSuccess('HubSpot access token removed');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveVoiceConfig = async () => {
    try {
      const body: Record<string, string> = {
        vapiPublicKey: vapiPublicKeyInput.trim(),
        vapiAssistantId: vapiAssistantIdInput.trim(),
      };
      // Leaving the secret field blank means "no change" — clearing it is a separate explicit action.
      if (vapiWebhookSecretInput.trim()) {
        body.vapiWebhookSecret = vapiWebhookSecretInput.trim();
      }
      await api(`/bots/${botId}`, { method: 'PATCH', body: JSON.stringify(body), token: token! });
      setVapiWebhookSecretInput('');
      setEditingVoice(false);
      fetchBot();
      showSuccess('Voice settings saved');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const clearVoiceWebhookSecret = async () => {
    if (!confirm('Remove the Vapi webhook secret? Incoming call webhooks for this bot will no longer be verified.')) return;
    try {
      await api(`/bots/${botId}`, { method: 'PATCH', body: JSON.stringify({ vapiWebhookSecret: '' }), token: token! });
      fetchBot();
      showSuccess('Webhook secret removed');
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
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/bots/${botId}/conversations`} className="btn btn-outline btn-sm">💬 Conversations</Link>
            <button className="btn btn-danger" onClick={deleteBot}>Delete Bot</button>
          </div>
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

        {/* Live Agent Handoff */}
        <div className="section">
          <div className="section-title">Live Agent Handoff</div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  {bot.humanHandoffEnabled ? 'Enabled' : 'Disabled'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {bot.humanHandoffEnabled
                    ? 'Visitors can request a human agent from the widget. Take over conversations from the '
                    : 'Turn this on to let visitors request a human agent from the widget. Manage handoffs from the '}
                  <Link href={`/bots/${botId}/conversations`}>Conversations page</Link>.
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={toggleHandoff}>
                {bot.humanHandoffEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>

        {/* Integrations (BYOK) */}
        <div className="section">
          <div className="section-title">Integrations</div>

          {/* AI Provider — required */}
          <div className="card" style={{ marginBottom: 16 }}>
            {editingAiProvider ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Provider</label>
                  <select
                    className="form-input"
                    value={aiProviderInput}
                    onChange={(e) => setAiProviderInput(e.target.value)}
                  >
                    {AI_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{providerLabel(aiProviderInput)} API Key</label>
                  <input
                    type="password"
                    className="form-input"
                    value={aiApiKeyInput}
                    onChange={(e) => setAiApiKeyInput(e.target.value)}
                    placeholder="Paste the API key for this provider"
                    autoFocus
                  />
                </div>
                {!EMBEDDING_CAPABLE_PROVIDERS.includes(aiProviderInput) && (
                  <div className="alert alert-error" style={{ fontSize: 13, marginBottom: 0 }}>
                    {providerLabel(aiProviderInput)} doesn&apos;t support embeddings — you&apos;ll need to configure a separate Gemini, OpenAI, or Mistral key below for knowledge base search.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveAiProvider}>Save</button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setEditingAiProvider(false); setAiApiKeyInput(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>AI Provider (required)</div>
                  <div style={{ fontWeight: 500, color: bot.hasAiApiKey ? 'var(--text-primary)' : 'var(--danger)' }}>
                    {bot.hasAiApiKey ? `${providerLabel(bot.aiProvider)} — •••• configured` : 'Not configured — chat is disabled'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => { setAiProviderInput(bot.aiProvider); setEditingAiProvider(true); }}
                  >
                    {bot.hasAiApiKey ? 'Replace' : 'Add Key'}
                  </button>
                  {bot.hasAiApiKey && <button className="btn btn-outline btn-sm" onClick={clearAiApiKey}>Remove</button>}
                </div>
              </div>
            )}
          </div>

          {/* Knowledge base embeddings — only needed when the AI provider above is chat-only */}
          {!EMBEDDING_CAPABLE_PROVIDERS.includes(bot.aiProvider) && (
            <div className="card" style={{ marginBottom: 16 }}>
              {editingEmbedding ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Embeddings Provider</label>
                    <select
                      className="form-input"
                      value={embeddingProviderInput}
                      onChange={(e) => setEmbeddingProviderInput(e.target.value)}
                    >
                      {AI_PROVIDERS.filter((p) => EMBEDDING_CAPABLE_PROVIDERS.includes(p.value)).map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>{providerLabel(embeddingProviderInput)} API Key</label>
                    <input
                      type="password"
                      className="form-input"
                      value={embeddingApiKeyInput}
                      onChange={(e) => setEmbeddingApiKeyInput(e.target.value)}
                      placeholder="Paste the API key for this provider"
                      autoFocus
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={saveEmbeddingConfig}>Save</button>
                    <button className="btn btn-outline btn-sm" onClick={() => { setEditingEmbedding(false); setEmbeddingApiKeyInput(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Knowledge Base Embeddings (required — {providerLabel(bot.aiProvider)} doesn&apos;t support embeddings)</div>
                    <div style={{ fontWeight: 500, color: bot.hasEmbeddingApiKey ? 'var(--text-primary)' : 'var(--danger)' }}>
                      {bot.hasEmbeddingApiKey ? `${providerLabel(bot.embeddingProvider || '')} — •••• configured` : 'Not configured — knowledge search is disabled'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => { setEmbeddingProviderInput(bot.embeddingProvider || 'GEMINI'); setEditingEmbedding(true); }}
                    >
                      {bot.hasEmbeddingApiKey ? 'Replace' : 'Add Key'}
                    </button>
                    {bot.hasEmbeddingApiKey && <button className="btn btn-outline btn-sm" onClick={clearEmbeddingApiKey}>Remove</button>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HubSpot — optional */}
          <div className="card" style={{ marginBottom: 16 }}>
            {editingHubspot ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>HubSpot Private App Access Token</label>
                  <input
                    type="password"
                    className="form-input"
                    value={hubspotTokenInput}
                    onChange={(e) => setHubspotTokenInput(e.target.value)}
                    placeholder="pat-..."
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveHubspotToken}>Save</button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setEditingHubspot(false); setHubspotTokenInput(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>CRM — HubSpot Access Token (optional)</div>
                  <div style={{ fontWeight: 500 }}>{bot.hasHubspotAccessToken ? '•••• configured' : 'Not configured'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingHubspot(true)}>{bot.hasHubspotAccessToken ? 'Replace' : 'Add Token'}</button>
                  {bot.hasHubspotAccessToken && <button className="btn btn-outline btn-sm" onClick={clearHubspotToken}>Remove</button>}
                </div>
              </div>
            )}
          </div>

          {/* Vapi — optional */}
          <div className="card">
            {editingVoice ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Vapi Public Key</label>
                  <input
                    type="text"
                    className="form-input"
                    value={vapiPublicKeyInput}
                    onChange={(e) => setVapiPublicKeyInput(e.target.value)}
                    placeholder="Publishable key from your Vapi dashboard"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Vapi Assistant ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={vapiAssistantIdInput}
                    onChange={(e) => setVapiAssistantIdInput(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Webhook Secret {bot.hasVapiWebhookSecret ? '(leave blank to keep current)' : '(optional, recommended)'}</label>
                  <input
                    type="password"
                    className="form-input"
                    value={vapiWebhookSecretInput}
                    onChange={(e) => setVapiWebhookSecretInput(e.target.value)}
                    placeholder={bot.hasVapiWebhookSecret ? '••••••••' : 'Server URL Secret from your Vapi assistant'}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveVoiceConfig}>Save</button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setEditingVoice(false); setVapiWebhookSecretInput(''); }}>Cancel</button>
                  {bot.hasVapiWebhookSecret && <button className="btn btn-outline btn-sm" onClick={clearVoiceWebhookSecret}>Remove Secret</button>}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Voice — Vapi (optional)</div>
                    <div style={{ fontWeight: 500 }}>
                      {bot.vapiPublicKey && bot.vapiAssistantId ? 'Configured' : 'Not configured — call button is hidden'}
                    </div>
                  </div>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setVapiPublicKeyInput(bot.vapiPublicKey || '');
                      setVapiAssistantIdInput(bot.vapiAssistantId || '');
                      setEditingVoice(true);
                    }}
                  >
                    {bot.vapiPublicKey ? 'Edit' : 'Configure'}
                  </button>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Server URL — paste this into your Vapi assistant&apos;s Server URL setting
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code className="code-block" style={{ flex: 1 }}>{`${backendUrl}/voice/webhook/${bot.id}`}</code>
                    <button className="copy-btn" onClick={() => copyToClipboard(`${backendUrl}/voice/webhook/${bot.id}`, 'webhook')}>
                      {copied === 'webhook' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
          {!bot.hasAiApiKey && (
            <div className="alert alert-error" style={{ fontSize: '13px' }}>
              <strong>⚠️ Setup incomplete:</strong> add an AI provider key in Integrations above — chat won&apos;t work without one.
            </div>
          )}
          {!(bot.vapiPublicKey && bot.vapiAssistantId) && (
            <div className="alert alert-info" style={{ fontSize: '13px' }}>
              <strong>💡 Voice Agent Tip:</strong> configure Vapi in the Integrations section above to enable the voice call button.
            </div>
          )}
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
            <Link href={`/bots/${botId}/conversations`} className="card-link">
              <div className="card">
                <div className="card-meta">All Time</div>
                <div className="card-title" style={{ fontSize: 24, margin: '8px 0' }}>
                  {usage?.totalConversations ?? 0}
                </div>
                <div className="card-meta">Conversations →</div>
              </div>
            </Link>
          </div>

          {usage && usage.history.length > 1 && (
            <div className="card-grid" style={{ marginBottom: 24 }}>
              <div className="card">
                <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Messages / month</label>
                <UsageBarChart history={usage.history} metric="messageCount" label="Messages" />
              </div>
              <div className="card">
                <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Tokens / month</label>
                <UsageBarChart history={usage.history} metric="tokenCount" label="Tokens" />
              </div>
            </div>
          )}

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
