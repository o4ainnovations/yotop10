import { apiFetch } from '../client';
import type { CategoriesResponse, SingleCategoryResponse } from '../types';

export const categoriesApi = {
  getCategories: (): Promise<CategoriesResponse> => apiFetch('/categories'),

  getCategory: (slug: string): Promise<SingleCategoryResponse> => apiFetch(`/categories/${slug}`),
};
