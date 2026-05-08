// Express Request type extensions
// Imported automatically by TypeScript — no explicit import needed in route files

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        username: string;
        trust_score: number;
        device_fingerprint: string;
        created_at?: Date | string;
        restricted_until?: Date | string;
        custom_display_name?: string;
      };
      admin?: {
        id: string;
        username: string;
        token_version: number;
      };
      fingerprint?: string;
    }
  }
}

export {};
