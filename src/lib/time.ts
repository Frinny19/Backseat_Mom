const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "Just now", "35 m ago", "2 h 15 m ago", "3 days ago" — the ribbon's idle time. */
export function formatAgo(from: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - from.getTime());
  if (ms < MIN) return 'Just now';
  if (ms < HOUR) return `${Math.floor(ms / MIN)} m ago`;
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    const m = Math.floor((ms % HOUR) / MIN);
    return m === 0 ? `${h} h ago` : `${h} h ${m} m ago`;
  }
  const d = Math.floor(ms / DAY);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
}

/** "0:42:18" — a running timer, always with hours so the width stays stable. */
export function formatTimer(from: Date, now: Date): string {
  const total = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** "1 h 25 m", "18 min", "11 h" — a finished duration. */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / MIN));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/** "9:00" style clock time in the device's locale. */
export function formatClock(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "4 months, 2 weeks" from a birth date. */
export function formatAge(birth: Date, now: Date): string {
  const days = Math.floor((now.getTime() - birth.getTime()) / DAY);
  if (days < 0) return 'Not born yet';
  if (days < 14) return days === 1 ? '1 day' : `${days} days`;
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 1) {
    const weeks = Math.floor(days / 7);
    return `${weeks} weeks`;
  }
  // The same day of the month, clamped so a birthday on the 31st doesn't spill into the next month.
  const anchor = new Date(birth.getFullYear(), birth.getMonth() + months, 1, birth.getHours(), birth.getMinutes());
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  anchor.setDate(Math.min(birth.getDate(), daysInMonth));
  const weeks = Math.floor((now.getTime() - anchor.getTime()) / (7 * DAY));
  const m = months === 1 ? '1 month' : `${months} months`;
  if (weeks === 0) return m;
  return `${m}, ${weeks === 1 ? '1 week' : `${weeks} weeks`}`;
}
