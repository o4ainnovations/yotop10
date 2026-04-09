/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import FingerprintJS from '@fingerprintjs/fingerprintjs';

// Initialize agent once
let fpAgent: any | null = null;

export const getFingerprint = async (): Promise<string> => {
  // Return cached if available
  const cached = localStorage.getItem('yotop10_fp');
  if (cached) return cached;

  // Initialize agent if not already
  if (!fpAgent) {
    fpAgent = await FingerprintJS.load();
  }

  // Get full fingerprint
  const result = await fpAgent.get();
  
  // Use the visitorId which is the stable hash
  const fingerprint = result.visitorId;
  
  // Store permanently
  localStorage.setItem('yotop10_fp', fingerprint);
  
  return fingerprint;
};

// Initialize on module load - start fingerprinting immediately
if (typeof window !== 'undefined') {
  getFingerprint().catch(() => {
    // Fallback to simple random fingerprint if library fails
    const fallback = 'fp_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('yotop10_fp', fallback);
  });
}
