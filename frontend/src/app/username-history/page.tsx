'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { API } from '@/lib/api';

interface HistoryEntry {
  id: string;
  custom_display_name: string;
  created_at: string;
  released_at: string | null;
  previous_username: string | null;
}

export default function UsernameHistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await API.getUsernameHistory() as { history: HistoryEntry[] };
        setHistory(data.history);
      } catch (err) {
        console.error('Failed to load username history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      <div>
        <Link href="/">← Home</Link>
      </div>

      <h1>Username History</h1>

      {history.length === 0 ? (
        <p>No username history yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Username</th>
              <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Date Changed</th>
              <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{entry.custom_display_name}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{new Date(entry.created_at).toLocaleString()}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {entry.released_at ? 'Released' : 'Current'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
