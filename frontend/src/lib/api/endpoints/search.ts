import { apiFetch } from '../client';

export const searchApi = {
  search: (params: Record<string, string>) =>
    apiFetch(`/search?${new URLSearchParams(params)}`),

  autocomplete: (q: string, options?: RequestInit) =>
    apiFetch(`/search/autocomplete?q=${encodeURIComponent(q)}`, options),
};
