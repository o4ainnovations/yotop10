const DEFAULT_CONCURRENCY = 5;

export async function processBatch<T>(
  items: T[],
  processor: (item: T, index: number) => Promise<void>,
  concurrency: number = DEFAULT_CONCURRENCY
): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];
  let index = 0;

  while (index < items.length) {
    const batch = items.slice(index, index + concurrency);
    const results = await Promise.allSettled(
      batch.map((item) => processor(item, index++).catch((err) => { throw err; }))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        succeeded++;
      } else {
        failed++;
        errors.push(result.reason?.message || 'Unknown error');
      }
    }
  }

  return { succeeded, failed, errors };
}
