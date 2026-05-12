'use client';

import { useState, useEffect } from 'react';
import { API } from '@/lib/api';
import { generateMnemonic, mnemonicToKeyPair } from '@/lib/identity';
import { useAuthStore } from '@/stores/auth';
import { SeedDisplayModal } from './SeedDisplayModal';

interface IdentityStatus {
  has_seed: boolean;
  authority_id: string | null;
  seed_generated_at: string | null;
  devices_linked: number;
}

interface DeviceInfo {
  device_fingerprint: string;
  label: string | null;
  linked_at: string;
  is_current: boolean;
}

export function SecureMyAuthority() {
  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [seedWords, setSeedWords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [showDevices, setShowDevices] = useState(false);

  const fetchAuthUser = useAuthStore((s) => s.fetchUser);

  const fetchStatus = async () => {
    try {
      const data = await API.getStatus();
      setStatus(data as IdentityStatus);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const mnemonic = await generateMnemonic();
      const words = mnemonic.split(' ');
      setSeedWords(words);

      const { publicKeyHex } = await mnemonicToKeyPair(mnemonic);

      await API.generateKey(publicKeyHex);
      await fetchAuthUser();
      await fetchStatus();
      setShowSeed(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate identity key';
      if (msg.includes('409')) {
        setError('This account already has a seed phrase or the identity key is taken.');
      } else {
        setError(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCloseSeed = () => {
    setShowSeed(false);
    setSeedWords([]);
  };

  const fetchDevices = async () => {
    try {
      const data = await API.getDevices();
      setDevices(data.devices);
      setShowDevices(true);
      await fetchStatus();
    } catch {
      setError('Failed to load devices');
    }
  };

  const handleUnlink = async (fp: string) => {
    try {
      await API.unlinkDevice(fp);
      await fetchDevices();
      await fetchStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to unlink device';
      setError(msg);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '16px' }}>
        <p style={{ margin: 0 }}>Loading identity status...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '16px' }}>
      <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>&#128274;</span>
        Secure My Authority
      </h3>

      {error && (
        <div style={{ color: '#c62828', fontSize: '13px', marginBottom: '12px', backgroundColor: '#ffebee', padding: '8px', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {!status?.has_seed ? (
        <div>
          <p style={{ fontSize: '14px', color: '#555', marginBottom: '16px' }}>
            Your identity is currently tied to this browser. Generate a 12-word seed phrase to own your reputation permanently. You can use it to recover your account on any device.
          </p>
          <p style={{ fontSize: '13px', color: '#c62828', fontWeight: 'bold', marginBottom: '16px' }}>
            This is your only key. We do not store it. If you lose it, your reputation is lost forever.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1565c0',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: generating ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? 'Generating...' : 'Generate Seed Phrase'}
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '14px', color: '#2e7d32', marginBottom: '8px' }}>
            &#10003; Your identity is secured with a seed phrase
          </p>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            Generated {status.seed_generated_at ? new Date(status.seed_generated_at).toLocaleDateString() : 'unknown date'}
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={fetchDevices}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Manage Devices ({status.devices_linked})
            </button>
            <button
              onClick={() => window.location.href = '/claim'}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Claim on Another Device
            </button>
          </div>
        </div>
      )}

      {showDevices && (
        <div style={{ marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Linked Devices</h4>
          {devices.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#888' }}>No devices linked.</p>
          ) : (
            <div>
              {devices.map((d) => (
                <div
                  key={d.device_fingerprint}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {d.device_fingerprint.substring(0, 16)}...
                    </span>
                    {d.is_current && (
                      <span style={{ marginLeft: '8px', color: '#2e7d32', fontSize: '12px', fontWeight: 'bold' }}>
                        (current)
                      </span>
                    )}
                    <br />
                    <span style={{ color: '#888', fontSize: '11px' }}>
                      Linked {new Date(d.linked_at).toLocaleDateString()}
                    </span>
                  </div>
                  {!d.is_current && (
                    <button
                      onClick={() => handleUnlink(d.device_fingerprint)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#ffebee',
                        color: '#c62828',
                        border: '1px solid #ef9a9a',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Unlink
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowDevices(false)}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#1565c0',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Close
          </button>
        </div>
      )}

      {showSeed && seedWords.length === 12 && (
        <SeedDisplayModal words={seedWords} onClose={handleCloseSeed} />
      )}
    </div>
  );
}
