import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../models/Category', () => ({
  Category: {
    find: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../lib/adminAuth', () => ({
  adminAuthMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  generateAdminToken: vi.fn(),
  AdminAuthRequest: {},
}));

import categoriesRouter from '../routes/categories';
import { Category } from '../models/Category';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/categories', categoriesRouter);
  return app;
}

const mockCategory = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => overrides._id?.toString() || 'cat123' },
  name: 'Test Category',
  slug: 'test-category',
  description: 'A test category',
  icon: '📁',
  post_count: 5,
  is_featured: false,
  parent_id: null,
  ...overrides,
});

describe('GET /api/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns hierarchical categories when include_children=true', async () => {
    const parent = mockCategory({ _id: { toString: () => 'p1' }, name: 'Parent' });
    const child = mockCategory({
      _id: { toString: () => 'c1' },
      name: 'Child',
      parent_id: { toString: () => 'p1' },
    });

    vi.mocked(Category.find).mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([parent, child]),
    } as unknown as ReturnType<typeof Category.find>);

    const res = await request(createApp()).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].name).toBe('Parent');
    expect(res.body.categories[0].children).toHaveLength(1);
    expect(res.body.categories[0].children[0].name).toBe('Child');
  });

  it('returns flat list when include_children=false', async () => {
    const cat = mockCategory();
    vi.mocked(Category.find).mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([cat]),
    } as unknown as ReturnType<typeof Category.find>);

    const res = await request(createApp()).get('/api/categories?include_children=false');

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].name).toBe('Test Category');
  });

  it('returns empty array when no categories exist', async () => {
    vi.mocked(Category.find).mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof Category.find>);

    const res = await request(createApp()).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([]);
  });

  it('returns 500 when Category.find throws', async () => {
    vi.mocked(Category.find).mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockRejectedValue(new Error('DB down')),
    } as unknown as ReturnType<typeof Category.find>);

    const res = await request(createApp()).get('/api/categories');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch categories');
  });
});

describe('GET /api/categories/:slug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a single category', async () => {
    const cat = mockCategory();
    vi.mocked(Category.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(cat),
    } as unknown as ReturnType<typeof Category.findOne>);

    vi.mocked(Category.find).mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof Category.find>);

    const res = await request(createApp()).get('/api/categories/test-cat');

    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe('Test Category');
  });

  it('returns 404 when category not found', async () => {
    vi.mocked(Category.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof Category.findOne>);

    const res = await request(createApp()).get('/api/categories/nonexistent');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/categories (admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when slug already exists', async () => {
    vi.mocked(Category.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ slug: 'existing' }),
    } as unknown as ReturnType<typeof Category.findOne>);

    const res = await request(createApp())
      .post('/api/categories')
      .send({ name: 'Existing', slug: 'existing' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already exists');
  });
});
