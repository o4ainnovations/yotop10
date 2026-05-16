import { apiFetch } from '../client';
import type { ArticlesResponse, Article, ArticleSubmission } from '../types';

export const articlesApi = {
  getArticles: (params?: { page?: number; limit?: number; category?: string }): Promise<ArticlesResponse> => {
    const p = params?.page || 1;
    const l = params?.limit || 20;
    const cat = params?.category ? `&category=${params.category}` : '';
    return apiFetch(`/articles?page=${p}&limit=${l}${cat}`);
  },

  getArticle: (slug: string): Promise<{ article: Article }> =>
    apiFetch(`/articles/${slug}`),

  submitArticle: (data: ArticleSubmission) =>
    apiFetch<{ success: boolean; article: { id: string; slug: string; title: string } }>(
      '/articles',
      { method: 'POST', body: JSON.stringify(data) }
    ),
};
