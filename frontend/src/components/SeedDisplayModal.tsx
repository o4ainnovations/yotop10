'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';

interface SeedDisplayModalProps {
  words: string[];
  onClose: () => void;
}

export function SeedDisplayModal({ words, onClose }: SeedDisplayModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const mnemonic = words.join(' ');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && confirmed) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-7 max-w-[480px] w-full shadow-xl">
        <h2 className="mt-0 mb-2 text-xl text-white font-bold">
          Your Seed Phrase
        </h2>

        <div className="bg-orange-500/10 border-2 border-orange-500 rounded-xl p-3.5 mb-4 text-sm2 text-orange-500 leading-relaxed">
          <strong>Write this down and store it securely.</strong> Anyone with this phrase can take over your identity. We do not store it and cannot recover it.
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {words.map((word, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-2 bg-white/5 rounded-lg text-sm font-mono text-white border border-white/10"
            >
              <span className="text-white/40 text-3xs">{i + 1}</span>
              <span>{word}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={handleCopy}
            className={`px-4 py-2 rounded-xl cursor-pointer text-sm2 flex items-center gap-1.5 min-h-10 ${copied ? 'bg-green-500/10 border border-green-500 text-green-400' : 'bg-white/5 border border-white/10 text-white'}`}
          >
            {copied ? <><Icon name="Check" size={14} color="#2e7d32" /> Copied!</> : <><Icon name="Clipboard" size={14} /> Copy to Clipboard</>}
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="seed-confirm"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4.5 h-4.5 accent-orange-500"
          />
          <label htmlFor="seed-confirm" className="text-sm2 cursor-pointer text-white/60">
            I have saved my seed phrase securely
          </label>
        </div>

        <button
          onClick={onClose}
          disabled={!confirmed}
          className={`w-full py-3 text-white border-none rounded-xl cursor-pointer text-base2 font-bold min-h-11 ${confirmed ? 'bg-gradient-to-r from-orange-500 to-pink-500 cursor-pointer' : 'bg-white/10 cursor-not-allowed'}`}
        >
          I Understand, Close
        </button>
      </div>
    </div>
  );
}
