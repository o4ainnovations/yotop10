'use client';

import { useState, useEffect } from 'react';
import { API } from '@/lib/api';
import { generateMnemonic, mnemonicToKeyPair } from '@/lib/identity';
import { useAuthStore } from '@/stores/auth';
import { SeedDisplayModal } from './SeedDisplayModal';
import { Icon } from '@/components/icons/Icon';

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

  const sectionStyle: React.CSSProperties = {
    padding: '20px',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    marginTop: '16px',
    background: 'var(--bg-secondary)',
    boxShadow: 'var(--shadow-sm)',
  };

  if (loading) {
    return (
      <div style={sectionStyle}>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading identity status...</p>
      </div>
    );
  }

  return (
    <div style={sectionStyle}>
      <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
        <Icon name="Lock" size={18} color="var(--accent)" />
        Secure My Authority
      </h3>

      {error && (
        <div style={{ color: '#c62828', fontSize: '13px', marginBottom: '12px', backgroundColor: 'rgba(198,40,40,0.08)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(198,40,40,0.2)' }}>
          {error}
        </div>
      )}

      {!status?.has_seed ? (
        <div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
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
              background: generating ? 'var(--border-primary)' : 'var(--accent-gradient)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: generating ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            {generating ? 'Generating...' : 'Generate Seed Phrase'}
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '14px', color: '#2e7d32', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Icon name="Check" size={16} color="#2e7d32" /> Your identity is secured with a seed phrase
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Generated {status.seed_generated_at ? new Date(status.seed_generated_at).toLocaleDateString() : 'unknown date'}
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={fetchDevices}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            >
              Manage Devices ({status.devices_linked})
            </button>
            <button
              onClick={() => window.location.href = '/claim'}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            >
              Claim on Another Device
            </button>
          </div>
        </div>
      )}

      {showDevices && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-primary)', paddingTop: '14px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text-primary)' }}>Linked Devices</h4>
          {devices.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No devices linked.</p>
          ) : (
            <div>
              {devices.map((d) => (
                <div
                  key={d.device_fingerprint}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border-primary)',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {d.device_fingerprint.substring(0, 16)}...
                    </span>
                    {d.is_current && (
                      <span style={{ marginLeft: '8px', color: '#2e7d32', fontSize: '12px', fontWeight: 'bold', background: 'rgba(46,125,50,0.1)', padding: '1px 6px', borderRadius: '3px' }}>
                        current
                      </span>
                    )}
                    <br />
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      Linked {new Date(d.linked_at).toLocaleDateString()}
                    </span>
                  </div>
                  {!d.is_current && (
                    <button
                      onClick={() => handleUnlink(d.device_fingerprint)}
                      style={{
                        padding: '4px 12px',
                        backgroundColor: 'rgba(198,40,40,0.08)',
                        color: '#c62828',
                        border: '1px solid rgba(198,40,40,0.2)',
                        borderRadius: 'var(--radius-sm)',
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
              marginTop: '10px',
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--accent)',
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


