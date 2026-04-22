import mongoose, { Schema, Document } from 'mongoose';

export interface IFingerprintObservation extends Document {
  user_id: string;
  fingerprint_hash: string;
  tier1: Record<string, any>;
  tier2: Record<string, any>;
  observed_at: Date;
}

const fingerprintObservationSchema = new Schema<IFingerprintObservation>(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    fingerprint_hash: {
      type: String,
      required: true,
      index: true,
    },
    tier1: {
      type: Map,
      of: Schema.Types.Mixed,
      required: true,
    },
    tier2: {
      type: Map,
      of: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

fingerprintObservationSchema.index({ user_id: 1, observed_at: -1 });
fingerprintObservationSchema.index({ fingerprint_hash: 1, observed_at: -1 });

export const FingerprintObservation = mongoose.model<IFingerprintObservation>('FingerprintObservation', fingerprintObservationSchema);
