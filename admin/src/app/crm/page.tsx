'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';

type SyncStatus = 'PENDING' | 'RESOLVED' | 'FAILED';

interface SyncFailure {
  id: string;
  type: 'CONTACT_SYNC' | 'CALL_ENGAGEMENT';
  status: SyncStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_FILTERS: { label: string; value: SyncStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Failed', value: 'FAILED' },
];

export default function CrmSyncFailuresPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [failures, setFailures] = useState<SyncFailure[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SyncStatus | ''>('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const limit = 20;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (token) fetchFailures();
  }, [token, page, status]);

  const fetchFailures = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      const res = await api(`/crm/sync-failures?${params}`, { token: token! });
      setFailures(res.data);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const retry = async (id: string) => {
    setRetryingId(id);
    setError('');
    try {
      const updated = await api(`/crm/sync-failures/${id}/retry`, { method: 'POST', token: token! });
      setFailures((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setSuccess(updated.status === 'RESOLVED' ? 'Sync resolved' : 'Retry attempted — still failing');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRetryingId(null);
    }
  };

  if (isLoading || !user) return <div className="spinner">Loading...</div>;

  const totalPages = Math.ceil(total / limit);
  const badgeClass = { PENDING: 'badge-pending', RESOLVED: 'badge-resolved', FAILED: 'badge-failed' };

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
          <h1>CRM Sync Failures</h1>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              className={`btn btn-sm ${status === f.value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {failures.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <p>No sync failures{status ? ` with status ${status}` : ''}. HubSpot syncs are healthy.</p>
          </div>
        ) : (
          <>
            {failures.map((f) => (
              <div key={f.id} className="knowledge-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge ${badgeClass[f.status]}`}>{f.status}</span>
                    <span style={{ fontWeight: 600 }}>{f.type === 'CONTACT_SYNC' ? 'Contact Sync' : 'Call Engagement'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {f.attempts} attempt{f.attempts === 1 ? '' : 's'} · {new Date(f.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {f.status !== 'RESOLVED' && (
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={retryingId === f.id}
                      onClick={() => retry(f.id)}
                    >
                      {retryingId === f.id ? 'Retrying...' : 'Retry now'}
                    </button>
                  )}
                </div>
                {f.lastError && (
                  <div className="knowledge-content" style={{ maxHeight: 'none', color: '#fca5a5' }}>
                    {f.lastError}
                  </div>
                )}
              </div>
            ))}

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
