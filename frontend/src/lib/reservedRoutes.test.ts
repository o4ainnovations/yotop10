import { describe, it, expect } from 'vitest';
import { RESERVED_ROUTES } from './reservedRoutes';

describe('RESERVED_ROUTES', () => {
  it('blocks admin route', () => { expect(RESERVED_ROUTES.has('admin')).toBe(true); });
  it('blocks api route', () => { expect(RESERVED_ROUTES.has('api')).toBe(true); });
  it('blocks search route', () => { expect(RESERVED_ROUTES.has('search')).toBe(true); });
  it('blocks login route', () => { expect(RESERVED_ROUTES.has('login')).toBe(true); });
  it('blocks categories route', () => { expect(RESERVED_ROUTES.has('categories')).toBe(true); });
  it('blocks submit route', () => { expect(RESERVED_ROUTES.has('submit')).toBe(true); });
  it('blocks explore route', () => { expect(RESERVED_ROUTES.has('explore')).toBe(true); });
  it('blocks articles route', () => { expect(RESERVED_ROUTES.has('articles')).toBe(true); });
  it('allows normal slug', () => { expect(RESERVED_ROUTES.has('top-10-movies')).toBe(false); });
  it('allows any random content slug', () => { expect(RESERVED_ROUTES.has('best-pizza-toppings')).toBe(false); });
});
