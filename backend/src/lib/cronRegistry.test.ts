import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CronRegistry } from './cronRegistry';

describe('CronRegistry', () => {
  let registry: CronRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new CronRegistry();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers and runs a cron job', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register({ name: 'test', interval: 1000, handler, startDelay: 0 });

    // Fast-forward past the initial delay + first interval
    await vi.advanceTimersByTimeAsync(1100);
    expect(handler).toHaveBeenCalled();
    expect(registry.getStatus()).toHaveLength(1);
    expect(registry.getStatus()[0].name).toBe('test');
  });

  it('stops all jobs on graceful shutdown', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register({ name: 'test', interval: 1000, handler, startDelay: 0 });

    await registry.gracefulShutdown();

    // Advance time — handler should not be called after shutdown
    handler.mockClear();
    await vi.advanceTimersByTimeAsync(5000);
    expect(handler).not.toHaveBeenCalled();
  });

  it('throws if duplicate name registered', () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register({ name: 'dup', interval: 1000, handler });
    expect(() => registry.register({ name: 'dup', interval: 1000, handler })).toThrow('already registered');
  });

  it('does not run job during shutdown', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register({ name: 'test', interval: 50000, handler, startDelay: 0 });

    await registry.gracefulShutdown();
    handler.mockClear();

    // Advance well past the interval
    await vi.advanceTimersByTimeAsync(100000);
    expect(handler).not.toHaveBeenCalled();
  });
});
