'use client';

import { useState } from 'react';

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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && confirmed) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '28px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
          Your Seed Phrase
        </h2>

        <div
          style={{
            backgroundColor: '#fff3e0',
            border: '2px solid #ff9800',
            borderRadius: '8px',
            padding: '12px',
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
                padding: '6px 8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'monospace',
              }}
            >
              <span style={{ color: '#888', fontSize: '11px' }}>{i + 1}</span>
              <span>{word}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            onClick={handleCopy}
            style={{
              padding: '8px 16px',
              backgroundColor: copied ? '#e8f5e9' : '#f5f5f5',
              border: `1px solid ${copied ? '#4caf50' : '#ccc'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              color: copied ? '#2e7d32' : '#333',
            }}
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input
            type="checkbox"
            id="seed-confirm"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ width: '18px', height: '18px' }}
          />
          <label htmlFor="seed-confirm" style={{ fontSize: '13px', cursor: 'pointer' }}>
            I have saved my seed phrase securely
          </label>
        </div>

        <button
          onClick={onClose}
          disabled={!confirmed}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: confirmed ? '#1565c0' : '#bdbdbd',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
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
