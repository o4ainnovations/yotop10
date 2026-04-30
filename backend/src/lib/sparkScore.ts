import { SparkThreshold, getFloorMultiplier } from '../models/SparkThreshold';

export interface SparkScoreParams {
  fireCount: number;
  replyCount: number;
  createdAt: Date;
}

export interface ParentSparkScoreParams extends SparkScoreParams {
  childFires: number;
  childReplies: number;
}

export function getPercentileValue(sortedArr: number[], percentile: number): number {
  if (sortedArr.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(index, sortedArr.length - 1))];
}

export async function getThresholds() {
  const threshold = await SparkThreshold.findOne().sort({ calculated_at: -1 });
  if (threshold) return threshold;

  const defaultThreshold = new SparkThreshold({
    percentile_99: 50,
    percentile_95: 30,
    percentile_85: 15,
    percentile_70: 8,
    calculated_at: new Date(),
  });
  return defaultThreshold;
}

function calculateGravity(replies: number, fires: number): number {
  const denominator = replies + fires + 1;
  const ratio = replies / denominator;
  return Math.max(1.1, 2.0 - ratio);
}

function calculateBaseScore(replies: number, fires: number): number {
  return (replies * 2.0) + (fires * 0.5) + 3;
}

export function computeSparkScore(
  { fireCount, replyCount, createdAt }: SparkScoreParams,
  thresholds: InstanceType<typeof SparkThreshold>
): number {
  const ageInHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const baseScore = calculateBaseScore(replyCount, fireCount);
  const gamma = calculateGravity(replyCount, fireCount);
  const currentDecayRank = baseScore / Math.pow(ageInHours + 1, gamma);
  const floorValue = baseScore * getFloorMultiplier(baseScore, thresholds);
  return Math.max(0, Math.max(currentDecayRank, floorValue));
}

export function computeParentSparkScore(
  { fireCount, replyCount, createdAt, childFires, childReplies }: ParentSparkScoreParams,
  thresholds: InstanceType<typeof SparkThreshold>
): number {
  const ageInHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const parentBase = calculateBaseScore(replyCount, fireCount);
  const childContribution = (childFires * 0.25) + (childReplies * 1.0);
  const numerator = parentBase + childContribution;
  const gamma = calculateGravity(replyCount + childReplies, fireCount + childFires);
  const currentDecayRank = numerator / Math.pow(ageInHours + 1, gamma);
  const floorValue = parentBase * getFloorMultiplier(parentBase, thresholds);
  return Math.max(0, Math.max(currentDecayRank, floorValue));
}
