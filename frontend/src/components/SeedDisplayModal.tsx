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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && confirmed) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--text-primary)' }}>
          Your Seed Phrase
        </h2>

        <div
          style={{
            backgroundColor: 'rgba(255,152,0,0.08)',
            border: '2px solid #ff9800',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#e65100',
            lineHeight: 1.5,
          }}
        >
          <strong>Write this down and store it securely.</strong> Anyone with this phrase can take over your identity. We do not store it and cannot recover it.
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          {words.map((word, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 10px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                fontFamily: 'Geist Mono, monospace',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{i + 1}</span>
              <span>{word}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={handleCopy}
            style={{
              padding: '8px 16px',
              backgroundColor: copied ? 'rgba(46,125,50,0.1)' : 'var(--bg-tertiary)',
              border: `1px solid ${copied ? '#4caf50' : 'var(--border-primary)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '13px',
              color: copied ? '#2e7d32' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {copied ? <><Icon name="Check" size={14} color="#2e7d32" /> Copied!</> : <><Icon name="Clipboard" size={14} /> Copy to Clipboard</>}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input
            type="checkbox"
            id="seed-confirm"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
          />
          <label htmlFor="seed-confirm" style={{ fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            I have saved my seed phrase securely
          </label>
        </div>

        <button
          onClick={onClose}
          disabled={!confirmed}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: confirmed ? 'var(--accent-gradient)' : 'var(--border-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: confirmed ? 'pointer' : 'not-allowed',
            fontSize: '15px',
            fontWeight: 'bold',
          }}
        >
          I Understand, Close
        </button>
      </div>
    </div>
  );
}
