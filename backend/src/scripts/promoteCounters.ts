/**
 * Counter-List SEO Promotion Cron
 *
 * Every counter-list starts as `noindex, follow`.
 * This cron runs periodically and promotes a counter to `index, follow` if:
 * 1. Its fire_count exceeds the parent's fire_count, OR
 * 2. Its fire_count >= 50 (significant community engagement)
 *
 * Run: node dist/scripts/promoteCounters.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Post } from '../models/Post';

dotenv.config();

async function promoteCounters() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find all counter-lists that are still noindex
    const counters = await Post.find({
      post_type: 'counter_list',
      meta_robots: 'noindex, follow',
      status: 'approved',
      deleted: { $ne: true },
    }).lean();

    let promoted = 0;

    for (const counter of counters) {
      const parentId = (counter as any).parent_id;
      if (!parentId) continue;

      let shouldPromote = false;

      // Check if counter fire_count >= 50 (significant engagement)
      if ((counter as any).fire_count >= 50) {
        shouldPromote = true;
      }

      // Check if counter fire_count exceeds parent
      if (!shouldPromote) {
        const parent = await Post.findById(parentId).select('fire_count').lean();
        if (parent && (counter as any).fire_count > (parent as any).fire_count) {
          shouldPromote = true;
        }
      }

      if (shouldPromote) {
        await Post.findByIdAndUpdate(counter._id, { meta_robots: 'index, follow' });
        console.log(`Promoted: ${(counter as any).slug} (fire: ${(counter as any).fire_count})`);
        promoted++;
      }
    }

    console.log(`\nPromoted ${promoted} counter-lists to index, follow`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Promote counters error:', err);
    process.exit(1);
  }
}

promoteCounters();
