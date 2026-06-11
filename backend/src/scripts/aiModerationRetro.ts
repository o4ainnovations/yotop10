/**
 * Retroactive AI Moderation — queues all existing pending_review posts
 * for AI quality scoring.
 *
 * Run: node dist/scripts/aiModerationRetro.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Post } from '../models/Post';
import { queuePostForAiReview } from '../lib/aiModerationWorker';

dotenv.config();

const BATCH_SIZE = 50;

async function retro() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const totalPosts = await Post.countDocuments({
      status: 'pending_review',
      ai_reviewed_at: null,
    });
    console.log(`Found ${totalPosts} un-reviewed pending posts`);

    let processed = 0;
    let skip = 0;

    while (processed < totalPosts) {
      const posts = await Post.find({
        status: 'pending_review',
        ai_reviewed_at: null,
      })
        .select('_id')
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();

      if (posts.length === 0) break;

      for (const post of posts) {
        await queuePostForAiReview((post as any)._id.toString());
        processed++;
        if (processed % 50 === 0) console.log(`Queued ${processed}/${totalPosts}`);
      }

      skip += BATCH_SIZE;
      // Small delay to avoid overwhelming Redis
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n✅ Queued ${processed} posts for AI review. The worker cron will process them.`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Retro error:', err);
    process.exit(1);
  }
}

retro();
