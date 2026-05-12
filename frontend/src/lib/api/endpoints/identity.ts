import { apiFetch } from '../client';

export const identityApi = {
  getStatus: () => apiFetch<{
    has_seed: boolean;
    authority_id: string | null;
    seed_generated_at: string | null;
    devices_linked: number;
  }>('/identity/status'),

  generateKey: (authorityId: string) =>
    apiFetch<{ success: boolean; authority_id: string; device_linked: boolean }>(
      '/identity/generate-key',
      {
        method: 'POST',
        body: JSON.stringify({ authority_id: authorityId }),
      }
    ),

  requestChallenge: (authorityId: string, deviceFingerprint: string) =>
    apiFetch<{ challenge: string }>('/identity/claim', {
      method: 'POST',
      body: JSON.stringify({ authority_id: authorityId, device_fingerprint: deviceFingerprint }),
    }),

  verifyClaim: (authorityId: string, challenge: string, signature: string, deviceFingerprint: string) =>
    apiFetch<{ success: boolean; user: Record<string, unknown> }>(
      '/identity/claim/verify',
      {
        method: 'POST',
        body: JSON.stringify({
          authority_id: authorityId,
          challenge,
          signature,
          device_fingerprint: deviceFingerprint,
        }),
      }
    ),

  linkDevice: (deviceFingerprint?: string) =>
    apiFetch<{ success: boolean; devices_linked: number }>('/identity/link', {
      method: 'POST',
      body: JSON.stringify(
        deviceFingerprint ? { device_fingerprint: deviceFingerprint } : {}
      ),
    }),

  getDevices: () =>
    apiFetch<{
      devices: Array<{
        device_fingerprint: string;
        label: string | null;
        linked_at: string;
        is_current: boolean;
      }>;
    }>('/identity/devices'),

  unlinkDevice: (deviceFingerprint: string) =>
    apiFetch<{ success: boolean }>(`/identity/devices/${deviceFingerprint}`, {
      method: 'DELETE',
    }),
};
