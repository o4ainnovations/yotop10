import mongoose from 'mongoose';
import { Comment } from '../models/Comment';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';

// Calculate Spark Score for parent comment with weighted child contributions
// Total_Score = Parent_Base_Score + (SUM(All_Child_Fires) * 0.25) + (SUM(All_Child_Replies) * 1.0)
const calculateParentSparkScore = async (commentId: mongoose.Types.ObjectId): Promise<number> => {
  const comment = await Comment.findById(commentId);
  if (!comment) return 0;
  
  const now = new Date();
  const ageInHours = (now.getTime() - comment.created_at.getTime()) / (1000 * 60 * 60);
  
  // Get all direct children of this comment
  const children = await Comment.find({ parent_comment_id: commentId });
  
  // Sum up children's fires and replies
  let childFires = 0;
  let childReplies = 0;
  for (const child of children) {
    childFires += child.fire_count || 0;
    childReplies += child.reply_count || 0;
  }
  
  // Parent base score
  const parentBase = (comment.reply_count * 2.0) + (comment.fire_count * 0.5) + 3;
  
  // Weighted child contributions
  const childContribution = (childFires * 0.25) + (childReplies * 1.0);
  
  // Total numerator before decay
  const numerator = parentBase + childContribution;
  
  // Calculate gravity
  const totalReplies = comment.reply_count + childReplies;
  const totalFires = comment.fire_count + childFires;
  const denominator = totalReplies + totalFires + 1;
  const ratio = totalReplies / denominator;
  const gamma = Math.max(1.1, 2.0 - ratio);
  
  // Apply time decay
  const sparkScore = numerator / Math.pow(ageInHours + 1, gamma);
  
  return Math.max(0, sparkScore);
};

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  
  console.log('Fetching ALL comments for recalculation...');
  const comments = await Comment.find({});
  
  console.log(`Found ${comments.length} comments to recalculate`);
  
  let updated = 0;
  
  // Process in reverse order (children first, then parents) to ensure children are updated before parents
  const sortedComments = [...comments].sort((a, b) => {
    // Sort by depth descending, then by created_at ascending
    if (a.depth !== b.depth) return b.depth - a.depth;
    return a.created_at.getTime() - b.created_at.getTime();
  });
  
  for (const comment of sortedComments) {
    // Calculate spark score based on whether it's a parent or not
    let sparkScore: number;
    
    if (comment.depth === 0) {
      // Parent comment - use weighted child contributions
      sparkScore = await calculateParentSparkScore(comment._id);
    } else {
      // Child comment - use simple formula
      const now = new Date();
      const ageInHours = (now.getTime() - comment.created_at.getTime()) / (1000 * 60 * 60);
      
      const denominator = comment.reply_count + comment.fire_count + 1;
      const ratio = comment.reply_count / denominator;
      const gamma = Math.max(1.1, 2.0 - ratio);
      
      const numerator = (comment.reply_count * 2.0) + (comment.fire_count * 0.5) + 3;
      sparkScore = Math.max(0, numerator / Math.pow(ageInHours + 1, gamma));
    }
    
    await Comment.findByIdAndUpdate(comment._id, {
      spark_score: sparkScore,
      last_engaged_at: comment.updated_at || comment.created_at
    });
    
    updated++;
    if (updated % 100 === 0) {
      console.log(`Updated ${updated}/${sortedComments.length} comments`);
    }
  }
  
  console.log(`Migration complete. Updated ${updated} comments with new Score Inheritance formula.`);
  
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
