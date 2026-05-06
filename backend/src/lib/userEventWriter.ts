import { UserEvent } from '../models/UserEvent';

export function logUserEvent(params: {
  user_id: string;
  fingerprint: string;
  event: string;
  metadata?: Record<string, unknown>;
}): void {
  Promise.resolve().then(async () => {
    try {
      await UserEvent.create({
        user_id: params.user_id,
        fingerprint: params.fingerprint,
        event: params.event,
        metadata: params.metadata || {},
      });
    } catch (err) {
      console.error('[UserEvent] Write failed:', (err as Error).message);
    }
  });
}
