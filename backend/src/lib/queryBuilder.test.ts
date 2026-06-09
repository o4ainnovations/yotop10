import { describe, it, expect } from 'vitest';
import { QueryBuilder } from './queryBuilder';

describe('QueryBuilder', () => {
  it('starts with empty query', () => {
    const qb = new QueryBuilder();
    expect(qb.build()).toEqual({});
  });

  it('accepts default query', () => {
    const qb = new QueryBuilder({ status: 'approved', deleted: false });
    expect(qb.build()).toEqual({ status: 'approved', deleted: false });
  });

  it('adds simple field conditions', () => {
    const qb = new QueryBuilder().and('status', 'approved').and('deleted', false);
    expect(qb.build()).toEqual({ status: 'approved', deleted: false });
  });

  it('adds $ne condition', () => {
    const qb = new QueryBuilder().andNot('deleted', true);
    expect(qb.build()).toEqual({ deleted: { $ne: true } });
  });

  it('adds $or conditions', () => {
    const qb = new QueryBuilder().or({ title: 'a' }, { title: 'b' });
    expect(qb.build()).toEqual({ $or: [{ title: 'a' }, { title: 'b' }] });
  });

  it('combines $or with regular conditions', () => {
    const qb = new QueryBuilder({ status: 'approved' }).or({ title: 'a' }, { title: 'b' });
    expect(qb.build()).toEqual({ status: 'approved', $or: [{ title: 'a' }, { title: 'b' }] });
  });

  it('adds dateRange condition', () => {
    const qb = new QueryBuilder().dateRange('created_at', '2024-01-01', '2024-12-31');
    const result = qb.build();
    expect(result.created_at).toBeDefined();
    expect((result.created_at as Record<string, Date>).$gte).toBeInstanceOf(Date);
    expect((result.created_at as Record<string, Date>).$lte).toBeInstanceOf(Date);
  });

  it('safeRegex escapes special characters', () => {
    const qb = new QueryBuilder().safeRegex('username', '.*+?^${}()|[\]\\');
    const result = qb.build();
    expect(result.username).toEqual({ $regex: '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\', $options: 'i' });
  });

  it('safeRegex handles normal text', () => {
    const qb = new QueryBuilder().safeRegex('username', 'john_doe');
    const result = qb.build();
    expect(result.username).toEqual({ $regex: 'john_doe', $options: 'i' });
  });

  it('builds a realistic admin query', () => {
    const qb = new QueryBuilder({ status: 'pending_review', deleted: false })
      .safeRegex('author_username', 'test')
      .dateRange('created_at', '2024-06-01')
      .or({ title: { $regex: 'hello', $options: 'i' } }, { intro: { $regex: 'hello', $options: 'i' } });

    const result = qb.build();
    expect(result.status).toBe('pending_review');
    expect(result.deleted).toBe(false);
    expect(result.author_username).toBeDefined();
    expect((result.author_username as Record<string, string>).$regex).toBe('test');
    expect(result.$or).toBeDefined();
    expect(Array.isArray(result.$or)).toBe(true);
  });
});
