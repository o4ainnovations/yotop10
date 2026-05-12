import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

type FingerprintSignals = Record<string, string | number | boolean>;

export interface IFingerprintObservation extends Document {
  user_id: string;
  fingerprint_hash: string;
  tier0: FingerprintSignals;
  tier1: FingerprintSignals;
  tier2: FingerprintSignals;
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
    tier0: { type: Map, of: Schema.Types.Mixed, default: {} },
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
    observed_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

fingerprintObservationSchema.index({ user_id: 1, observed_at: -1 });
fingerprintObservationSchema.index({ fingerprint_hash: 1, observed_at: -1 });
fingerprintObservationSchema.index({ observed_at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const FingerprintObservation = registerModel<IFingerprintObservation>('FingerprintObservation', fingerprintObservationSchema);
