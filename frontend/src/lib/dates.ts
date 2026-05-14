const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatDate(d: string | Date): string {
  const date = new Date(d);
  const m = MONTHS[date.getUTCMonth()];
  const day = date.getUTCDate();
  const y = date.getUTCFullYear();
  return `${m} ${day}, ${y}`;
}

export function formatTime(d: string | Date): string {
  const date = new Date(d);
  const h = date.getUTCHours().toString().padStart(2, '0');
  const m = date.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function relativeTime(d: string | Date): string {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatDate(d);
}
