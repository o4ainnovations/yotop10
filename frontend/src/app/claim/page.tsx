'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateMnemonic, mnemonicToKeyPair, signChallenge } from '@/lib/identity';
import { API } from '@/lib/api';

export default function ClaimPage() {
  const router = useRouter();
  const [words, setWords] = useState<string[]>(Array(12).fill(''));
  const [step, setStep] = useState<'enter' | 'signing' | 'done'>('enter');
  const [error, setError] = useState<string | null>(null);
  const [recoveredUser, setRecoveredUser] = useState<Record<string, unknown> | null>(null);

  const mnemonic = words.map((w) => w.trim().toLowerCase()).join(' ');

  const isValid = words.every((w) => w.trim().length > 0) && validateMnemonic(mnemonic);

  const handleWordChange = (index: number, value: string) => {
    const next = [...words];
    next[index] = value;
    setWords(next);
    setError(null);
  };

  const handleClaim = async () => {
    if (!isValid) {
      setError('Invalid seed phrase. Check each word and try again.');
      return;
    }

    setStep('signing');
    setError(null);

    try {
      const { publicKeyHex, privateKeyBytes } = await mnemonicToKeyPair(mnemonic);

      const fp = typeof window !== 'undefined'
        ? (localStorage.getItem('yotop10_fp') || '')
        : '';

      const { challenge } = await API.requestChallenge(publicKeyHex, fp);

      const signature = await signChallenge(privateKeyBytes, challenge);

      const result = await API.verifyClaim(publicKeyHex, challenge, signature, fp);

      setRecoveredUser(result.user);
      setStep('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to claim identity';
      if (msg.includes('404')) {
        setError('No account found with this seed phrase. Double-check each word.');
      } else if (msg.includes('403') || msg.includes('SIGNATURE_INVALID')) {
        setError('Signature verification failed. The seed phrase may be incorrect.');
      } else if (msg.includes('410') || msg.includes('CHALLENGE_EXPIRED')) {
        setError('Challenge expired. Please try again.');
      } else {
        setError(msg);
      }
      setStep('enter');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const pasted = text.trim().toLowerCase().split(/\s+/);
      if (pasted.length === 12) {
        setWords(pasted);
      } else {
        setError('Pasted text does not contain exactly 12 words');
      }
    } catch {
      setError('Could not read clipboard. Please type your seed phrase manually.');
    }
  };

  return (
    <div style={{ maxWidth: '560px', margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Claim Your Identity</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.6 }}>
        Enter your 12-word seed phrase to recover your identity on this device. Your full reputation and history will be restored.
      </p>

      {error && (
        <div role="alert" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '13px', marginBottom: '16px', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)' }}>
          {error}
        </div>
      )}

      {step === 'done' ? (
        <div className="premium-card" style={{ padding: '24px', textAlign: 'center', borderColor: '#4caf50' }}>
          <p style={{ fontSize: '18px', fontWeight: 700, color: '#2e7d32', marginBottom: '16px' }}>
            Identity Restored
          </p>
          {recoveredUser && (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Welcome back, {String(recoveredUser.custom_display_name || recoveredUser.username || 'user')}!
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push(`/a/${recoveredUser?.username || ''}`)}
              className="premium-btn premium-btn-primary"
            >
              Go to Profile
            </button>
            <button
              onClick={() => router.push('/')}
              className="premium-btn premium-btn-secondary"
            >
              Go Home
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {words.map((word, i) => (
              <div key={i}>
                <label
                  style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}
                >
                  {i + 1}
                </label>
                <input
                  type="text"
                  value={word}
                  onChange={(e) => handleWordChange(i, e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text').trim().toLowerCase();
                    const pasted = text.split(/\s+/);
                    if (pasted.length === 12) {
                      setWords(pasted);
                    } else if (pasted.length === 1) {
                      handleWordChange(i, pasted[0]);
                    }
                  }}
                  placeholder="word"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  style={{
                    width: '100%',
                    padding: '10px 8px',
                    background: 'var(--bg-tertiary)',
                    border: `1.5px solid ${isValid ? '#4caf50' : 'var(--border-primary)'}`,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '14px',
                    fontFamily: 'Geist Mono, ui-monospace, SFMono-Regular, monospace',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'var(--transition)',
                  }}
                  onFocus={(e) => {
                    if (!isValid) e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = isValid ? '#4caf50' : 'var(--border-primary)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            ))}
          </div>

          {!isValid && words.some((w) => w.trim()) && (
            <p style={{ color: '#f57c00', fontSize: '12px', marginBottom: '16px' }}>
              Enter all 12 words from your seed phrase. Words must be from the BIP39 wordlist.
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <button
              onClick={handleClaim}
              disabled={!isValid || step === 'signing'}
              className="premium-btn premium-btn-primary"
              style={{
                opacity: step === 'signing' ? 0.6 : !isValid ? 0.5 : 1,
                cursor: !isValid ? 'not-allowed' : 'pointer',
              }}
            >
              {step === 'signing' ? 'Verifying...' : 'Claim Identity'}
            </button>

            <button
              onClick={handlePaste}
              className="premium-btn premium-btn-secondary"
              style={{ fontSize: '13px', padding: '12px 16px' }}
            >
              Paste from Clipboard
            </button>
          </div>

          <details style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Where do I find my seed phrase?
            </summary>
            <p style={{ margin: '0 0 8px 0', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              When you generated your seed phrase in the &ldquo;Secure My Authority&rdquo; section
              of your profile page, you were shown 12 words. You should have written them down
              or saved them somewhere safe.
            </p>
            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              If you lost your seed phrase, your identity cannot be recovered. This is by design
              &mdash; the same security model used by cryptocurrency wallets.
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
