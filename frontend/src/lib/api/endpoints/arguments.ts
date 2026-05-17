import { apiFetch } from '../client';
import type { ArgumentsResponse } from '../types';

export const argumentsApi = {
  getArguments: (params?: { page?: number; limit?: number; category?: string; time?: string }) => {
    const p = params?.page || 1;
    const l = params?.limit || 20;
    const cat = params?.category ? `&category=${params.category}` : '';
    const t = params?.time ? `&time=${params.time}` : '';
    return apiFetch<ArgumentsResponse>(`/arguments?page=${p}&limit=${l}${cat}${t}`);
  },
};
