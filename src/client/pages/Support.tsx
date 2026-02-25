import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../stores/auth';

interface Ticket {
  id: number;
  user_id: number;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  submitted_by?: string;
  created_at: string;
}

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    const res = await api.get('/tickets');
    const data = await res.json();
    setTickets(Array.isArray(data) ? data : []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const res = await api.post('/tickets', { subject, message });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }

    setSubject('');
    setMessage('');
    setSuccess('Ticket submitted!');
    setShowModal(false);
    setTimeout(() => setSuccess(''), 2000);
    fetchTickets();
  };

  const handleResolve = async (id: number) => {
    await api.put(`/tickets/${id}/resolve`);
    fetchTickets();
  };

  return (
    <>
      <div className="support-header">
        <h1>Support Tickets</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          New Ticket
        </button>
      </div>

      {success && (
        <div className="card success-banner">
          <p className="success-message">{success}</p>
        </div>
      )}

      <div className="card">
        <h3 style={{ color: '#fff', margin: '0 0 0.75rem' }}>
          {user?.role === 'admin' ? 'All Tickets' : 'Your Tickets'}
        </h3>
        {tickets.length === 0 ? (
          <p style={{ color: '#aaa' }}>No tickets.</p>
        ) : (
          tickets.map((t) => (
            <div key={t.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong style={{ color: '#fff' }}>{t.subject}</strong>
                  {t.submitted_by && <small style={{ color: '#aaa', marginLeft: '0.5rem' }}>by {t.submitted_by}</small>}
                  <br />
                  <small style={{ color: '#aaa' }}>{new Date(t.created_at).toLocaleDateString()}</small>
                  <span className={`status-badge ${t.status === 'open' ? 'starting' : 'running'}`} style={{ marginLeft: '0.5rem' }}>
                    {t.status}
                  </span>
                </div>
                {user?.role === 'admin' && t.status === 'open' && (
                  <button onClick={() => handleResolve(t.id)} style={{ fontSize: '0.85rem' }}>Resolve</button>
                )}
              </div>
              <p style={{ color: '#ccc', fontSize: '0.9rem', marginTop: '0.5rem' }}>{t.message}</p>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit a Ticket</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  required
                />
              </div>
              {error && <p className="error-message">{error}</p>}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
