import { apiFetch } from '../client';

export const reactionsApi = {
  toggleReaction: (target_type: 'comment', target_id: string) =>
    apiFetch('/reactions', {
      method: 'POST',
      body: JSON.stringify({ target_type, target_id }),
    }),

  getReactionState: (targets: Array<{ type: string; id: string }>, options?: RequestInit) =>
    apiFetch(`/reactions/state?targets=${encodeURIComponent(JSON.stringify(targets))}`, options),
};
