import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  admin_id: string | null;
  action: 'login_success' | 'login_failed' | 'logout' | string;
  ip: string;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    admin_id: {
      type: String,
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    ip: {
      type: String,
      required: true,
      index: true,
    },
    user_agent: {
      type: String,
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
);

auditLogSchema.index({ admin_id: 1, created_at: -1 });
auditLogSchema.index({ action: 1, created_at: -1 });
auditLogSchema.index({ ip: 1, created_at: -1 });
auditLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
