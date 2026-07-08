'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';

interface ConversationSummary {
  id: string;
  sessionId: string;
  createdAt: string;
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
  messages: Message[];
}

export default function ConversationsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const botId = params.id as string;

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, Transcript>>({});
  const [loadingTranscript, setLoadingTranscript] = useState<string | null>(null);

  const limit = 20;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (token && botId) fetchConversations();
  }, [token, botId, page]);

  const fetchConversations = async () => {
    try {
      const res = await api(`/bots/${botId}/conversations?page=${page}&limit=${limit}`, { token: token! });
      setConversations(res.data);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleExpand = async (conversationId: string) => {
    if (expandedId === conversationId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(conversationId);
    if (!transcripts[conversationId]) {
      setLoadingTranscript(conversationId);
      try {
        const data = await api(`/bots/${botId}/conversations/${conversationId}`, { token: token! });
        setTranscripts((prev) => ({ ...prev, [conversationId]: data }));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingTranscript(null);
      }
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

        {conversations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <p>No conversations yet. Once visitors chat with this bot, they'll show up here.</p>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {transcript.messages.map((m) => (
                            <div
                              key={m.id}
                              style={{
                                alignSelf: m.role === 'user' ? 'flex-start' : 'flex-end',
                                maxWidth: '80%',
                                background: m.role === 'user' ? 'var(--bg-input)' : 'rgba(99, 102, 241, 0.12)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '10px 14px',
                              }}
                            >
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>
                                {m.role} · {new Date(m.createdAt).toLocaleTimeString()}
                              </div>
                              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                            </div>
                          ))}
                        </div>
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
