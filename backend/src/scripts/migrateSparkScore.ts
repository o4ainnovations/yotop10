import mongoose from 'mongoose';
import { Comment } from '../models/Comment';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';

const calculateSparkScore = (fireCount: number, replyCount: number, createdAt: Date): number => {
  const now = new Date();
  const ageInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  
  const denominator = replyCount + fireCount + 1;
  const ratio = replyCount / denominator;
  const gamma = Math.max(1.1, 2.0 - ratio);
  
  const numerator = (replyCount * 2.0) + (fireCount * 0.5) + 3;
  
  const rank = numerator / Math.pow(ageInHours + 1, gamma);
  
  return Math.max(0, rank);
};

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  
  console.log('Fetching all comments without spark_score or with spark_score = 0...');
  const comments = await Comment.find({
    $or: [
      { spark_score: { $exists: false } },
      { spark_score: { $eq: 0 } }
    ]
  });
  
  console.log(`Found ${comments.length} comments to migrate`);
  
  let updated = 0;
  for (const comment of comments) {
    const sparkScore = calculateSparkScore(
      comment.fire_count || 0,
      comment.reply_count || 0,
      comment.created_at
    );
    
    await Comment.findByIdAndUpdate(comment._id, {
      spark_score: sparkScore,
      last_engaged_at: comment.updated_at || comment.created_at
    });
    
    updated++;
    if (updated % 100 === 0) {
      console.log(`Updated ${updated}/${comments.length} comments`);
    }
  }
  
  console.log(`Migration complete. Updated ${updated} comments.`);
  
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
