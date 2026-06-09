// Express Request type extensions
// Imported automatically by TypeScript — no explicit import needed in route files

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        username: string;
        custom_display_name?: string | null;
        device_fingerprint: string;
        trust_score: number;
        trust_locked: boolean;
        is_admin: boolean;
        created_at?: Date;
        restricted_until?: Date | null;
        rate_limit_override?: {
          posts_per_hour?: number | null;
          comments_per_hour?: number | null;
        };
      };
      admin?: {
        id: string;
        username: string;
        role: 'super_admin' | 'mod';
        permissions: string[];
        permissions_version: number;
        token_version: number;
      };
      fingerprint?: string;
    }
  }
}

export {};
