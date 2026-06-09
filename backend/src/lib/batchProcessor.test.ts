import { describe, it, expect } from 'vitest';
import { processBatch } from './batchProcessor';

describe('processBatch', () => {
  it('processes all items', async () => {
    const results: number[] = [];
    const { succeeded, failed, errors } = await processBatch(
      [1, 2, 3],
      async (item) => { results.push(item * 2); },
    );
    expect(succeeded).toBe(3);
    expect(failed).toBe(0);
    expect(errors).toEqual([]);
    expect(results).toEqual([2, 4, 6]);
  });

  it('handles empty input', async () => {
    const { succeeded, failed, errors } = await processBatch([], async () => {});
    expect(succeeded).toBe(0);
    expect(failed).toBe(0);
    expect(errors).toEqual([]);
  });

  it('handles errors without crashing', async () => {
    const { succeeded, failed, errors } = await processBatch(
      [1, 2, 3],
      async (item) => {
        if (item === 2) throw new Error('Item 2 failed');
      },
    );
    expect(succeeded).toBe(2);
    expect(failed).toBe(1);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Item 2 failed');
  });

  it('uses custom concurrency', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const { succeeded, failed } = await processBatch(
      [1, 2, 3, 4, 5, 6],
      async (item) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(r => setTimeout(r, 10));
        concurrent--;
      },
      2,
    );
    expect(succeeded).toBe(6);
    expect(failed).toBe(0);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
