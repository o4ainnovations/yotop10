import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerSW } from './sw-register';

describe('registerSW', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue({ scope: '/' }),
      },
    });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
    });
  });

  it('is a function', () => {
    expect(typeof registerSW).toBe('function');
  });

  it('does not throw when called', () => {
    expect(() => registerSW()).not.toThrow();
  });

  it('registers load event listener', () => {
    registerSW();
    expect(window.addEventListener).toHaveBeenCalledWith(
      'load',
      expect.any(Function)
    );
  });

  it('does nothing when serviceWorker is not supported', () => {
    vi.stubGlobal('navigator', {});
    window.addEventListener = vi.fn();
    registerSW();
    expect(window.addEventListener).not.toHaveBeenCalled();
  });

  it('does nothing when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined);
    expect(() => registerSW()).not.toThrow();
  });
});
