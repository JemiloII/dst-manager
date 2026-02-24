import { useState } from 'react';
import { api } from '../api';

export default function Admin() {
  const [updating, setUpdating] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const handleUpdate = async () => {
    setUpdating(true);
    setOutput('');
    setError('');

    const res = await api.post('/admin/update-dst');
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
    } else {
      setOutput(data.output);
    }
    setUpdating(false);
  };

  return (
    <>
      <h1 style={{ color: '#fff' }}>Admin</h1>

      <div className="card">
        <h3 style={{ color: '#fff', margin: '0 0 0.75rem' }}>
          <img src="/button_icons/update.png" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: '0.5rem' }} />
          Update DST Server
        </h3>
        <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          Runs <code>steamcmd +login anonymous +app_update 343050 +quit</code>
        </p>
        <button onClick={handleUpdate} disabled={updating}>
          {updating ? 'Updating...' : 'Update Now'}
        </button>
        {error && <p className="error-message" style={{ marginTop: '0.5rem' }}>{error}</p>}
        {output && (
          <div className="log-viewer" style={{ marginTop: '0.75rem' }}>
            {output}
          </div>
        )}
      </div>
    </>
  );
}
