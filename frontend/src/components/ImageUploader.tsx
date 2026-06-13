'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Icon } from './icons/Icon';

interface ImageUploaderProps {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  label?: string;
  className?: string;
}

export function ImageUploader({ currentUrl, onUpload, label = 'Cover Image', className = '' }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body, credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const url = data.file?.hero_lg || data.file?.original || data.url;
      if (!url) throw new Error('No URL returned');
      setPreview(url);
      onUpload(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</label>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-400 hover:border-orange-500/30 hover:text-orange-400 transition disabled:opacity-50"
        >
          {uploading ? (
            <span className="flex items-center gap-2">
              <Icon name="RefreshCw" size={14} className="animate-spin" />
              Uploading...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Icon name="Image" size={14} />
              {preview ? 'Replace' : 'Upload'}
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFile}
          className="hidden"
        />
        {error && <span className="text-xs text-red-400 self-center">{error}</span>}
      </div>
      {preview && (
        <div className="mt-3 relative rounded-xl overflow-hidden border border-white/10 bg-white/5">
          <Image src={preview} alt="" width={600} height={338} className="w-full h-40 object-cover" unoptimized />
          <button
            type="button"
            onClick={() => { setPreview(null); onUpload(''); }}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white/80 hover:text-white transition"
            aria-label="Remove"
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
