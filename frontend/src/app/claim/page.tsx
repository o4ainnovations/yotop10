'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateMnemonic, mnemonicToKeyPair, signChallenge } from '@/lib/identity';
import { API } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';

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
    <div className="min-h-screen bg-zinc-950 px-3 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold text-white sm:text-3xl">Claim Your Identity</h1>
          <p className="text-sm leading-relaxed text-zinc-400">
            Enter your 12-word seed phrase to recover your identity on this device. Your full reputation and history will be restored.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 text-sm2 text-orange-400 sm:p-4">
            <Icon name="TriangleAlert" size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'done' ? (
          <div className="rounded-2xl border border-orange-500/30 bg-white/5 p-6 text-center backdrop-blur-sm sm:p-8">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 sm:h-16 sm:w-16">
              <Icon name="Check" size={28} className="text-orange-400 sm:size-8" />
            </div>
            <p className="mb-2 text-lg font-bold text-white">
              Identity Restored
            </p>
            {recoveredUser && (
              <p className="mb-5 text-sm text-zinc-400">
                Welcome back, {String(recoveredUser.custom_display_name || recoveredUser.username || 'user')}!
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={() => router.push(`/a/${recoveredUser?.username || ''}`)}
                className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98]"
              >
                Go to Profile
              </button>
              <button
                onClick={() => router.push('/')}
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-300 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10"
              >
                Go Home
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 grid grid-cols-4 gap-2">
              {words.map((word, i) => (
                <div key={i}>
                  <label className="mb-1 block text-3xs font-semibold text-zinc-600">
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
                    className={`w-full rounded-xl border bg-white/5 px-2.5 py-2.5 text-sm font-mono text-white placeholder:text-zinc-600 outline-none transition sm:px-3 sm:py-3 ${
                      isValid
                        ? 'border-orange-500/50 ring-1 ring-orange-500/20'
                        : 'border-white/10 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20'
                    }`}
                  />
                </div>
              ))}
            </div>

            {!isValid && words.some((w) => w.trim()) && (
              <p className="mb-4 text-xs text-amber-500">
                Enter all 12 words from your seed phrase. Words must be from the BIP39 wordlist.
              </p>
            )}

            <div className="mb-6 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleClaim}
                disabled={!isValid || step === 'signing'}
                className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step === 'signing' ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Verifying...
                  </span>
                ) : (
                  'Claim Identity'
                )}
              </button>

              <button
                onClick={handlePaste}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-300 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="Clipboard" size={14} />
                  Paste
                </span>
              </button>
            </div>

            <details className="text-sm2">
              <summary className="cursor-pointer font-medium text-zinc-400 transition hover:text-zinc-300">
                Where do I find my seed phrase?
              </summary>
              <p className="mt-2 leading-relaxed text-zinc-500">
                When you generated your seed phrase in the &ldquo;Secure My Authority&rdquo; section
                of your profile page, you were shown 12 words. You should have written them down
                or saved them somewhere safe.
              </p>
              <p className="mt-2 leading-relaxed text-zinc-500">
                If you lost your seed phrase, your identity cannot be recovered. This is by design
                &mdash; the same security model used by cryptocurrency wallets.
              </p>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
