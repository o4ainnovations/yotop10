'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { API, PostHistoryResponse } from '@/lib/api';

const RESERVED_ROUTES = ['admin', 'api', 'login', 'search', 'settings', 'profile', 'categories', 'c', 'auth'];

interface PostVersion {
  version_number: number;
  title: string;
  intro: string;
  items: Array<{ rank: number; title: string; justification: string }>;
  created_at: string;
  author_username: string;
  change_summary?: string;
}

export default function PostHistoryClient({ slug }: { slug: string }) {
  const postId = slug;

  // Route guard - reserved routes should not be treated as posts
  if (RESERVED_ROUTES.includes(postId)) {
    notFound();
  }

  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PostVersion | null>(null);

  useEffect(() => {
    if (!postId) return;
    
    API.getPostHistory(postId)
      .then((data: PostHistoryResponse) => {
        setVersions(data.versions || []);
        if (data.versions && data.versions.length > 0) setSelectedVersion(data.versions[0]);
      })
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) return <div>Loading history...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <h1>YoTop10</h1>
        <nav>
          <a href={`/${postId}`}>Back to Post</a>
        </nav>
      </header>
      <main>
        <h1>Post History / Changelog</h1>
        {versions.length === 0 ? (
          <p>No history available.</p>
        ) : (
          <div style={{ display: 'flex' }}>
            <div style={{ width: '30%' }}>
              <h2>Versions</h2>
              {versions.map(v => (
                <div key={v.version_number} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '5px' }}>
                  <button 
                    onClick={() => setSelectedVersion(v)}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Version {v.version_number}
                    {versions[0]?.version_number === v.version_number && ' (Current)'}
                  </button>
                  <p>{new Date(v.created_at).toLocaleDateString()}</p>
                  {v.change_summary && <p>{v.change_summary}</p>}
                </div>
              ))}
            </div>
            <div style={{ width: '70%', paddingLeft: '20px' }}>
              {selectedVersion ? (
                <div>
                  <h2>Version {selectedVersion.version_number}</h2>
                  <p>By {selectedVersion.author_username} - {new Date(selectedVersion.created_at).toLocaleDateString()}</p>
                  {selectedVersion.change_summary && <p><strong>Change:</strong> {selectedVersion.change_summary}</p>}
                  <h3>{selectedVersion.title}</h3>
                  <p>{selectedVersion.intro}</p>
                  <h4>List Items:</h4>
                  {selectedVersion.items.map(item => (
                    <div key={item.rank}>
                      #{item.rank} {item.title} - {item.justification}
                    </div>
                  ))}
                </div>
              ) : <p>Select a version</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
