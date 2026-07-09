'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';

type ConversationStatus = 'BOT' | 'NEEDS_HUMAN' | 'HUMAN';

interface ConversationSummary {
  id: string;
  sessionId: string;
  createdAt: string;
  status: ConversationStatus;
  messageCount: number;
  lastMessagePreview: string;
}

interface Message {
  id: string;
  role: 'user' | 'bot' | 'agent';
  content: string;
  createdAt: string;
}

interface Transcript {
  id: string;
  sessionId: string;
  createdAt: string;
  status: ConversationStatus;
  messages: Message[];
}

const STATUS_FILTERS: { label: string; value: ConversationStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Needs Human', value: 'NEEDS_HUMAN' },
  { label: 'Human', value: 'HUMAN' },
  { label: 'Bot', value: 'BOT' },
];

const STATUS_BADGE: Record<ConversationStatus, string> = {
  BOT: '',
  NEEDS_HUMAN: 'badge-pending',
  HUMAN: 'badge-resolved',
};

const STATUS_LABEL: Record<ConversationStatus, string> = {
  BOT: 'Bot',
  NEEDS_HUMAN: 'Needs Human',
  HUMAN: 'Human',
};

export default function ConversationsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const botId = params.id as string;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | ''>('');
  const [error, setError] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, Transcript>>({});
  const [loadingTranscript, setLoadingTranscript] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  const limit = 20;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api(`/bots/${botId}/conversations?${params}`, { token: token! });
      setConversations(res.data);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message);
    }
  }, [botId, token, page, statusFilter]);

  useEffect(() => {
    if (token && botId) fetchConversations();
  }, [token, botId, fetchConversations]);

  // Tracks the newest message time we've seen per conversation, so polling can
  // ask for only what's new instead of re-fetching the whole transcript every
  // ~4s. A ref (not state) so reading it doesn't force loadTranscript/
  // pollTranscript to change identity and reset the polling interval below.
  const lastMessageTimeRef = useRef<Record<string, string>>({});

  const loadTranscript = useCallback(async (conversationId: string) => {
    const data: Transcript = await api(`/bots/${botId}/conversations/${conversationId}`, { token: token! });
    setTranscripts((prev) => ({ ...prev, [conversationId]: data }));
    if (data.messages.length > 0) {
      lastMessageTimeRef.current[conversationId] = data.messages[data.messages.length - 1].createdAt;
    }
    return data;
  }, [botId, token]);

  const pollTranscript = useCallback(async (conversationId: string) => {
    const after = lastMessageTimeRef.current[conversationId];
    const params = after ? `?after=${encodeURIComponent(after)}` : '';
    const data: Transcript = await api(`/bots/${botId}/conversations/${conversationId}${params}`, { token: token! });
    if (data.messages.length > 0) {
      lastMessageTimeRef.current[conversationId] = data.messages[data.messages.length - 1].createdAt;
    }
    setTranscripts((prev) => {
      const existing = prev[conversationId];
      if (!existing) return { ...prev, [conversationId]: data };
      if (data.messages.length === 0 && existing.status === data.status) return prev;
      return { ...prev, [conversationId]: { ...data, messages: [...existing.messages, ...data.messages] } };
    });
  }, [botId, token]);

  const toggleExpand = async (conversationId: string) => {
    if (expandedId === conversationId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(conversationId);
    setLoadingTranscript(conversationId);
    try {
      await loadTranscript(conversationId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingTranscript(null);
    }
  };

  // Poll the expanded conversation so new visitor messages show up without a manual refresh.
  useEffect(() => {
    if (!expandedId) return;
    const interval = setInterval(() => {
      pollTranscript(expandedId).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [expandedId, pollTranscript]);

  const takeOver = async (conversationId: string) => {
    setBusy(true);
    try {
      await api(`/bots/${botId}/conversations/${conversationId}/takeover`, { method: 'POST', token: token! });
      await loadTranscript(conversationId);
      fetchConversations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const release = async (conversationId: string) => {
    setBusy(true);
    try {
      await api(`/bots/${botId}/conversations/${conversationId}/release`, { method: 'POST', token: token! });
      await loadTranscript(conversationId);
      fetchConversations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (conversationId: string) => {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      await api(`/bots/${botId}/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText.trim() }),
        token: token!,
      });
      setReplyText('');
      await loadTranscript(conversationId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !user) return <div className="spinner">Loading...</div>;

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">🤖 ChatBot Admin</span>
        <div className="navbar-user">
          <span>{user.email}</span>
        </div>
      </nav>

      <div className="page-container">
        <Link href={`/bots/${botId}`} className="back-link">← Back to Bot</Link>

        <div className="page-header">
          <h1>Conversations</h1>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              className={`btn btn-sm ${statusFilter === f.value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {conversations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <p>No conversations yet. Once visitors chat with this bot, they&apos;ll show up here.</p>
          </div>
        ) : (
          <>
            {conversations.map((c) => {
              const isExpanded = expandedId === c.id;
              const transcript = transcripts[c.id];
              return (
                <div key={c.id} className="knowledge-item" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer' }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => toggleExpand(c.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        {STATUS_BADGE[c.status] && <span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>}
                        <span style={{ fontWeight: 600 }}>Session {c.sessionId.slice(0, 8)}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {c.messageCount} message{c.messageCount === 1 ? '' : 's'} · {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {!isExpanded && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.lastMessagePreview}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                      {loadingTranscript === c.id && <div className="spinner">Loading transcript...</div>}
                      {transcript && (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                            {transcript.messages.map((m) => {
                              const isVisitor = m.role === 'user';
                              const bg = isVisitor
                                ? 'var(--bg-input)'
                                : m.role === 'agent'
                                  ? 'rgba(34, 197, 94, 0.12)'
                                  : 'rgba(99, 102, 241, 0.12)';
                              return (
                                <div
                                  key={m.id}
                                  style={{
                                    alignSelf: isVisitor ? 'flex-start' : 'flex-end',
                                    maxWidth: '80%',
                                    background: bg,
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '10px 14px',
                                  }}
                                >
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>
                                    {m.role} · {new Date(m.createdAt).toLocaleTimeString()}
                                  </div>
                                  <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                                </div>
                              );
                            })}
                          </div>

                          {transcript.status === 'NEEDS_HUMAN' && (
                            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => takeOver(c.id)}>
                              Take Over
                            </button>
                          )}

                          {transcript.status === 'HUMAN' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Reply as agent..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') sendReply(c.id); }}
                                />
                                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => sendReply(c.id)}>Send</button>
                              </div>
                              <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => release(c.id)} style={{ alignSelf: 'flex-start' }}>
                                Release to Bot
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ← Previous
                </button>
                <span className="pagination-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
