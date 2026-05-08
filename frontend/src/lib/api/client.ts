export function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_URL || 'http://localhost:8000/api';
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

  const response = await fetch(url, { ...options, headers, credentials: 'include' });

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
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`API Error: ${response.status} ${response.statusText} - Invalid JSON response`);
  }
}
