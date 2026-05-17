export interface SeoSignals {
  comment_count: number;
  view_count: number;
  content_length: number;
  status: string;
  age_hours: number;
}

export function shouldNoIndex(signals: SeoSignals): boolean {
  if (signals.status !== 'approved') return true;
  if (signals.comment_count === 0 && signals.view_count === 0 && signals.age_hours > 48) return true;
  if (signals.content_length < 100 && signals.age_hours > 24) return true;
  return false;
}
