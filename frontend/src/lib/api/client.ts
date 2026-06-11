export function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_INTERNAL_API_URL || 'http://backend:8000/api';
  }
  return '/api';
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  retryCount = 0
): Promise<T> {
  const MAX_RETRIES = 3;
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  let deviceFingerprint: string | null = null;
  if (typeof window !== 'undefined') {
    try { deviceFingerprint = localStorage.getItem('yotop10_fp'); } catch { /* private browsing */ }
  }

  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  if (deviceFingerprint) {
    headers['X-Device-Fingerprint'] = deviceFingerprint;
  }

  // Always send Tier 0 machine-stable signals for cross-browser matching
  if (typeof window !== 'undefined') {
    try {
      headers['X-Tier0'] = JSON.stringify({
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        colorDepth: window.screen.colorDepth,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        timezoneOffset: new Date().getTimezoneOffset(),
        platform: navigator.platform || 'unknown',
        devicePixelRatio: window.devicePixelRatio,
        maxTouchPoints: navigator.maxTouchPoints || 0,
      });
    } catch {}
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, credentials: 'include' });

    // Capture fingerprint merge token if present (cross-browser identity linking)
    const mergeToken = response.headers.get('x-merge-token');
    if (mergeToken && typeof window !== 'undefined') {
      try { sessionStorage.setItem('yotop10_merge_token', mergeToken); } catch {}
    }
  } catch (err) {
    // Network error (ECONNREFUSED, DNS failure, etc.) — backend unreachable
    throw new Error(`API Network Error: ${url} - ${(err as Error).message}`);
  }

  if (response.status === 425) {
    if (retryCount >= MAX_RETRIES) {
      throw new Error(`API Error: 425 Too Early - Max retries (${MAX_RETRIES}) exceeded`);
    }
    await new Promise(r => setTimeout(r, 500));
    return apiFetch(endpoint, options, retryCount + 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const text = await response.text();
  if (!text || text.trim() === '') {
    throw new Error(`API Error: Empty response body from ${url}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`API Error: Invalid JSON response from ${url}`);
  }
}
