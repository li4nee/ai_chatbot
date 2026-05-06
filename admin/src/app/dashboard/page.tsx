'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';

interface Bot {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, token, logout, isLoading } = useAuth();
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [botName, setBotName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const limit = 12;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (token) fetchBots();
  }, [token, page]);

  const fetchBots = async () => {
    try {
      const res = await api(`/bots?page=${page}&limit=${limit}`, { token: token! });
      setBots(res.data);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await api('/bots', {
        method: 'POST',
        body: JSON.stringify({ name: botName.trim() }),
        token: token!,
      });
      setBotName('');
      fetchBots();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (isLoading || !user) {
    return <div className="spinner">Loading...</div>;
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">🤖 ChatBot Admin</span>
        <div className="navbar-user">
          <span>{user.email}</span>
          <button className="btn btn-outline btn-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="page-container">
        <div className="page-header">
          <h1>Your Bots</h1>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Create Bot Form */}
        <div className="card" style={{ marginBottom: 24 }}>
          <form onSubmit={createBot} className="inline-form">
            <div className="form-group">
              <label htmlFor="botName">Create a new bot</label>
              <input
                id="botName"
                type="text"
                className="form-input"
                placeholder="My Support Bot"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : '+ Create Bot'}
            </button>
          </form>
        </div>

        {/* Bot List */}
        {bots.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤖</div>
            <p>No bots yet. Create your first bot above!</p>
          </div>
        ) : (
          <>
            <div className="card-grid">
              {bots.map((bot) => (
                <Link href={`/bots/${bot.id}`} key={bot.id} className="card-link">
                  <div className="card">
                    <div className="card-title">{bot.name}</div>
                    <div className="card-meta">
                      Created {new Date(bot.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
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
