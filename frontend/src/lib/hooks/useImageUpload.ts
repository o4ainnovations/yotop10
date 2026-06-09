'use client';

import { useState, useCallback } from 'react';

export function useImageUpload() {
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingItem, setUploadingItem] = useState(false);

  const uploadImage = useCallback(async (file: File, type: 'hero' | 'item'): Promise<string | null> => {
    const setUploading = type === 'hero' ? setUploadingHero : setUploadingItem;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/profile', {
        method: 'POST', body: formData, credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json() as { success: boolean; url: string };
      return data.url || null;
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { uploadImage, uploadingHero, uploadingItem };
}
