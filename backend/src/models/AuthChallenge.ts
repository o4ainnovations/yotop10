import { Schema, Document } from 'mongoose';
import { registerModel } from '../lib/modelRegistry';

export interface IAuthChallenge extends Document {
  challenge: string;
  authority_id: string;
  device_fingerprint: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

const authChallengeSchema = new Schema<IAuthChallenge>(
  {
    challenge: {
      type: String,
      required: true,
    },
    authority_id: {
      type: String,
      required: true,
      index: true,
    },
    device_fingerprint: {
      type: String,
      required: true,
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expires: 300 },
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

export const AuthChallenge = registerModel<IAuthChallenge>('AuthChallenge', authChallengeSchema);
