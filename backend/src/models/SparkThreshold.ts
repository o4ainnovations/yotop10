import mongoose, { Schema, Document } from 'mongoose';

export interface ISparkThreshold extends Document {
  percentile_99: number; // S-Rank threshold
  percentile_95: number; // A-Rank threshold
  percentile_85: number; // B-Rank threshold
  percentile_70: number; // C-Rank threshold
  calculated_at: Date;
}

const sparkThresholdSchema = new Schema<ISparkThreshold>({
  percentile_99: { type: Number, default: 0 },
  percentile_95: { type: Number, default: 0 },
  percentile_85: { type: Number, default: 0 },
  percentile_70: { type: Number, default: 0 },
  calculated_at: { type: Date, default: Date.now },
});

export const SparkThreshold = mongoose.model<ISparkThreshold>('SparkThreshold', sparkThresholdSchema);

// Floor multipliers based on rank
export const FLOOR_MULTIPLIERS = {
  S_RANK: 0.20,  // Top 1% - stays at 20% of peak
  A_RANK: 0.12,  // Top 5% - stays at 12% of peak
  B_RANK: 0.07,  // Top 15% - stays at 7% of peak
  C_RANK: 0.03,  // Top 30% - stays at 3% of peak
  STANDARD: 0.00, // Below 70th percentile - sinks to zero
};

// Calculate floor multiplier based on base score and thresholds
export const getFloorMultiplier = (baseScore: number, thresholds: ISparkThreshold): number => {
  if (baseScore >= thresholds.percentile_99) return FLOOR_MULTIPLIERS.S_RANK;
  if (baseScore >= thresholds.percentile_95) return FLOOR_MULTIPLIERS.A_RANK;
  if (baseScore >= thresholds.percentile_85) return FLOOR_MULTIPLIERS.B_RANK;
  if (baseScore >= thresholds.percentile_70) return FLOOR_MULTIPLIERS.C_RANK;
  return FLOOR_MULTIPLIERS.STANDARD;
};
