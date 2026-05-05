import { Post } from '../models/Post';
import { Category } from '../models/Category';

let cronHandle: NodeJS.Timeout | null = null;

export async function reconcilePostCounts(): Promise<{ updated: number }> {
  const pipeline = [
    { $match: { status: 'approved' } },
    { $group: { _id: '$category_slug', count: { $sum: 1 } } },
  ];

  const counts = await Post.aggregate(pipeline);

  const slugCounts = new Map<string, number>();
  for (const { _id, count } of counts) {
    slugCounts.set(_id, count);
  }

  const categories = await Category.find({}, { slug: 1, post_count: 1 }).lean();

  const bulk = Category.collection.initializeUnorderedBulkOp();
  let updated = 0;

  for (const cat of categories) {
    const newCount = slugCounts.get(cat.slug) || 0;
    if (cat.post_count !== newCount) {
      bulk.find({ slug: cat.slug }).updateOne({ $set: { post_count: newCount } });
      updated++;
    }
  }

  if (updated > 0) {
    await bulk.execute();
  }

  return { updated };
}

export function startPostCountCron(): void {
  if (cronHandle) return;

  reconcilePostCounts()
    .then(({ updated }) => {
      if (updated > 0) console.log(`[Reconciler] Startup: corrected ${updated} category post counts`);
    })
    .catch((err) => console.error('[Reconciler] Startup error:', err));

  cronHandle = setInterval(() => {
    reconcilePostCounts()
      .then(({ updated }) => {
        if (updated > 0) console.log(`[Reconciler] Cron: corrected ${updated} category post counts`);
      })
      .catch((err) => console.error('[Reconciler] Cron error:', err));
  }, 5 * 60 * 1000);

  console.log('[Reconciler] Post count cron started (every 5 minutes)');
}

export function stopPostCountCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
    console.log('[Reconciler] Post count cron stopped');
  }
}
