import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { calculateTrustScore } from '../lib/trustScore';

dotenv.config();

/**
 * Recalculate trust scores for all existing users
 * Run once after deploying trust score system
 */
const recalculateAllTrustScores = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yotop10';
  await mongoose.connect(mongoUri);

  console.log('🔄 Recalculating trust scores for all users...');

  const users = await User.find({});
  let updated = 0;

  for (const user of users) {
    try {
      await calculateTrustScore(user.user_id);
      updated++;
    } catch (error) {
      console.error(`Failed to calculate trust score for user ${user.user_id}:`, error);
    }
  }

  console.log(`✅ Trust scores recalculated for ${updated} users`);
  await mongoose.disconnect();
};

recalculateAllTrustScores().catch(console.error);
