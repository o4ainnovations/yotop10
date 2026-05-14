'use client';

import { useState, useEffect } from 'react';
import { API } from '@/lib/api';
import { generateMnemonic, mnemonicToKeyPair } from '@/lib/identity';
import { formatDate } from '@/lib/dates';
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

  if (loading) {
    return (
      <div className="p-5 border border-white/10 rounded-2xl mt-4 bg-white/5">
        <p className="text-white/40">Loading identity status...</p>
      </div>
    );
  }

  return (
    <div className="p-5 border border-white/10 rounded-2xl mt-4 bg-white/5">
      <h3 className="mt-0 mb-3 flex items-center gap-2 text-white text-base font-bold">
        <Icon name="Lock" size={18} color="var(--color-orange-400)" />
        Secure My Authority
      </h3>

      {error && (
        <div className="text-red-500 text-[13px] mb-3 bg-red-500/8 px-3 py-2.5 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      {!status?.has_seed ? (
        <div>
          <p className="text-sm text-white/60 mb-4 leading-relaxed">
            Your identity is currently tied to this browser. Generate a 12-word seed phrase to own your reputation permanently. You can use it to recover your account on any device.
          </p>
          <p className="text-[13px] text-red-400 font-bold mb-4">
            This is your only key. We do not store it. If you lose it, your reputation is lost forever.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={`px-5 py-2.5 text-white border-none rounded-xl cursor-pointer text-sm font-bold min-h-[44px] ${generating ? 'bg-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-pink-500 cursor-pointer'}`}
          >
            {generating ? 'Generating...' : 'Generate Seed Phrase'}
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-green-400 mb-2 flex items-center gap-1">
            <Icon name="Check" size={16} color="#2e7d32" /> Your identity is secured with a seed phrase
          </p>
          <p className="text-xs text-white/40 mb-3" suppressHydrationWarning>
            Generated {status.seed_generated_at ? formatDate(status.seed_generated_at) : 'unknown date'}
          </p>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={fetchDevices}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer text-[13px] text-white min-h-[40px] hover:bg-white/10"
            >
              Manage Devices ({status.devices_linked})
            </button>
            <button
              onClick={() => window.location.href = '/claim'}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer text-[13px] text-white min-h-[40px] hover:bg-white/10"
            >
              Claim on Another Device
            </button>
          </div>
        </div>
      )}

      {showDevices && (
        <div className="mt-4 border-t border-white/10 pt-3.5">
          <h4 className="mt-0 mb-2.5 text-sm text-white font-bold">Linked Devices</h4>
          {devices.length === 0 ? (
            <p className="text-[13px] text-white/40">No devices linked.</p>
          ) : (
            <div>
              {devices.map((d) => (
                <div
                  key={d.device_fingerprint}
                  className="flex justify-between items-center py-2.5 border-b border-white/5 text-[13px]"
                >
                  <div>
                    <span className="font-mono text-xs text-white/60">
                      {d.device_fingerprint.substring(0, 16)}...
                    </span>
                    {d.is_current && (
                      <span className="ml-2 text-green-400 text-xs font-bold bg-green-500/10 px-1.5 py-0.5 rounded">
                        current
                      </span>
                    )}
                    <br />
                    <span className="text-white/40 text-[11px]" suppressHydrationWarning>
                      Linked {formatDate(d.linked_at)}
                    </span>
                  </div>
                  {!d.is_current && (
                    <button
                      onClick={() => handleUnlink(d.device_fingerprint)}
                      className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg cursor-pointer text-xs min-h-[32px] hover:bg-red-500/20"
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
            className="mt-2.5 px-3 py-1.5 bg-transparent border-none text-orange-400 cursor-pointer text-[13px] hover:text-orange-300"
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
