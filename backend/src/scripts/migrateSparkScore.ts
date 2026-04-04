import mongoose from 'mongoose';
import { Comment } from '../models/Comment';
import { SparkThreshold, getFloorMultiplier, ISparkThreshold } from '../models/SparkThreshold';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';

// Calculate thresholds from existing comments
const calculateAndStoreThresholds = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const comments = await Comment.find({
    created_at: { $gte: thirtyDaysAgo }
  });
  
  if (comments.length === 0) {
    console.log('No comments in last 30 days to calculate thresholds');
    return;
  }
  
  const baseScores: number[] = [];
  for (const comment of comments) {
    const baseScore = (comment.reply_count * 2.0) + (comment.fire_count * 0.5) + 3;
    baseScores.push(baseScore);
  }
  
  const sortedScores = [...baseScores].sort((a, b) => a - b);
  
  const getPercentile = (sortedArr: number[], percentile: number): number => {
    if (sortedArr.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
  };
  
  const threshold = await SparkThreshold.create({
    percentile_99: getPercentile(sortedScores, 99),
    percentile_95: getPercentile(sortedScores, 95),
    percentile_85: getPercentile(sortedScores, 85),
    percentile_70: getPercentile(sortedScores, 70),
    calculated_at: new Date(),
  });
  
  console.log(`Thresholds created: 99th=${threshold.percentile_99.toFixed(2)}, 95th=${threshold.percentile_95.toFixed(2)}, 85th=${threshold.percentile_85.toFixed(2)}, 70th=${threshold.percentile_70.toFixed(2)}`);
  return threshold;
};

// Calculate spark score with floor
const calculateSparkScore = (fireCount: number, replyCount: number, createdAt: Date, thresholds: ISparkThreshold): number => {
  const now = new Date();
  const ageInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  
  const baseScore = (replyCount * 2.0) + (fireCount * 0.5) + 3;
  
  const denominator = replyCount + fireCount + 1;
  const ratio = replyCount / denominator;
  const gamma = Math.max(1.1, 2.0 - ratio);
  
  const currentDecayRank = baseScore / Math.pow(ageInHours + 1, gamma);
  
  const floorMultiplier = getFloorMultiplier(baseScore, thresholds);
  const floorValue = baseScore * floorMultiplier;
  
  return Math.max(0, Math.max(currentDecayRank, floorValue));
};

// Comment doc interface
interface CommentDoc {
  get(name: string): unknown;
  created_at: Date;
}

// Calculate parent spark score with floor
const calculateParentSparkScore = async (comment: CommentDoc, children: CommentDoc[], thresholds: ISparkThreshold): Promise<number> => {
  const now = new Date();
  const replyCount = comment.get('reply_count') as number || 0;
  const fireCount = comment.get('fire_count') as number || 0;
  const createdAt = comment.get('created_at') as Date;
  const ageInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  
  let childFires = 0;
  let childReplies = 0;
  for (const child of children) {
    const c = child as unknown as { fire_count: number; reply_count: number };
    childFires += c.fire_count || 0;
    childReplies += c.reply_count || 0;
  }
  
  const parentBase = (replyCount * 2.0) + (fireCount * 0.5) + 3;
  const childContribution = (childFires * 0.25) + (childReplies * 1.0);
  const numerator = parentBase + childContribution;
  
  const totalReplies = replyCount + childReplies;
  const totalFires = fireCount + childFires;
  const denominator = totalReplies + totalFires + 1;
  const ratio = totalReplies / denominator;
  const gamma = Math.max(1.1, 2.0 - ratio);
  
  const currentDecayRank = numerator / Math.pow(ageInHours + 1, gamma);
  
  const floorMultiplier = getFloorMultiplier(parentBase, thresholds);
  const floorValue = parentBase * floorMultiplier;
  
  return Math.max(0, Math.max(currentDecayRank, floorValue));
};

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  
  // Calculate and store thresholds
  console.log('Calculating percentile thresholds...');
  const thresholds = await calculateAndStoreThresholds();
  
  if (!thresholds) {
    console.log('Migration aborted: could not calculate thresholds');
    await mongoose.disconnect();
    process.exit(1);
  }
  
  console.log('Fetching ALL comments for recalculation...');
  const comments = await Comment.find({});
  
  console.log(`Found ${comments.length} comments to recalculate`);
  
  let updated = 0;
  
  // Sort by depth descending so children are processed before parents
  const sortedComments = [...comments].sort((a, b) => {
    const aDepth = a.get('depth') as number;
    const bDepth = b.get('depth') as number;
    if (aDepth !== bDepth) return bDepth - aDepth;
    return (a.get('created_at') as Date).getTime() - (b.get('created_at') as Date).getTime();
  });
  
  for (const comment of sortedComments) {
    const commentId = comment.get('_id') as mongoose.Types.ObjectId;
    let sparkScore: number;
    
    if (comment.get('depth') === 0) {
      // Parent comment
      const children = await Comment.find({ parent_comment_id: commentId });
      sparkScore = await calculateParentSparkScore(
        comment as unknown as CommentDoc, 
        children as unknown as CommentDoc[], 
        thresholds
      );
    } else {
      // Child comment
      sparkScore = calculateSparkScore(
        comment.get('fire_count') as number || 0,
        comment.get('reply_count') as number || 0,
        comment.get('created_at') as Date,
        thresholds
      );
    }
    
    await Comment.findByIdAndUpdate(commentId, {
      spark_score: sparkScore,
      last_engaged_at: comment.get('updated_at') || comment.get('created_at')
    });
    
    updated++;
    if (updated % 100 === 0) {
      console.log(`Updated ${updated}/${sortedComments.length} comments`);
    }
  }
  
  console.log(`Migration complete. Updated ${updated} comments with Relative Excellence floor.`);
  
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
